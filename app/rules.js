// ===================== 確定手ルール（R1〜R7） =====================
// 勝ち負けが確定する判断をルールで決める。AI（ネットワーク）の判断に重ねて使う。
// 公開情報（自分の手札・場・捨て札・判明した相手の手札・山札に確定しているカード・書の枚数）だけで判断する。
const RK=(...a)=>a;
function ruleSnap(s,p){
  const v=view(s,p),me=v.me,op=v.op;
  const slots=Math.max(0,op.hand.length-v.known.size);
  const deck=new Set(v.unseen.filter(c=>!v.known.has(c)&&(slots===0||s.misses[p].get(c)===s.hiddenDraws[1-p])));
  return{hand:new Set(me.hand),disc:new Set(s.discard),deck,oppK:new Set(v.known),
    k:op.chips,m:me.chips,P:s.playsAllowed-s.playsUsed,
    oGob:v.opF(GOB),mGob:v.myF(GOB),oKod:v.opF(KODOMO),mKod:v.myF(KODOMO),oHara:v.opF(HARA),
    meLife:me.life,opLife:op.life,need:op.life<=2?1:2,goal:'',v};
}
const rcp=st=>({...st,hand:new Set(st.hand),disc:new Set(st.disc),deck:new Set(st.deck),oppK:new Set(st.oppK)});
const rThreat=st=>st.oHara||(st.oKod&&st.meLife===1&&!st.mGob)||(st.mKod&&st.oGob&&st.meLife===1);
const rDone=st=>st.goal==='G1'?st.need<=0:st.goal==='G2'?st.mGob:!rThreat(st);
function rIrekOK(st){return (st.oHara&&!st.oKod)||(!st.oHara&&!st.oKod&&st.mKod&&st.oGob&&st.meLife===1);}
function rMoves(st){
  const H=st.hand,mv=[],g=st.goal;
  const want=[];
  const gobMoves=()=>{if(H.has(GOB))mv.push({card:GOB});if(H.has(IDEYON)&&H.has(GOB))mv.push({card:IDEYON,t:GOB});if(H.has(YOMI)&&st.disc.has(GOB))mv.push({card:YOMI,t:GOB});};
  if(g==='G1'){
    if(H.has(KNIFE)&&!st.oGob)mv.push({card:KNIFE});
    if(H.has(OWAKARE)&&st.oGob)mv.push({card:OWAKARE,t:GOB,x:'oGob'});
    want.push(KNIFE);if(st.oGob)want.push(OWAKARE);
  }else if(g==='G2'){
    gobMoves();want.push(GOB);
  }else{
    if(H.has(OWAKARE)){
      if(st.oHara)mv.push({card:OWAKARE,t:HARA,x:'oHara'});
      if(st.oKod&&st.meLife===1&&!st.mGob)mv.push({card:OWAKARE,t:KODOMO,x:'oKod'});
      if(st.mKod&&st.oGob&&st.meLife===1){mv.push({card:OWAKARE,t:GOB,x:'oGob'});mv.push({card:OWAKARE,t:KODOMO,x:'mKod'});}
    }
    if(H.has(IREKAE)&&rIrekOK(st))mv.push({card:IREKAE});
    if(st.oKod&&st.meLife===1&&!st.mGob){gobMoves();want.push(GOB);}
    want.push(OWAKARE);if(rIrekOK(st)||st.oHara)want.push(IREKAE);
  }
  for(const t of want){
    if(H.has(t))continue;
    if(H.has(KARASU)&&st.disc.has(t))mv.push({card:KARASU,t});
    if(H.has(MEGANE)&&st.deck.has(t))mv.push({card:MEGANE,t});
    if(H.has(SUISHO)&&st.oppK.has(t))mv.push({card:SUISHO,t});
  }
  if(H.has(SAND)&&st.P>=1)mv.push({card:SAND});
  return mv;
}
// 解決した後の状態（st1は、手札からカードを抜き、Pを1減らした状態）
function rApply(st1,mv){
  const n=rcp(st1),c=mv.card;
  if(c!==GOB)n.disc.add(c);
  switch(c){
    case KNIFE:n.need--;break;
    case OWAKARE:if(mv.x==='oGob')n.oGob=false;else if(mv.x==='oHara')n.oHara=false;else if(mv.x==='oKod')n.oKod=false;else if(mv.x==='mKod')n.mKod=false;break;
    case IREKAE:if(n.oHara){if(!n.oKod){n.oHara=false;n.mKod=false;n.oKod=true;}}else if(n.mKod&&!n.oKod){n.mKod=false;}break;
    case GOB:n.mGob=true;break;
    case IDEYON:n.hand.delete(GOB);n.mGob=true;break;
    case YOMI:n.disc.delete(GOB);n.mGob=true;break;
    case KARASU:n.disc.delete(mv.t);n.hand.add(mv.t);break;
    case MEGANE:n.deck.delete(mv.t);n.hand.add(mv.t);break;
    case SUISHO:n.oppK.delete(mv.t);n.hand.add(mv.t);break;
    case SAND:n.P+=2;break;
  }
  return n;
}
const rKey=st=>st.goal+[...st.hand].sort().join('.')+'|'+[...st.disc].sort().join('.')+'|'+[...st.deck].sort().join('.')+'|'+[...st.oppK].sort().join('.')+'|'+[st.k,st.m,st.P,st.need,+st.oGob,+st.mGob,+st.oKod,+st.mKod,+st.oHara].join(',');
let R_USED=null,R_MEMO=null;
// 手mvを打ったとき、相手がどう打ち消しても目標に届くか
function rEval(st,mv){
  if(st.P<1||!st.hand.has(mv.card))return false;
  const st1=rcp(st);st1.hand.delete(mv.card);st1.P-=1;
  const res=rApply(st1,mv);
  if(!rSolve(res))return false;
  if(st.k>=1){
    const neg=rcp(st1);neg.disc.add(mv.card);neg.k-=1;
    let ok=rSolve(neg);
    if(!ok&&st.m>=2){const ctr=rApply(st1,mv);ctr.m-=2;ctr.k-=1;ok=rSolve(ctr);}
    if(!ok)return false;
  }
  if(R_USED)R_USED.add(mv.card);
  return true;
}
function rSolve(st){
  if(rDone(st))return true;
  if(st.P<=0)return false;
  const key=R_MEMO?rKey(st):null;
  if(key&&R_MEMO.has(key))return R_MEMO.get(key);
  let r=false;
  for(const mv of rMoves(st))if(rEval(st,mv)){r=true;break;}
  if(key)R_MEMO.set(key,r);
  return r;
}
function rFirst(st){
  if(rDone(st))return null;
  for(const mv of rMoves(st))if(rEval(st,mv))return mv;
  return null;
}
const rWith=(st,goal)=>{const n=rcp(st);n.goal=goal;return n;};
function rGoals(st){
  const g=[];
  if(st.opLife<=4)g.push('G1');
  if(st.oKod&&st.opLife===1&&!st.mGob)g.push('G2');
  return g;
}
function rRun(f){R_USED=new Set();R_MEMO=new Map();try{return f();}finally{}}
// 自分の手番のプレイ：{forced:mv}か、{allow:Set,noPass}か、空
// その手を打っても、目標zに確実に届くままか。
// 手順に使う手はその効果で確かめる。それ以外の手は「効果なし」とみなし、手数が足りるかだけを見る
// （手数を使い切って間に合わなくなる手とパスを外す。手の中身の良し悪しはAIに任せる）。
function rKeeps(z,c){
  for(const m of rMoves(z))if(m.card===c&&rEval(z,m))return true;
  const g=rcp(z);g.hand.delete(c);g.disc.add(c);g.P-=(c===KURO?0:1);
  return g.P>=0&&rSolve(g);
}
// 自分の手番のプレイ（1プレイごとに判定する）
//  目標に確実に届く状態なら、その確実さが崩れない手だけを残す（パスも外す）。
//  残る手が1つなら、それが強制になる（最後の1手）。2つ以上なら、その中からAIが選ぶ。
//  {forced:{card},why} / {allow:Set,noPass:true,why} / {}
function ruleDecide(s,p){
  return rRun(()=>{
    const st=ruleSnap(s,p);
    const tries=rGoals(st).map(g=>[rWith(st,g),'R1']);
    if(rThreat(st))tries.push([rWith(st,'G3'),'R2']);
    for(const [z,why] of tries){
      R_MEMO=new Map();R_USED=new Set();
      if(rDone(z)||!rSolve(z))continue;
      const allow=new Set([...st.hand].filter(c=>c!==HARA&&rKeeps(z,c)));
      if(!allow.size)continue;
      if(allow.size===1)return{forced:{card:[...allow][0]},why,used:R_USED};
      return{allow,noPass:true,why,used:R_USED};
    }
    return{};
  });
}
// R4：必ず損をする手を外す
function ruleR4Play(s,p,opts){
  const v=view(s,p),me=v.me,op=v.op,oGob=v.opF(GOB),oKod=v.opF(KODOMO),oHara=v.opF(HARA);
  const monH=me.hand.filter(isMonster),monD=s.discard.filter(isMonster);
  const protectGob=v.myF(GOB)&&oKod&&(me.life===1||op.life===1);
  const fieldAll=[...op.field,...me.field];
  const r=opts.filter(c=>{
    if(c===KNIFE&&oGob)return false;
    if(c===KODOMO&&oGob&&me.life===1)return false;
    if(c===IDEYON&&oGob&&me.life===1&&monH.length&&monH.every(x=>x===KODOMO))return false;
    if(c===YOMI&&oGob&&me.life===1&&monD.length&&monD.every(x=>x===KODOMO))return false;
    if(c===IREKAE&&oKod&&!oHara)return false;
    if(c===OWAKARE&&protectGob&&fieldAll.length&&fieldAll.every(x=>x===GOB&&v.myF(GOB)))return false;
    return true;
  });
  return r;
}
function ruleR4Choose(s,p,opts,ctx){
  const v=view(s,p),me=v.me,op=v.op;
  let r=opts;
  if(ctx.card===OWAKARE&&v.myF(GOB)&&v.opF(KODOMO)&&(me.life===1||op.life===1))r=r.filter(c=>c!==GOB||!v.myF(GOB));
  if((ctx.card===IDEYON||ctx.card===YOMI)&&v.opF(GOB)&&me.life===1)r=r.filter(c=>c!==KODOMO);
  return r.length?r:opts;
}
// 解決時の対象選択：目標に確実に届く状態なら、その確実さが崩れない対象の集合を返す（制限なしならnull）
function ruleTargets(s,p,card,opts){
  return rRun(()=>{
    const st=ruleSnap(s,p);
    const goals=rGoals(st).map(g=>rWith(st,g));if(rThreat(st))goals.push(rWith(st,'G3'));
    for(const g of goals){
      if(rDone(g))continue;
      const tmp=rcp(g);tmp.hand.add(card);
      const good=new Set();
      for(const mv of rMoves(tmp).filter(m=>m.card===card))if(mv.t!=null&&rSolve(rApply(g,mv)))good.add(mv.t);
      const none=rcp(g);none.disc.add(card);const noneOK=rSolve(none);
      if(!good.size&&!noneOK)continue;                       // この目標は確実ではない
      if(opts===null)return noneOK?null:good;                 // 水晶の宣言
      const allow=opts.filter(t=>good.has(t)||(noneOK&&!rMoves(tmp).some(m=>m.card===card&&m.t===t)));
      return allow.length&&allow.length<opts.length?allow:null;
    }
    return null;
  });
}
// うちけし返しの判断：true/false、決まらなければnull
function ruleCounter(s,p,card){
  return rRun(()=>{
    const st=ruleSnap(s,p);
    const goals=rGoals(st).map(g=>rWith(st,g));if(rThreat(st))goals.push(rWith(st,'G3'));
    for(const g of goals){
      if(rDone(g))continue;
      const stn=rcp(g);stn.disc.add(card);
      const noOK=rSolve(stn);
      let ctrOK=false;
      if(g.m>=2){
        const tmp=rcp(g);tmp.hand.add(card);
        let mvs=rMoves(tmp).filter(m=>m.card===card);if(!mvs.length)mvs=[{card}];
        for(const mv of mvs){const res=rApply(g,mv);res.m-=2;if(rSolve(res)){ctrOK=true;break;}}
      }
      if(noOK||ctrOK)return ctrOK&&!noOK;
    }
    return null;
  });
}
// 相手のカードを打ち消すか：R5・R6。決まらなければnull
// 唱えた側(相手)の手札にありうるカード：自分から見えておらず、水晶で外れて以降相手が引いていないものを除く
function rOppMay(s,p,c){const v=view(s,p);if(v.known.has(c))return true;if(!v.unseen.includes(c))return false;return s.misses[p].get(c)!==s.hiddenDraws[1-p];}
// 打ち消しても意味がない（効果が確実に何も起きない）カード。経験則での判断は入れない
function ruleNoNeed(s,p,card){
  const v=view(s,p),me=v.me,op=v.op;
  if(card===IDEYON&&![HARA,KODOMO,GOB].some(c=>rOppMay(s,p,c)))return 'R8';
  if(card===YOMI&&!s.discard.some(isMonster))return 'R8';
  if(card===OWAKARE&&!me.field.length&&!op.field.length)return 'R8';
  if(card===MAJO&&s.stock===0)return 'R8';
  if(card===KARASU&&!s.discard.length)return 'R8';
  if(card===MEGANE&&!s.deck.length)return 'R8';
  if(card===FUKIYA&&!me.hand.length)return 'R8';
  if(card===SUISHO&&!me.hand.length)return 'R8';
  return null;
}
let R_OPT={noEffect:true};
function ruleNegate(s,p,card){
  const v=view(s,p),me=v.me;
  if(card===KNIFE&&v.myF(GOB))return false;
  if(me.chips<1)return null;
  if(R_OPT.noEffect&&ruleNoNeed(s,p,card))return false;
  if(card===KNIFE&&me.life<=2&&!v.myF(GOB))return true;
  if(v.myF(KODOMO)&&me.life===1){
    if(card===GOB)return true;
    if(card===YOMI&&v.inDisc(GOB))return true;
    if(card===IDEYON&&v.known.has(GOB))return true;
  }
  return null;
}
// 手札を捨てるとき、手順に使うカードを守る（R7）
function ruleProtect(s,p,card){
  return rRun(()=>{
    const st=ruleSnap(s,p);if(card===KURO)st.P+=1;
    const used=new Set();
    const add=()=>{for(const c of R_USED)used.add(c);};
    for(const g of rGoals(st)){rFirst(rWith(st,g));}
    add();
    if(rThreat(st)){
      rFirst(rWith(st,'G3'));add();
    }
    return used;
  });
}
function withRules(base,opt={}){
  const ag=Object.assign({},base);const o2={noEffect:opt.noEffect!==false};
  ag.stat={forced:0,allow:0,neg:0,ctr:0,tgt:0};
  // opt.log=true のとき、ルールが判断した場面をゲームのログに残す（AIだけなら別の手だった場合はそれも）
  const L=(s,p,msg,alt)=>{if(opt.log)log(s,`${s.names[p]}【確定手${msg}】${alt?`（AIだけなら：${alt}）`:''}`,'rule');};
  const nm=c=>c==null||c<0?'パス':NAME(c);
  const baseOnly=(f)=>{try{return f();}catch(e){return undefined;}};
  ag.choosePlay=(s,p)=>{
    const d=ruleDecide(s,p);
    const hand=s.players[p].hand.filter(c=>c!==HARA);
    const raw=opt.log?baseOnly(()=>base.choosePlay(s,p,{opts:hand,noPass:false})):undefined;
    const rawC=raw===undefined?undefined:raw?raw.card:-1;
    const goalWord=w=>w==='R1'?'勝ち':'負けを防ぐ手';
    if(d.forced){ag.stat.forced++;const c=d.forced.card;
      L(s,p,d.why==='R1'?`R1：${NAME(c)}を打たないと勝ちを逃す`:`R2：${NAME(c)}を打たないと負けを防げない`,rawC!==undefined&&rawC!==c?nm(rawC):null);
      return{card:c,intent:'rule'};}
    let opts=ruleR4Play(s,p,hand);const r4=hand.filter(c=>!opts.includes(c));
    if(d.allow){const f=opts.filter(c=>d.allow.has(c));if(f.length){opts=f;ag.stat.allow++;}}
    const a=base.choosePlay(s,p,{opts,noPass:!!d.noPass});
    const ac=a?a.card:-1;
    if(rawC!==undefined&&rawC!==ac){
      if(r4.includes(rawC))L(s,p,`R4：損な手（${NAME(rawC)}）を避けた`,null);
      else if(d.allow)L(s,p,`${d.why}：${nm(rawC)}では${goalWord(d.why)}が間に合わなくなる`,nm(rawC));
    }
    return a;
  };
  ag.decideNegate=(s,p,card)=>{const keep=R_OPT;R_OPT=o2;let r;try{r=ruleNegate(s,p,card);}finally{R_OPT=keep;}
    if(r!==null){ag.stat.neg++;
      if(opt.log){const raw=baseOnly(()=>base.decideNegate(s,p,card));
        const why=card===KNIFE&&view(s,p).myF(GOB)?`R5：${NAME(card)}は通せば相手がダメージを受ける`:r?`R6：${NAME(card)}を通すと負けるので打ち消す`:`R8：${NAME(card)}は打ち消しても意味がないので通す`;
        L(s,p,why,raw!==undefined&&raw!==r?(raw?'打ち消す':'通す'):null);}
      return r;}
    return base.decideNegate(s,p,card);};
  ag.decideCounter=(s,p,card,intent)=>{const r=ruleCounter(s,p,card);
    if(r!==null){ag.stat.ctr++;
      if(opt.log){const raw=baseOnly(()=>base.decideCounter(s,p,card,intent));
        if(r)L(s,p,`R1：うちけし返しで${NAME(card)}を通す`,raw===false?'あきらめる':null);
        else if(raw===true)L(s,p,`：うちけし返しなしでも届くので返さない`,'うちけし返し');}
      return r;}
    return base.decideCounter(s,p,card,intent);};
  ag.chooseCard=(s,p,opts,ctx)=>{
    let o=opts;
    if(opts.length>1){const t=ruleTargets(s,p,ctx.card,opts);if(t){o=t;ag.stat.tgt++;
      if(opt.log){const raw=baseOnly(()=>base.chooseCard(s,p,opts,ctx));if(raw!==undefined&&!t.includes(raw))L(s,p,`：${NAME(ctx.card)}の対象に${NAME(raw)}を選ぶと間に合わなくなる`,NAME(raw));}}}
    if(o.length===1)return o[0];
    return base.chooseCard(s,p,ruleR4Choose(s,p,o,ctx),ctx);
  };
  ag.declareName=(s,p)=>{
    const t=ruleTargets(s,p,SUISHO,null);
    if(t&&t.size){const raw=base.declareName(s,p);if(t.has(raw))return raw;ag.stat.tgt++;const c=[...t][0];
      if(opt.log)L(s,p,`：水晶で${NAME(c)}を宣言しないと間に合わない`,NAME(raw));return c;}
    return base.declareName(s,p);
  };
  ag.chooseDiscard=(s,p,n,purpose,card=-1)=>{
    const prot=ruleProtect(s,p,card);const r=base.chooseDiscard(s,p,n,purpose,card,prot);
    if(opt.log&&prot.size){const raw=baseOnly(()=>base.chooseDiscard(s,p,n,purpose,card));
      if(raw&&raw.some(c=>prot.has(c)))L(s,p,`R7：手順に使う${[...prot].filter(c=>raw.includes(c)).map(NAME).join('・')}を残す`,null);}
    return r;
  };
  return ag;
}
