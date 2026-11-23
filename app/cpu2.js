// ===================== ルールベースCPU v2（確率・書の読み合いモデル） =====================
const CPU2_DEFAULT={landT:0.55,baitT:0.25,fukiyaPre:true,denyHara:true,defense:true,killKodomoRoute:true,negModel:true,sequencing:true,bluffRate:0.25,ideyonT:0.01,ideyonTA:0.01,gobPriority:false,gobLife:2,kodomoRemoveLife:0,knifeNeg:'v1',holdKnife:0,majoBelow:3,ginLate:false,ansMode:null};

function view2(s,p){
  const me=s.players[p],op=s.players[1-p];
  const seen=new Set([...me.hand,...me.field,...op.field,...s.discard]);if(s.limbo!=null)seen.add(s.limbo);
  const unseen=[...Array(16).keys()].filter(c=>!seen.has(c));
  const known=s.known[p];
  const not=new Set();for(const [c,d] of s.misses[p])if(d===s.hiddenDraws[1-p]&&unseen.includes(c)&&!known.has(c))not.add(c);
  const pool=unseen.filter(c=>!known.has(c)&&!not.has(c));
  const slots=Math.max(0,op.hand.length-known.size);
  const pOpp=c=>known.has(c)?1:(!unseen.includes(c)||not.has(c))?0:(pool.length?Math.min(1,slots/pool.length):0);
  const deckN=Math.max(1,s.deck.length);
  // 相手が次のターン中にそのカードを手にしている確率（手札＋1ドロー）
  const pNext=c=>{const ph=pOpp(c);if(!unseen.includes(c))return ph;return ph+(1-ph)*Math.min(1,1/deckN);};
  const H=c=>me.hand.includes(c),myF=c=>me.field.includes(c),opF=c=>op.field.includes(c),inDisc=c=>s.discard.includes(c);
  return{me,op,unseen,known,not,pOpp,pNext,H,myF,opF,inDisc,isUnseen:c=>unseen.includes(c),deckN};
}
const anyP=ps=>1-ps.reduce((a,p)=>a*(1-Math.max(0,Math.min(1,p))),1);

// 自分の場のはらぺこ（または着地予定）を、相手が次のターンに処理できる確率
function oppAnswerProb(s,p,v,assumeLanded=true){
  const ps=[];
  const kodomoOnMyField=v.myF(KODOMO);
  for(const a of [OWAKARE,IREKAE]){
    if(a===IREKAE&&kodomoOnMyField)continue; // 両方自分の場なら入れ替えても無意味
    if(v.H(a)){ if(s.known[1-p].has(a))ps.push(v.pNext(SUISHO)); else ps.push(v.pNext(SUISHO)*0.15); continue;}
    if(v.inDisc(a)){ps.push(v.pNext(KARASU));continue;}
    if(v.isUnseen(a)){const ph=v.pNext(a);ps.push(ph);
      const inDeck=1-v.pOpp(a);ps.push(v.pNext(MEGANE)*inDeck);}
  }
  return anyP(ps);
}
// 書の読み合いを含めた「着地して次の自分のターンまで残る」確率（相手は最善応答）
function answerResolves(m,o){return m>=1?(o>=2?1:0):1;}
function landSuccess(m,o,pa){
  const B=1-pa*answerResolves(m,o);
  if(o<1)return B;
  const A=m>=2?1-pa*answerResolves(m-2,o-1):0;
  return Math.min(A,B);
}
// 相手が次のターンに自分を倒しうる度合い（ゴブリン・書の確保を判断）
function dangerKnife(s,p,v){
  if(v.myF(GOB))return 0;
  const knifeAcc=v.inDisc(KNIFE)?v.pNext(KARASU):(v.isUnseen(KNIFE)?v.pNext(KNIFE):0);
  const tick=v.opF(KODOMO)?1:0;
  const L=v.me.life-tick;
  if(L<=0)return 1;
  if(L<=2)return knifeAcc;
  return 0;
}
// 相手のイデヨンが「はらぺこ以外」で解決した回数（ブラフの観測）
function oppIdeyonBluffs(s,p){
  const nm=s.names[1-p];let n=0;const L=s.log;
  for(let i=0;i<L.length;i++){if(L[i].msg===`${nm}が「イデヨン！」をプレイ`){
    for(let j=i+1;j<Math.min(L.length,i+6);j++){const m=L[j].msg;
      if(m.includes('うちけしの書を使った')&&!(L[j+1]&&L[j+1].msg.includes('うちけし返し')))break;
      if(m.startsWith('はらぺこバハムートが'))break;
      if(m==='場に出せるまものがなかった'||/^(こども|はねかえし).*の場に出た！/.test(m)){n++;break;}}}}
  return n;
}
function chipCost(m){return m>=3?0.8:m===2?1.3:1.8;}

