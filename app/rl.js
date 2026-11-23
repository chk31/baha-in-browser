// ===================== 強化学習CPU（MaskablePPOの方策ネットワークをそのまま推論） =====================
const RL_KINDS=['play','negate','counter','choose','discard','declare'];
const RL_OBS=16*7+16+16+12+6+16+1; // 179
function rlEncode(s,p,req){
  const me=s.players[p],op=s.players[1-p],x=new Float32Array(RL_OBS);
  const loc=new Array(16).fill(5);
  for(const c of me.hand)loc[c]=0;for(const c of me.field)loc[c]=1;for(const c of op.field)loc[c]=2;
  for(const c of s.discard)loc[c]=3;for(const c of s.known[p])loc[c]=4;if(s.limbo!=null)loc[s.limbo]=6;
  for(let c=0;c<16;c++)x[c*7+loc[c]]=1;
  let i=112;
  for(const c of s.known[1-p])x[i+c]=1;i+=16;
  for(const [c,d] of s.misses[p])if(d===s.hiddenDraws[1-p]&&loc[c]===5)x[i+c]=1;i+=16;
  const bluffs=s.ideyonResults[1-p].filter(r=>r!==HARA).length;
  const sc=[me.life/4,op.life/4,me.chips/6,op.chips/6,s.stock/6,s.deck.length/16,op.hand.length/10,me.hand.length/10,
    Math.max(0,s.playsAllowed-s.playsUsed)/5,s.turn===p?1:0,s.turnCount===1?1:0,Math.min(bluffs,3)/3];
  for(let k=0;k<12;k++)x[i+k]=sc[k];i+=12;
  x[i+RL_KINDS.indexOf(req.kind)]=1;i+=6;
  if(req.card>=0)x[i+req.card]=1;i+=16;
  x[i]=(req.remaining||0)/2;
  return x;
}
// AI4の入力（234）：これまでの179 ＋ 行動履歴55
const RL_OBS4=RL_OBS+55;
function rlEncode4(s,p,req){
  const x=new Float32Array(RL_OBS4);x.set(rlEncode(s,p,req),0);
  const h=s.hist,o=1-p,c3=v=>Math.min(v,3)/3;let i=RL_OBS;
  for(const arr of [h.negated[o],h.allowed[o],h.played[o]]){for(let c=0;c<16;c++)x[i+c]=c3(arr[c]);i+=16;}
  for(const v of [h.counters[o],h.counters[p],h.passes[o],h.zeroTurns[o],h.fullStreak[o]])x[i++]=c3(v);
  x[i++]=Math.min(s.turnCount,30)/30;x[i++]=s.first===p?1:0;
  return x;
}
function rlMask(req){
  const m=new Array(19).fill(false);
  if(req.kind==='play'){for(const c of req.options)m[c]=true;m[16]=!req.noPass||!req.options.length;}
  else if(req.kind==='negate'||req.kind==='counter'){m[17]=m[18]=true;}
  else for(const c of req.options)m[c]=true;
  return m;
}
// 重み：base64のFloat32配列 + 形状
function rlLoad(blob){
  const bin=typeof atob==='function'?atob(blob.data):Buffer.from(blob.data,'base64').toString('binary');
  const buf=new ArrayBuffer(bin.length),u8=new Uint8Array(buf);for(let i=0;i<bin.length;i++)u8[i]=bin.charCodeAt(i);
  const f=new Float32Array(buf);let o=0;
  return blob.shapes.map(([out,inn])=>{const W=f.subarray(o,o+out*inn);o+=out*inn;const b=f.subarray(o,o+out);o+=out;return{W,b,out,inn};});
}
function rlForward(L,x){
  let h=x;
  for(let li=0;li<L.length;li++){const {W,b,out,inn}=L[li];const y=new Float32Array(out);
    for(let r=0;r<out;r++){let acc=b[r];const off=r*inn;for(let c=0;c<inn;c++)acc+=W[off+c]*h[c];y[r]=li<L.length-1?Math.tanh(acc):acc;}
    h=y;}
  return h;
}
function makeRL(L,opt={}){
  const enc=L[0].inn===RL_OBS4?rlEncode4:rlEncode;
  const pick=(s,p,req)=>{const z=rlForward(L,enc(s,p,req)),m=rlMask(req);let best=-1,bv=-Infinity;for(let a=0;a<19;a++)if(m[a]&&z[a]>bv){bv=z[a];best=a;}return best;};
  return{
    choosePlay:(s,p,cons)=>{const hand=s.players[p].hand;let opts=hand.filter(c=>c!==HARA);if(opt.noBluff&&![HARA,KODOMO,GOB].some(c=>hand.includes(c)))opts=opts.filter(c=>c!==IDEYON);
      if(cons&&cons.opts)opts=opts.filter(c=>cons.opts.includes(c));
      const a=pick(s,p,{kind:'play',options:opts,card:-1,noPass:!!(cons&&cons.noPass)});return a===16?null:{card:a,intent:''};},
    decideNegate:(s,p,card)=>pick(s,p,{kind:'negate',options:[],card})===17,
    decideCounter:(s,p,card)=>pick(s,p,{kind:'counter',options:[],card})===17,
    chooseCard:(s,p,opts,ctx)=>pick(s,p,{kind:'choose',options:opts,card:ctx.card}),
    declareName:(s,p)=>pick(s,p,{kind:'declare',options:[...Array(16).keys()].filter(c=>c!==SUISHO),card:SUISHO}),
    chooseDiscard:(s,p,n,purpose,card=-1,protect=null)=>{
      // Python版と同じく1枚ずつ選ぶ。選んだカードは一時的に捨て札へ動かして次を判断し、最後に元へ戻す
      const me=s.players[p],hand0=[...me.hand],disc0=[...s.discard],k0=[new Set(s.known[0]),new Set(s.known[1])];
      const out=[];
      for(let i=0;i<n;i++){let cand=[...me.hand];if(protect){const f=cand.filter(x=>!protect.has(x));if(f.length>0)cand=f;}
        const c=pick(s,p,{kind:'discard',options:cand,card,remaining:n-i});out.push(c);
        me.hand.splice(me.hand.indexOf(c),1);s.discard.push(c);s.known[0].delete(c);s.known[1].delete(c);}
      me.hand.splice(0,me.hand.length,...hand0);s.discard.splice(0,s.discard.length,...disc0);s.known[0]=k0[0];s.known[1]=k0[1];
      return out;
    },
  };
}
