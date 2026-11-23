// ===== はらぺこバハムート ゲームエンジン + ルールベースCPU =====
const HARA=0,KODOMO=1,GOB=2,IDEYON=3,YOMI=4,IREKAE=5,OWAKARE=6,KNIFE=7,MAJO=8,SAND=9,KARASU=10,GIN=11,KURO=12,SUISHO=13,MEGANE=14,FUKIYA=15;
const CARDS=[
 {id:HARA,name:'はらぺこバハムート',type:'まもの',text:'呪文の効果でのみ場に出せる。自分のターン開始時、相手に4ダメージ（ゴブリンでは防げない）。'},
 {id:KODOMO,name:'こどもバハムート',type:'まもの',text:'自分のターン開始時、相手に1ダメージ。'},
 {id:GOB,name:'はねかえしゴブリン',type:'まもの',text:'場にある間、自分が受けるダメージを相手に返す（はらぺこバハムートは除く）。'},
 {id:IDEYON,name:'イデヨン！',type:'呪文',text:'手札のまものを1枚、場に出す。'},
 {id:YOMI,name:'ヨミガエール！',type:'呪文',text:'捨て札のまものを1枚、場に出す。'},
 {id:IREKAE,name:'イレカエール！',type:'呪文',text:'こどもバハムートとはらぺこバハムートの位置を入れ替える（手札・山札・捨て札・場のどこにあっても）。'},
 {id:OWAKARE,name:'オワカーレ！',type:'呪文',text:'場のまものを1枚、捨て札にする。'},
 {id:KNIFE,name:'そらとぶナイフ',type:'アクション',text:'相手に2ダメージ。'},
 {id:MAJO,name:'魔女のおとどけもの',type:'アクション',text:'ストックからうちけしの書を1枚もらう。'},
 {id:SAND,name:'ほしふる砂時計',type:'アクション',text:'このターン、追加で2枚までプレイできる。'},
 {id:KARASU,name:'カラスのおつかい',type:'アクション',text:'捨て札から1枚選んで手札に加える。'},
 {id:GIN,name:'銀ネコのしっぽ',type:'アクション',text:'3枚引き、手札から2枚捨てる。'},
 {id:KURO,name:'黒ネコのしっぽ',type:'アクション',text:'2枚引き、手札から2枚捨てる。このターン、追加で1枚プレイできる。'},
 {id:SUISHO,name:'ひらめき水晶',type:'アクション',text:'カード名を1つ宣言。相手の手札にあれば自分の手札に加える。'},
 {id:MEGANE,name:'ようせいのメガネ',type:'アクション',text:'山札を全部見て1枚手札に加え、山札を切る。山札が0枚なら何も起きない。'},
 {id:FUKIYA,name:'あくまの吹き矢',type:'アクション',text:'相手の手札を全部見て、1枚捨て札にする。'},
];
const isMonster=c=>c<=2;
const NAME=c=>CARDS[c].name;
class GameOver extends Error{constructor(w){super('gameover');this.winner=w;}}
function shuffle(a,rng){for(let i=a.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}

function newGame(first,rng=Math.random,names=['あなた','CPU']){
  const s={deck:shuffle([...Array(16).keys()],rng),discard:[],limbo:null,stock:2,rng,names,
    players:[0,1].map(()=>({hand:[],field:[],life:4,chips:2})),
    known:[new Set(),new Set()], // known[p] = pが知っている「相手の手札」のカード
    hiddenDraws:[0,0],misses:[new Map(),new Map()],ideyonResults:[[],[]],turn:first,first,turnCount:0,playsAllowed:0,playsUsed:0,winner:null,log:[],ev:[],hooks:{},hist:newHist()};
  for(let i=0;i<5;i++)for(const p of [0,1])s.players[p].hand.push(s.deck.pop());
  ev(s,'start',{first,hands:s.players.map(x=>[...x.hand]),deck:[...s.deck]});
  return s;
}
// 行動履歴（AI4の入力）。Pythonの harapeko_run4.Hist と同じ数え方
function newHist(){const z=()=>[new Array(16).fill(0),new Array(16).fill(0)];
  return{negated:z(),allowed:z(),played:z(),counters:[0,0],passes:[0,0],zeroTurns:[0,0],fullStreak:[0,0],turnPlays:0};}
function log(s,msg,cls=''){s.log.push({msg,cls});}
// ===== 構造化ログ（s.ev）。文章ログ s.log は画面用にそのまま残す =====
// 各イベント: {k:種類, t:ターン番号, p:手番, ...内容}。st:true の時は全体の状態も付ける
function snapState(s){return{life:s.players.map(x=>x.life),chips:s.players.map(x=>x.chips),stock:s.stock,
  hand:s.players.map(x=>[...x.hand]),field:s.players.map(x=>[...x.field]),deck:s.deck.length,discard:[...s.discard],
  plays:[s.playsUsed,s.playsAllowed],known:[[...s.known[0]],[...s.known[1]]]};}
function ev(s,k,d={},st=false){if(!s.ev)return;const e={k,t:s.turnCount,p:s.turn,...d};if(st)e.st=snapState(s);s.ev.push(e);}
async function U(s,kind){if(s.hooks.update)await s.hooks.update(kind);}

function removeFromHand(s,p,c){const h=s.players[p].hand;const i=h.indexOf(c);if(i>=0)h.splice(i,1);s.known[0].delete(c);s.known[1].delete(c);}
function addToHand(s,p,c,pub){s.players[p].hand.push(c);if(pub)s.known[1-p].add(c);}
function reshuffle(s){ev(s,'reshuffle',{n:s.discard.length});s.deck=shuffle(s.discard.splice(0),s.rng);log(s,'山札が切れたので捨て札を混ぜて山札にした','sys');}
function drawCards(s,p,n){let k=0;const got=[];for(let i=0;i<n;i++){if(!s.deck.length){if(!s.discard.length)break;reshuffle(s);}const c=s.deck.pop();got.push(c);addToHand(s,p,c,false);s.hiddenDraws[p]++;k++;}ev(s,'draw',{who:p,cards:got,want:n});return k;}
function damage(s,target,amt,src){
  let t=target;
  const refl=src!==HARA&&s.players[t].field.includes(GOB);
  if(refl){t=1-t;log(s,`はねかえしゴブリンがダメージを跳ね返した！`,'hit');}
  const pl=s.players[t];pl.life=Math.max(0,pl.life-amt);
  ev(s,'damage',{src,aim:target,to:t,amt,refl,life:pl.life});
  log(s,`${s.names[t]}に${amt}ダメージ（残りライフ${pl.life}）`,'hit');
  if(pl.life<=0)throw new GameOver(1-t);
}
function locate(s,c){
  for(const p of [0,1]){let i=s.players[p].hand.indexOf(c);if(i>=0)return{arr:s.players[p].hand,i,kind:'hand',owner:p};
    i=s.players[p].field.indexOf(c);if(i>=0)return{arr:s.players[p].field,i,kind:'field',owner:p};}
  let i=s.deck.indexOf(c);if(i>=0)return{arr:s.deck,i,kind:'deck'};
  i=s.discard.indexOf(c);if(i>=0)return{arr:s.discard,i,kind:'discard'};
  return null;
}
const LOCNAME=(s,l)=>l.kind==='hand'?`${s.names[l.owner]}の手札`:l.kind==='field'?`${s.names[l.owner]}の場`:l.kind==='deck'?'山札':'捨て札';
function doIrekae(s){
  const a=locate(s,KODOMO),b=locate(s,HARA);
  if(!a||!b){log(s,'入れ替えられなかった','sys');ev(s,'irekae',{ok:false});return;}
  ev(s,'irekae',{ok:true,kodomo:{kind:a.kind,owner:a.owner},hara:{kind:b.kind,owner:b.owner}});
  a.arr[a.i]=HARA;b.arr[b.i]=KODOMO;
  for(const [l,c] of [[a,HARA],[b,KODOMO]]){if(l.kind==='hand'){s.known[0].delete(c===HARA?KODOMO:HARA);s.known[1].delete(c===HARA?KODOMO:HARA);s.known[1-l.owner].add(c);}}
  log(s,`はらぺこバハムート→${LOCNAME(s,a)}、こどもバハムート→${LOCNAME(s,b)}`,'');
}

// 判断の記録：AIの各判断（選択肢・選んだもの・その時の状態）を s.ev に残す
function recAgents(s,A){if(!s.ev)return A;return A.map((a,p)=>{const w={};
  const R=(kind,extra,st,res)=>{ev(s,'decide',{who:p,kind,...extra,choice:res},false);s.ev[s.ev.length-1].st=st;return res;};
  const wrap=(name,kind,fx)=>{w[name]=(...args)=>{const st=snapState(s);const extra=fx(...args);const r=a[name](...args);
    return r&&typeof r.then==='function'?r.then(v=>R(kind,extra,st,v)):R(kind,extra,st,r);};};
  wrap('choosePlay','play',(s_,p_)=>({options:s.players[p].hand.filter(c=>c!==HARA)}));
  wrap('decideNegate','negate',(s_,p_,card)=>({card}));
  wrap('decideCounter','counter',(s_,p_,card)=>({card}));
  wrap('chooseCard','choose',(s_,p_,opts,ctx)=>({options:[...opts],card:ctx&&ctx.card,purpose:ctx&&ctx.purpose}));
  wrap('chooseDiscard','discard',(s_,p_,n,purpose,card)=>({n,card,purpose}));
  wrap('declareName','declare',()=>({}));
  for(const k in a)if(!(k in w))w[k]=a[k];return w;});}
async function runGame(s,A){
  A=recAgents(s,A);
  try{while(true){await takeTurn(s,A);s.turn=1-s.turn;}}
  catch(e){if(e instanceof GameOver){s.winner=e.winner;ev(s,'end',{winner:e.winner},true);log(s,`${s.names[e.winner]}の勝ち！`,'win');await U(s,'end');return e.winner;}throw e;}
}
async function takeTurn(s,A){
  const p=s.turn,me=s.players[p];
  s.turnCount++;s.playsUsed=0;
  log(s,`── ${s.names[p]}のターン（${s.turnCount}）──`,'turn');ev(s,'turn',{},true);
  await U(s,'turn');
  if(me.field.includes(KODOMO)){log(s,'こどもバハムートの攻撃','');ev(s,'attack',{src:KODOMO});damage(s,1-p,1,KODOMO);await U(s,'dmg');}
  if(me.field.includes(HARA)){log(s,'はらぺこバハムートの攻撃！','');ev(s,'attack',{src:HARA});damage(s,1-p,4,HARA);await U(s,'dmg');}
  const firstTurn=s.turnCount===1;
  if(!firstTurn){drawCards(s,p,1);}
  s.playsAllowed=firstTurn?1:2;
  await U(s,'draw');
  while(s.playsUsed<s.playsAllowed){
    const ch=await A[p].choosePlay(s,p);
    if(ch==null){s.hist.passes[p]++;break;}
    s.hist.played[p][ch.card]++;s.hist.turnPlays++;
    await playCard(s,A,p,ch);
  }
  if(me.hand.length>5){
    const n=me.hand.length-5;
    const ds=await A[p].chooseDiscard(s,p,n,'手札上限（5枚）まで捨てる',-1);
    for(const c of ds){removeFromHand(s,p,c);s.discard.push(c);}ev(s,'discard',{who:p,cards:[...ds],why:'limit'});
    log(s,`${s.names[p]}は手札上限で${ds.map(NAME).join('、')}を捨てた`,'');
  }
  {const h=s.hist;if(h.turnPlays===0)h.zeroTurns[p]++;h.fullStreak[p]=me.hand.length>=5?h.fullStreak[p]+1:0;h.turnPlays=0;}
  log(s,`${s.names[p]}のターン終了`,'sys');ev(s,'turnEnd',{},true);
  await U(s,'endturn');
}
async function playCard(s,A,p,ch){
  const card=ch.card,o=1-p,me=s.players[p],op=s.players[o];
  if(!me.hand.includes(card)||card===HARA)return;
  removeFromHand(s,p,card);s.limbo=card;s.playsUsed++;
  log(s,`${s.names[p]}が「${NAME(card)}」をプレイ`,'play');ev(s,'play',{who:p,card,intent:ch.intent||''});
  await U(s,'play');
  let neg=false;
  let negAns=false;
  if(op.chips>=1){negAns=!!(await A[o].decideNegate(s,o,card));(negAns?s.hist.negated:s.hist.allowed)[o][card]++;}
  if(negAns){
    op.chips--;s.stock++;neg=true;log(s,`${s.names[o]}がうちけしの書を使った！`,'neg');ev(s,'negate',{who:o,card,chips:[...s.players.map(x=>x.chips)]});await U(s,'neg');
    if(me.chips>=2&&await A[p].decideCounter(s,p,card,ch.intent)&&++s.hist.counters[p]){me.chips-=2;s.stock+=2;neg=false;log(s,`${s.names[p]}がうちけし返し！（書2枚）`,'neg');ev(s,'counter',{who:p,card,chips:[...s.players.map(x=>x.chips)]});await U(s,'neg');}
  }
  if(neg){s.limbo=null;s.discard.push(card);log(s,`「${NAME(card)}」は無効になった`,'sys');ev(s,'resolved',{who:p,card,ok:false});await U(s,'res');return;}
  ev(s,'resolved',{who:p,card,ok:true});
  try{await resolve(s,A,p,card);}
  finally{s.limbo=null;if(!isMonster(card))s.discard.push(card);}
  await U(s,'res');
}
async function resolve(s,A,p,card){
  const o=1-p,me=s.players[p],op=s.players[o];
  const choose=(opts,purpose,extra={})=>A[p].chooseCard(s,p,opts,{card,purpose,...extra});
  switch(card){
    case KODOMO:case GOB:me.field.push(card);ev(s,'enter',{who:p,card,from:'play'});log(s,`${NAME(card)}が${s.names[p]}の場に出た`);break;
    case IDEYON:case YOMI:{
      const src=card===IDEYON?me.hand:s.discard;
      const opts=src.filter(isMonster);
      if(!opts.length){if(card===IDEYON)s.ideyonResults[p].push(null);ev(s,'fizzle',{who:p,card});log(s,'場に出せるまものがなかった','sys');break;}
      const c=await choose(opts,card===IDEYON?'場に出すまもの（手札）':'場に出すまもの（捨て札）');
      if(card===IDEYON){removeFromHand(s,p,c);s.ideyonResults[p].push(c);}else s.discard.splice(s.discard.indexOf(c),1);
      me.field.push(c);ev(s,'enter',{who:p,card:c,from:card===IDEYON?'hand':'discard',by:card});log(s,`${NAME(c)}が${s.names[p]}の場に出た！`,c===HARA?'hit':'');break;}
    case IREKAE:doIrekae(s);break;
    case OWAKARE:{
      const opts=[...op.field,...me.field];
      if(!opts.length){ev(s,'fizzle',{who:p,card});log(s,'場にまものがいなかった','sys');break;}
      const c=await choose(opts,'捨て札にするまもの');
      const ow=op.field.includes(c)?o:p;const f=s.players[ow].field;f.splice(f.indexOf(c),1);s.discard.push(c);ev(s,'leave',{owner:ow,card:c,by:OWAKARE});
      log(s,`${s.names[ow]}の${NAME(c)}が捨て札になった`,'');break;}
    case KNIFE:damage(s,o,2,KNIFE);break;
    case MAJO:if(s.stock>0){s.stock--;me.chips++;ev(s,'gainChip',{who:p,chips:me.chips,stock:s.stock});log(s,`${s.names[p]}はうちけしの書を1枚得た`);}else{ev(s,'fizzle',{who:p,card});log(s,'ストックが空だった','sys');}break;
    case SAND:s.playsAllowed+=2;log(s,'追加で2枚プレイできる');break;
    case KARASU:{
      if(!s.discard.length){ev(s,'fizzle',{who:p,card});log(s,'捨て札がなかった','sys');break;}
      const c=await choose([...s.discard],'手札に加えるカード（捨て札）');
      s.discard.splice(s.discard.indexOf(c),1);addToHand(s,p,c,true);ev(s,'recover',{who:p,card:c});log(s,`${s.names[p]}は捨て札から「${NAME(c)}」を回収`);break;}
    case GIN:case KURO:{
      const k=drawCards(s,p,card===GIN?3:2);log(s,`${s.names[p]}は${k}枚引いた`);await U(s,'draw');
      const n=Math.min(2,me.hand.length);
      if(n){const ds=await A[p].chooseDiscard(s,p,n,`${NAME(card)}：${n}枚捨てる`,card);for(const c of ds){removeFromHand(s,p,c);s.discard.push(c);}ev(s,'discard',{who:p,cards:[...ds],why:card});log(s,`${s.names[p]}は${ds.map(NAME).join('、')}を捨てた`);}
      if(card===KURO){s.playsAllowed+=1;log(s,'追加で1枚プレイできる');}break;}
    case SUISHO:{
      const c=await A[p].declareName(s,p);
      log(s,`${s.names[p]}は「${NAME(c)}」を宣言`);await U(s,'info');
      ev(s,'declare',{who:p,card:c,hit:op.hand.includes(c)});
      if(op.hand.includes(c)){removeFromHand(s,o,c);addToHand(s,p,c,true);log(s,`的中！${s.names[o]}の手札から奪った`,'hit');}
      else{log(s,'はずれ','sys');s.misses[p].set(c,s.hiddenDraws[o]);if(s.hooks.miss)s.hooks.miss(p,c);}break;}
    case MEGANE:{
      if(!s.deck.length){ev(s,'fizzle',{who:p,card});log(s,'山札がなかった','sys');break;}
      const c=await choose([...s.deck],'山札から手札に加えるカード');
      s.deck.splice(s.deck.indexOf(c),1);addToHand(s,p,c,false);s.hiddenDraws[p]++;ev(s,'search',{who:p,card:c});shuffle(s.deck,s.rng);log(s,`${s.names[p]}は山札から1枚選んで手札に加えた`);break;}
    case FUKIYA:{
      if(!op.hand.length){ev(s,'fizzle',{who:p,card});log(s,'相手の手札がなかった','sys');break;}
      s.known[p]=new Set(op.hand);
      const c=await choose([...op.hand],'相手の手札から捨てさせるカード',{reveal:true});
      removeFromHand(s,o,c);s.discard.push(c);ev(s,'snipe',{who:p,card:c,seen:[...op.hand,c]});log(s,`${s.names[o]}の「${NAME(c)}」が捨て札になった`,'hit');break;}
  }
}

// ===================== ルールベースCPU =====================
function view(s,p){
  const me=s.players[p],op=s.players[1-p];
  const seen=new Set([...me.hand,...me.field,...op.field,...s.discard]);if(s.limbo!=null)seen.add(s.limbo);
  const unseen=[...Array(16).keys()].filter(c=>!seen.has(c));
  const known=s.known[p];
  const pool=unseen.filter(c=>!known.has(c));
  const slots=Math.max(0,op.hand.length-known.size);
  return{me,op,unseen,known,
    H:c=>me.hand.includes(c),myF:c=>me.field.includes(c),opF:c=>op.field.includes(c),inDisc:c=>s.discard.includes(c),
    isUnseen:c=>unseen.includes(c),
    pOpp:c=>known.has(c)?1:(!unseen.includes(c)?0:(pool.length?slots/pool.length:0))};
}
function cardValue(s,p,c){
  const v=view(s,p);
  const base=[7,4,8,5,4,8,9,6,5,4,6,6,3,3,6,5];let x=base[c];
  if(c===HARA&&v.H(IDEYON))x+=2;
  if(c===IDEYON&&v.H(HARA))x+=3;
  if(c===YOMI&&v.inDisc(HARA))x+=4;
  if(c===KNIFE){if(v.op.life<=2)x+=3;if(v.opF(GOB))x-=4;}
  if(c===KODOMO&&v.opF(GOB))x-=2;
  if(c===MAJO&&s.stock===0)x-=4;
  if(c===SUISHO&&v.known.size)x+=3;
  if((c===OWAKARE||c===IREKAE)&&v.opF(HARA))x+=5;
  return x;
}
function threatValue(s,p,c){
  const v=view(s,p);const myHaraPlan=v.H(HARA)||v.myF(HARA);
  const t={[HARA]:9,[OWAKARE]:myHaraPlan?9:6,[IREKAE]:7,[KNIFE]:v.me.life<=2&&!v.myF(GOB)?9:6,[GOB]:7,[IDEYON]:5,[YOMI]:v.inDisc(HARA)?8:4,[KODOMO]:4,[MAJO]:5,[GIN]:5,[KARASU]:5,[MEGANE]:5,[FUKIYA]:4,[SAND]:4,[KURO]:3,[SUISHO]:3};
  if(c===IDEYON&&v.known.has(HARA))return 8;
  return t[c];
}
function landingRoute(s,p,v,left){
  const H=v.H,P=(card,intent,target)=>({card,intent,target});
  if(v.myF(HARA)||v.opF(HARA))return null;
  if(H(IDEYON)&&H(HARA))return P(IDEYON,'land',HARA);
  if(H(YOMI)&&v.inDisc(HARA))return P(YOMI,'land',HARA);
  if(H(IREKAE)&&v.myF(KODOMO))return P(IREKAE,'land');
  if(left>=2){
    if(H(IREKAE)&&H(KODOMO))return P(KODOMO,'setup');
    if(H(KARASU)&&v.inDisc(HARA)&&H(IDEYON))return P(KARASU,'setup',HARA);
    if(H(MEGANE)&&H(IDEYON)&&v.isUnseen(HARA)&&!v.known.has(HARA))return P(MEGANE,'setup',HARA);
    if(H(SUISHO)&&H(IDEYON)&&v.known.has(HARA))return P(SUISHO,'setup',HARA);
  }
  return null;
}
function cpuPlan(s,p){
  const v=view(s,p),{me,op,H}=v;const left=s.playsAllowed-s.playsUsed;
  const P=(card,intent,target)=>({card,intent,target});
  const oppGob=v.opF(GOB),myGob=v.myF(GOB),knifeOK=!oppGob;
  // A. 今すぐ勝てるか
  if(knifeOK&&op.life<=2&&H(KNIFE))return P(KNIFE,'lethal');
  if(knifeOK&&op.life<=2&&H(KARASU)&&v.inDisc(KNIFE)&&left>=2)return P(KARASU,'lethal',KNIFE);
  if(knifeOK&&op.life<=4&&H(KNIFE)&&H(KARASU)&&left>=3)return P(KNIFE,'lethal');
  if(knifeOK&&op.life<=4&&H(SAND)&&H(KNIFE)&&H(KARASU)&&left===2)return P(SAND,'lethal');
  if(knifeOK&&op.life<=2&&H(MEGANE)&&left>=2&&v.isUnseen(KNIFE)&&!v.known.has(KNIFE))return P(MEGANE,'lethal',KNIFE);
  // B. 相手のはらぺこへの緊急対処
  if(v.opF(HARA)){
    if(H(OWAKARE))return P(OWAKARE,'answer',HARA);
    if(H(IREKAE))return P(IREKAE,'answer');
    const ans=[OWAKARE,IREKAE];
    if(H(KARASU)&&left>=2){const t=ans.find(v.inDisc);if(t!=null)return P(KARASU,'answer',t);}
    if(H(MEGANE)&&left>=2){const t=ans.find(c=>v.isUnseen(c)&&!v.known.has(c));if(t!=null)return P(MEGANE,'answer',t);}
    if(H(SUISHO)&&left>=2){const t=ans.filter(c=>v.pOpp(c)>0).sort((a,b)=>v.pOpp(b)-v.pOpp(a))[0];if(t!=null)return P(SUISHO,'answer',t);}
    if(H(SAND)&&left===1&&(H(KARASU)||H(MEGANE)||H(SUISHO)||H(GIN)))return P(SAND,'answer');
    if(H(KURO))return P(KURO,'dig');
    if(H(GIN)&&left>=2)return P(GIN,'dig');
  }
  // C. こどもで負けそうなとき
  if(v.opF(KODOMO)&&!myGob&&me.life<=1){
    if(H(GOB))return P(GOB,'defend');
    if(H(OWAKARE))return P(OWAKARE,'defend',KODOMO);
    if(H(YOMI)&&v.inDisc(GOB))return P(YOMI,'defend',GOB);
  }
  // D. はらぺこ着地（書2枚以上で確実に通す / 相手の書0）
  const canForce=me.chips>=2||op.chips===0;
  const route=landingRoute(s,p,v,left);
  if(route&&canForce&&!v.opF(HARA)){
    if(H(GOB)&&!myGob&&left>=2&&route.intent==='land')return P(GOB,'setup');
    if(H(SAND)&&s.playsUsed===0&&left>=1)return P(SAND,'setup');
    return route;
  }
  // E. 砂時計は1枚目に
  const useful=[KNIFE,GIN,MAJO,FUKIYA,KODOMO,GOB].filter(c=>H(c)&&(c!==KNIFE||knifeOK)&&(c!==MAJO||s.stock>0)&&(c!==KODOMO||(!oppGob&&!v.myF(KODOMO)))&&(c!==GOB||!myGob)).length;
  if(H(SAND)&&s.playsUsed===0&&useful>=2)return P(SAND,'tempo');
  // F. ドロー
  if(H(GIN))return P(GIN,'draw');
  // G. 盤面
  if(H(GOB)&&!myGob)return P(GOB,'board');
  if(H(KODOMO)&&!oppGob&&!v.myF(KODOMO))return P(KODOMO,'board');
  if(oppGob&&H(OWAKARE)&&H(IREKAE))return P(OWAKARE,'remove',GOB);
  if(v.opF(KODOMO)&&!myGob&&H(OWAKARE)&&(H(IREKAE)||me.life<=2))return P(OWAKARE,'remove',KODOMO);
  // H. 圧力のナイフ（相手に書を使わせる）
  if(H(KNIFE)&&knifeOK)return P(KNIFE,'pressure');
  if(H(MAJO)&&s.stock>0)return P(MAJO,'chip');
  if(H(FUKIYA)&&op.hand.length>=2)return P(FUKIYA,'disrupt');
  if(H(SUISHO)){const t=[...v.known].sort((a,b)=>threatValue(s,p,b)-threatValue(s,p,a))[0];if(t!=null&&threatValue(s,p,t)>=5)return P(SUISHO,'steal',t);}
  if(route&&!canForce&&op.chips>=1&&me.chips>=1&&H(IDEYON)&&!H(HARA)&&left>=1&&s.rng()<0.3)return P(IDEYON,'bluff');
  if(H(MEGANE)&&s.deck.length)return P(MEGANE,'search');
  if(H(KARASU)&&s.discard.length){const t=[...s.discard].sort((a,b)=>cardValue(s,p,b)-cardValue(s,p,a))[0];if(cardValue(s,p,t)>=6)return P(KARASU,'recover',t);}
  if(H(KURO)&&me.hand.length>=3)return P(KURO,'filter');
  if(H(YOMI)&&v.inDisc(GOB))return P(YOMI,'board',GOB);
  if(H(YOMI)&&v.inDisc(KODOMO)&&!oppGob&&!v.myF(KODOMO))return P(YOMI,'board',KODOMO);
  return null;
}
function simIrekae(s,p){
  const a=locate(s,KODOMO),b=locate(s,HARA);if(!a||!b)return{};
  return{opGetsHara:a.kind==='field'&&a.owner===1-p,meLosesHara:b.kind==='field'&&b.owner===p};
}
function cpuNegate(s,p,card){
  const v=view(s,p),{me,op}=v;if(me.chips<1)return false;
  const ans=v.H(OWAKARE)||v.H(IREKAE);
  switch(card){
    case KNIFE:if(v.myF(GOB))return false;if(me.life<=2)return true;return me.chips>=3||(me.chips>=2&&v.H(MAJO)&&s.stock>0);
    case IDEYON:{if(v.myF(HARA)||v.opF(HARA))return false;const ph=v.pOpp(HARA);if(ph===0)return false;if(v.known.has(HARA))return true;return ans?ph>=0.6:ph>=0.3;}
    case YOMI:if(v.inDisc(HARA))return !ans||me.chips>=2;return v.inDisc(GOB)&&me.chips>=2&&(v.myF(KODOMO)||v.H(KNIFE));
    case IREKAE:{const r=simIrekae(s,p);return !!(r.opGetsHara||r.meLosesHara);}
    case OWAKARE:if(v.myF(HARA))return true;return v.myF(GOB)&&me.chips>=2&&(v.myF(KODOMO)||v.H(KNIFE)||v.opF(KODOMO));
    case KODOMO:return !v.myF(GOB)&&me.life<=2&&me.chips>=2;
    case GOB:return me.chips>=2&&(v.myF(KODOMO)||v.H(KNIFE)||v.H(KODOMO));
    case SUISHO:return [...s.known[1-p]].some(c=>me.hand.includes(c)&&cardValue(s,p,c)>=7);
    case GIN:return s.turnCount<=2&&me.chips>=2&&v.H(MAJO)&&s.stock>0;
    case FUKIYA:return me.chips>=3;
    default:return false;
  }
}
function makeCPU(){
  const ag={plan:null};
  ag.choosePlay=(s,p)=>{ag.plan=cpuPlan(s,p);return ag.plan;};
  ag.decideNegate=(s,p,card)=>cpuNegate(s,p,card);
  ag.decideCounter=(s,p,card,intent)=>['land','answer','lethal','defend'].includes(intent);
  ag.chooseCard=(s,p,opts,ctx)=>{
    const t=ag.plan&&ag.plan.card===ctx.card?ag.plan.target:null;
    if(t!=null&&opts.includes(t))return t;
    const v=view(s,p);
    if(ctx.card===OWAKARE){const pref=[HARA,KODOMO,GOB].filter(c=>v.opF(c)&&opts.includes(c));if(pref.length)return pref[0];return opts[0];}
    if(ctx.card===IDEYON||ctx.card===YOMI){for(const c of [HARA,GOB,KODOMO])if(opts.includes(c)&&!(c===KODOMO&&v.opF(GOB)))return c;return opts[0];}
    if(ctx.card===FUKIYA)return [...opts].sort((a,b)=>threatValue(s,p,b)-threatValue(s,p,a))[0];
    return [...opts].sort((a,b)=>cardValue(s,p,b)-cardValue(s,p,a))[0];
  };
  ag.chooseDiscard=(s,p,n)=>[...s.players[p].hand].sort((a,b)=>cardValue(s,p,a)-cardValue(s,p,b)).slice(0,n);
  ag.declareName=(s,p)=>{
    const t=ag.plan&&ag.plan.card===SUISHO?ag.plan.target:null;if(t!=null)return t;
    const v=view(s,p);return [...Array(16).keys()].filter(c=>c!==SUISHO).sort((a,b)=>v.pOpp(b)*threatValue(s,p,b)-v.pOpp(a)*threatValue(s,p,a))[0];
  };
  return ag;
}
function makeRandom(){
  const r=a=>a[Math.floor(Math.random()*a.length)];
  return{choosePlay:(s,p)=>{const h=s.players[p].hand.filter(c=>c!==HARA);if(!h.length||Math.random()<0.15)return null;return{card:r(h)};},
    decideNegate:()=>Math.random()<0.3,decideCounter:()=>Math.random()<0.5,
    chooseCard:(s,p,o)=>r(o),chooseDiscard:(s,p,n)=>shuffle([...s.players[p].hand],Math.random).slice(0,n),declareName:()=>Math.floor(Math.random()*16)};
}