function cpu2Plan(s,p,cfg){
  const v=view2(s,p),{me,op,H}=v;const left=s.playsAllowed-s.playsUsed;
  const P=(card,intent,target)=>({card,intent,target});
  const oppGob=v.opF(GOB),myGob=v.myF(GOB),knifeOK=!oppGob;
  const m=me.chips,o=op.chips;
  // A. 勝ち切り
  if(knifeOK&&op.life<=2&&H(KNIFE))return P(KNIFE,'lethal');
  if(knifeOK&&op.life<=2&&H(KARASU)&&v.inDisc(KNIFE)&&left>=2)return P(KARASU,'lethal',KNIFE);
  if(knifeOK&&op.life<=4&&H(KNIFE)&&H(KARASU)&&left>=3)return P(KNIFE,'lethal');
  if(knifeOK&&op.life<=4&&H(SAND)&&H(KNIFE)&&H(KARASU)&&left===2)return P(SAND,'lethal');
  if(knifeOK&&op.life<=2&&H(MEGANE)&&left>=2&&v.isUnseen(KNIFE)&&!v.known.has(KNIFE))return P(MEGANE,'lethal',KNIFE);
  // B. 相手のはらぺこへの対処（書の読み合いで順番を工夫）
  if(v.opF(HARA)){
    const iOK=H(IREKAE)&&!v.opF(KODOMO); // 相手の場にこどもがいると入れ替えても相手の場に残る
    const answers=[H(OWAKARE)?OWAKARE:null,iOK?IREKAE:null].filter(x=>x!=null);
    if(cfg.sequencing&&answers.length===1&&o>=1&&m<2&&left>=2){
      // 1枚目は相手がうちけしたくなる囮
      if(H(KNIFE)&&knifeOK&&op.life<=2)return P(KNIFE,'lethal');
      if(H(MAJO)&&s.stock>0&&m===1)return P(MAJO,'chip');
    }
    if(answers.length){const a=answers[0];return P(a,'answer',a===OWAKARE?HARA:undefined);}
    const ans=[OWAKARE,IREKAE];
    if(H(KARASU)&&left>=2){const t=ans.find(v.inDisc);if(t!=null)return P(KARASU,'answer',t);}
    if(H(MEGANE)&&left>=2){const t=ans.find(c=>v.isUnseen(c)&&!v.known.has(c));if(t!=null)return P(MEGANE,'answer',t);}
    if(H(SUISHO)&&left>=2){const t=ans.filter(c=>v.pOpp(c)>0).sort((a,b)=>v.pOpp(b)-v.pOpp(a))[0];if(t!=null)return P(SUISHO,'answer',t);}
    if(H(SAND)&&left===1&&(H(KARASU)||H(MEGANE)||H(SUISHO)||H(GIN)||H(KURO)))return P(SAND,'answer');
    if(H(KURO))return P(KURO,'dig');
    if(H(GIN)&&left>=2)return P(GIN,'dig');
  }
  // C. 防御：ナイフ／こどもで倒される危険
  const dk=cfg.defense?dangerKnife(s,p,v):0;
  if((v.opF(KODOMO)&&!myGob&&me.life<=1)||dk>=0.3){
    if(H(GOB)&&!myGob)return P(GOB,'defend');
    if(H(YOMI)&&v.inDisc(GOB))return P(YOMI,'defend',GOB);
    if(H(IDEYON)&&H(GOB))return P(IDEYON,'defend',GOB);
    if(v.opF(KODOMO)&&me.life<=1&&H(OWAKARE))return P(OWAKARE,'defend',KODOMO);
  }
  // C2. こどもの継続ダメージ対策
  if(cfg.gobPriority&&H(GOB)&&!myGob&&(v.opF(KODOMO)||(knifeOK&&false)||(v.isUnseen(KNIFE)&&me.life<=cfg.gobLife)))return P(GOB,'defend');
  if(cfg.kodomoRemoveLife&&v.opF(KODOMO)&&!myGob&&!H(GOB)&&me.life<=cfg.kodomoRemoveLife&&H(OWAKARE)&&(H(IREKAE)||v.pOpp(HARA)<0.3||v.inDisc(HARA)))return P(OWAKARE,'remove',KODOMO);
  // D. はらぺこ着地の評価
  const route=landingRoute(s,p,v,left);
  if(route&&!v.opF(HARA)){
    const pa=oppAnswerProb(s,p,v);
    const succ=landSuccess(m,o,pa);
    if(succ>=cfg.landT){
      // 着地の前に相手の返し手を吹き矢で抜く
      if(cfg.fukiyaPre&&H(FUKIYA)&&left>=(route.intent==='land'?2:3)&&op.hand.length&&pa>0.25)return P(FUKIYA,'strip');
      if(H(GOB)&&!myGob&&left>=2&&route.intent==='land')return P(GOB,'setup');
      if(H(SAND)&&s.playsUsed===0)return P(SAND,'setup');
      return route;
    }
    // 囮として着地を試みる（失敗しても相手の書を1枚削る）
    if(succ>=cfg.baitT&&o>=1&&m<=1&&route.intent==='land')return {...route,intent:'bait'};
  }
  // E. 相手のはらぺこ回収の妨害（捨て札のはらぺこをカラスで確保）
  if(cfg.denyHara&&H(KARASU)&&v.inDisc(HARA)&&(v.pNext(YOMI)>0.3||v.pNext(KARASU)>0.3||H(IDEYON)))return P(KARASU,'deny',HARA);
  // F. 相手の「こども＋イレカエール」ルートを潰す
  if(cfg.killKodomoRoute&&v.opF(KODOMO)&&v.pNext(IREKAE)>=0.35&&!v.myF(HARA)&&H(OWAKARE)&&(H(IREKAE)||v.inDisc(IREKAE)===false&&v.H(IREKAE)===false&&m>=1))return P(OWAKARE,'remove',KODOMO);
  // G. 砂時計は1枚目
  const useful=[KNIFE,GIN,MAJO,FUKIYA,KODOMO,GOB].filter(c=>H(c)&&(c!==KNIFE||knifeOK)&&(c!==MAJO||s.stock>0)&&(c!==KODOMO||(!oppGob&&!v.myF(KODOMO)))&&(c!==GOB||!myGob)).length;
  if(H(SAND)&&s.playsUsed===0&&useful>=2)return P(SAND,'tempo');
  // H. 書が2枚未満なら補充を優先
  if(H(MAJO)&&s.stock>0&&m<cfg.majoBelow)return P(MAJO,'chip');
  if(H(GIN)&&!cfg.ginLate)return P(GIN,'draw');
  // I. 盤面
  if(H(GOB)&&!myGob)return P(GOB,'board');
  if(H(KODOMO)&&!oppGob&&!v.myF(KODOMO)&&!(v.opF(HARA)))return P(KODOMO,'board');
  if(oppGob&&H(OWAKARE)&&H(IREKAE)&&(H(KNIFE)||v.myF(KODOMO)))return P(OWAKARE,'remove',GOB);
  // J. 圧力・リソース
  if(H(KNIFE)&&knifeOK&&!(cfg.holdKnife&&op.life>cfg.holdKnife))return P(KNIFE,'pressure');
  if(H(MAJO)&&s.stock>0)return P(MAJO,'chip');
  if(H(GIN))return P(GIN,'draw');
  if(H(FUKIYA)&&op.hand.length>=2)return P(FUKIYA,'disrupt');
  if(H(SUISHO)){const cand=[...Array(16).keys()].filter(c=>c!==SUISHO).map(c=>({c,e:v.pOpp(c)*threatValue(s,p,c)})).sort((a,b)=>b.e-a.e)[0];if(cand&&cand.e>=4)return P(SUISHO,'steal',cand.c);}
  if(H(MEGANE)&&s.deck.length)return P(MEGANE,'search');
  if(H(KARASU)&&s.discard.length){const t=[...s.discard].sort((a,b)=>cardValue(s,p,b)-cardValue(s,p,a))[0];if(cardValue(s,p,t)>=6)return P(KARASU,'recover',t);}
  if(H(KURO)&&me.hand.length>=3)return P(KURO,'filter');
  if(H(YOMI)&&v.inDisc(GOB))return P(YOMI,'board',GOB);
  if(H(YOMI)&&v.inDisc(KODOMO)&&!oppGob&&!v.myF(KODOMO))return P(YOMI,'board',KODOMO);
  return null;
}

// 自分が着地を止められなかった場合に相手が勝つ確率（相手視点の landSuccess）
function theirLandSuccess(s,p,v,mAfter,oAfter){
  // 自分が次のターンに返せる確率
  const ps=[];
  for(const a of [OWAKARE,IREKAE]){
    if(a===IREKAE&&v.opF(KODOMO))continue;
    if(v.H(a)){ps.push(1);continue;}
    if(v.inDisc(a)){ps.push(v.H(KARASU)?1:0.1);continue;}
    if(v.isUnseen(a)){ps.push((1-v.pOpp(a))*Math.min(1,1/v.deckN));if(v.H(MEGANE))ps.push(1-v.pOpp(a));}
  }
  return landSuccess(oAfter,mAfter,anyP(ps));
}
function cpu2Negate(s,p,card,cfg){
  const v=view2(s,p),{me,op}=v;const m=me.chips,o=op.chips;if(m<1)return false;
  if(!cfg.negModel||(cfg.negCards&&!cfg.negCards.includes(card)))return cpuNegate(s,p,card);
  const answerHeld=v.H(OWAKARE)||(v.H(IREKAE)&&!v.opF(KODOMO));
  // 着地系：期待損失で判断
  const landDecision=(pHara)=>{
    if(pHara<=0)return false;
    const noNeg=pHara*10*theirLandSuccess(s,p,v,m,o);
    let neg;
    if(o>=2) neg=pHara*10*theirLandSuccess(s,p,v,m-1,o-2)+chipCost(m)*0.5;
    else neg=chipCost(m)*(1-pHara)+0.3;
    return neg<noNeg;
  };
  switch(card){
    case IDEYON:{
      if(v.myF(HARA)||v.opF(HARA))return false;
      const ph=v.pOpp(HARA);if(ph===0)return false;
      if(cfg.ansMode){
        const nAns=(v.H(OWAKARE)?1:0)+((v.H(IREKAE)&&!v.opF(KODOMO))?1:0);
        const safe=o===0||m>=2;            // 自分の返し手を確実に通せる
        if(cfg.ansMode==='never'&&nAns>=1)return false;
        if(cfg.ansMode==='safe'&&nAns>=1&&safe)return false;
        if(cfg.ansMode==='two'&&nAns>=2)return false;
        if(cfg.ansMode==='safe2'&&nAns>=2&&safe)return false;
      }
      if(v.known.has(HARA))return true;
      const b=oppIdeyonBluffs(s,p);
      if(b>=1&&ph<0.5+0.15*(b-1))return false; // ブラフを見せた相手には、はらぺこの可能性が高いときだけ
      const post=ph/(ph+(1-ph)*cfg.bluffRate);
      return post>=(answerHeld?cfg.ideyonTA:cfg.ideyonT);}
    case YOMI:
      if(v.inDisc(HARA)){if(cfg.ansMode==='safe'&&answerHeld&&(o===0||m>=2))return false;return true;}
      return v.inDisc(GOB)&&m>=2&&(v.myF(KODOMO)||(v.H(KNIFE)&&op.life<=2));
    case IREKAE:{const r=simIrekae(s,p);if(r.meLosesHara)return true;if(r.opGetsHara)return true;return false;}
    case OWAKARE:
      if(v.myF(HARA))return true;
      return v.myF(GOB)&&m>=2&&dangerKnife(s,p,{...v,myF:c=>c===GOB?false:v.myF(c)})>=0.3;
    case KNIFE:
      if(v.myF(GOB))return false;
      if(me.life<=2)return true;
      if(me.life===3&&v.opF(KODOMO))return true;
      if(cfg.knifeNeg==='m2')return m>=2;
      if(cfg.knifeNeg==='always')return true;
      return m>=3||(m===2&&v.H(MAJO)&&s.stock>0);
    case KODOMO:
      if(!v.myF(GOB)&&me.life<=2&&m>=2)return true;
      return false;
    case GOB:
      if(v.H(KNIFE)&&op.life<=2)return true;
      return m>=2&&(v.myF(KODOMO)||v.H(KNIFE)||v.H(KODOMO));
    case FUKIYA:
      if(v.opF(HARA)&&answerHeld)return true; // 返し手を抜かれると負け
      if(v.H(HARA)&&v.H(IDEYON)&&m>=2)return true;
      return m>=3;
    case SUISHO:
      if(v.opF(HARA)&&[OWAKARE,IREKAE].some(a=>v.H(a)&&s.known[1-p].has(a)))return true;
      return [...s.known[1-p]].some(c=>me.hand.includes(c)&&cardValue(s,p,c)>=7)&&m>=1;
    case MEGANE:
      if(v.myF(HARA)&&[OWAKARE,IREKAE].some(a=>v.isUnseen(a)))return true;
      return false;
    case KARASU:
      if(v.myF(HARA)&&[OWAKARE,IREKAE].some(a=>v.inDisc(a)))return true;
      return false;
    case GIN:case KURO:
      if(v.myF(HARA)&&m>=2)return true;
      return card===GIN&&s.turnCount<=2&&m>=2&&v.H(MAJO)&&s.stock>0;
    case MAJO:
      // 相手が書2枚に届くと「確実に通す」権利が生まれる
      return o===1&&m>=2&&v.pOpp(HARA)>0.4;
    default:return false;
  }
}
function makeCPU2(cfgOver={}){
  const cfg={...CPU2_DEFAULT,...cfgOver};
  const ag={plan:null,cfg};
  ag.choosePlay=(s,p)=>{ag.plan=cpu2Plan(s,p,cfg);return ag.plan;};
  ag.decideNegate=(s,p,card)=>cpu2Negate(s,p,card,cfg);
  ag.decideCounter=(s,p,card,intent)=>{
    if(['land','answer','lethal','defend'].includes(intent))return true;
    if(intent==='strip'&&s.players[p].chips>=3)return true;
    return false;
  };
  ag.chooseCard=(s,p,opts,ctx)=>{
    const t=ag.plan&&ag.plan.card===ctx.card?ag.plan.target:null;
    if(t!=null&&opts.includes(t))return t;
    const v=view2(s,p);
    if(ctx.card===OWAKARE){const pref=[HARA,KODOMO,GOB].filter(c=>v.opF(c)&&opts.includes(c));if(pref.length)return pref[0];return opts[0];}
    if(ctx.card===IDEYON||ctx.card===YOMI){for(const c of [HARA,GOB,KODOMO])if(opts.includes(c)&&!(c===KODOMO&&v.opF(GOB)))return c;return opts[0];}
    if(ctx.card===FUKIYA){
      // 着地予定なら返し手を最優先で抜く
      const order=(v.H(HARA)||v.myF(HARA)||ag.plan&&ag.plan.intent==='strip')?[OWAKARE,IREKAE,HARA,KNIFE,GOB]:[HARA,OWAKARE,IREKAE,KNIFE,GOB];
      for(const c of order)if(opts.includes(c)&&!(c===IREKAE&&v.myF(KODOMO)))return c;
      return [...opts].sort((a,b)=>threatValue(s,p,b)-threatValue(s,p,a))[0];
    }
    return [...opts].sort((a,b)=>cardValue(s,p,b)-cardValue(s,p,a))[0];
  };
  ag.chooseDiscard=(s,p,n)=>{
    const v=view2(s,p);
    const val=c=>{let x=cardValue(s,p,c);
      if(c===HARA){x+=2; if(v.H(YOMI))x-=4;}           // ヨミガエールがあるなら捨てて蘇生もあり
      if((c===OWAKARE||c===IREKAE))x+=2;               // 返し手は温存
      if(c===KNIFE&&v.H(KARASU))x+=1;
      return x;};
    return [...s.players[p].hand].sort((a,b)=>val(a)-val(b)).slice(0,n);
  };
  ag.declareName=(s,p)=>{
    const t=ag.plan&&ag.plan.card===SUISHO?ag.plan.target:null;if(t!=null)return t;
    const v=view2(s,p);return [...Array(16).keys()].filter(c=>c!==SUISHO).sort((a,b)=>v.pOpp(b)*threatValue(s,p,b)-v.pOpp(a)*threatValue(s,p,a))[0];
  };
  return ag;
}
if(typeof module!=='undefined')module.exports={newGame,runGame,makeCPU,makeCPU2,makeRandom,CARDS,NAME,HARA,CPU2_DEFAULT,landSuccess};
