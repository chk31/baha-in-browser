// ===== オンライン対戦（合言葉で入室・ホストが進行役） =====
// 設計は docs/ONLINE_PLAN.md、使い方と設定は docs/ONLINE.md。
// ・部屋を作った側（ホスト）がエンジンを動かす：runGame(s,[human, 通信エージェント])。エンジンの中では ホスト=0、ゲスト=1。
// ・ゲストはエンジンを動かさない。ホストから届く「ゲストに見える状態」を、自分が players[0] になる向きに並べて画面を描き、
//   聞かれた判断を human（CPU対戦と同じ画面）で答えて返す。
// ・通信は Firebase Realtime Database（FIREBASE_CONFIG があるとき）か PeerJS（WebRTC）。?net=peer / firebase / local で選べる（local は同じブラウザの別タブ同士。試験用）。
const NET_VER=1;
const CODE_CH='ABCDEFGHJKMNPQRSTUVWXYZ23456789';   // 紛らわしい I・L・O・0・1 は使わない
const PEER_PREFIX='harapeko-bahamut-v1-';
const NET={tr:null,room:null,role:null,code:null,seqOut:0,seqIn:0,lastIn:0,timer:null,askId:0,pending:new Map(),queue:Promise.resolve(),logSent:0,lost:false,upd:null,epoch:0};

function netMode(){
  let q=null;try{q=new URLSearchParams(location.search).get('net');}catch(e){}
  if(q==='peer'||q==='local')return q;
  if(q==='firebase'&&FIREBASE_CONFIG)return 'firebase';
  return FIREBASE_CONFIG?'firebase':'peer';
}
function newCode(){const a=new Uint32Array(5);crypto.getRandomValues(a);return [...a].map(x=>CODE_CH[x%CODE_CH.length]).join('');}
const normCode=t=>String(t||'').normalize('NFKC').toUpperCase().replace(/[^A-Z0-9]/g,'');
function loadScript(src){return new Promise((res,rej)=>{const e=document.createElement('script');e.src=src;e.onload=res;e.onerror=()=>rej(new Error('通信用の部品を読み込めませんでした'));document.head.appendChild(e);});}
const withTimeout=(p,ms,msg)=>Promise.race([p,new Promise((_,rej)=>setTimeout(()=>rej(new Error(msg)),ms))]);

// ---------- 通信（どの方式も {onMsg, onClose, send, close} の形にそろえる） ----------
function mkTransport(kind,sendRaw,closeRaw){
  const t={kind,_m:null,_c:null,dead:false,buf:[],   // 受け手が決まる前に届いたものは buf にためておく
    onMsg(f){t._m=f;const b=t.buf;t.buf=[];b.forEach(o=>f(o));},onClose(f){t._c=f;},
    send(o){if(!t.dead)try{sendRaw(o);}catch(e){console.warn(e);}},
    close(){if(t.dead)return;t.dead=true;try{closeRaw();}catch(e){}},
    _in(o){if(t.dead)return;if(t._m)t._m(o);else t.buf.push(o);},_closed(){if(!t.dead&&t._c)t._c();}};
  return t;
}
// PeerJS（WebRTC）
async function peerLib(){if(!window.Peer)await loadScript('https://cdn.jsdelivr.net/npm/peerjs@1.5.4/dist/peerjs.min.js');return window.Peer;}
function peerWrap(conn,peer){
  const t=mkTransport('peer',o=>conn.send(o),()=>{conn.close();peer.destroy();});
  conn.on('data',d=>t._in(d));conn.on('close',()=>t._closed());conn.on('error',()=>t._closed());
  return t;
}
async function peerHost(code,onConn){
  const Peer=await peerLib();
  return new Promise((res,rej)=>{
    const peer=new Peer(PEER_PREFIX+code);let opened=false;
    peer.on('open',()=>{opened=true;res({close(){try{peer.destroy();}catch(e){}}});});
    peer.on('error',e=>{if(!opened)rej(e);});
    peer.on('disconnected',()=>{if(!peer.destroyed)try{peer.reconnect();}catch(e){}});
    peer.on('connection',conn=>conn.on('open',()=>onConn(peerWrap(conn,peer),()=>conn.close())));
  });
}
async function peerJoin(code){
  const Peer=await peerLib();
  return withTimeout(new Promise((res,rej)=>{
    const peer=new Peer();
    peer.on('error',e=>{try{peer.destroy();}catch(x){}rej(e.type==='peer-unavailable'?new Error('部屋が見つかりません。合言葉を確かめてください'):e);});
    peer.on('open',()=>{const conn=peer.connect(PEER_PREFIX+code,{reliable:true});conn.on('open',()=>res(peerWrap(conn,peer)));});
  }),20000,'つながりませんでした（時間切れ）。回線を変えて（Wi-Fi など）試してください');
}
// Firebase Realtime Database。rooms/<合言葉>/{created,guest,h2g,g2h}。メッセージは JSON 文字列で入れる（空の配列が消えないように）
async function fbDB(){
  if(!window.firebase||!firebase.database){
    await loadScript('https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js');
    await loadScript('https://www.gstatic.com/firebasejs/10.14.1/firebase-database-compat.js');
  }
  if(!firebase.apps.length)firebase.initializeApp(FIREBASE_CONFIG);
  return firebase.database();
}
function fbWrap(room,outKey,inKey){
  const out=room.child(outKey),inp=room.child(inKey);
  const t=mkTransport('firebase',o=>out.push({d:JSON.stringify(o)}),()=>inp.off());
  inp.on('child_added',sn=>{const v=sn.val();if(v&&v.d)try{t._in(JSON.parse(v.d));}catch(e){}});
  try{out.push().onDisconnect().set({d:JSON.stringify({t:'bye',s:1e9})});}catch(e){}
  return t;
}
async function fbHost(code,onConn){
  const db=await fbDB();const room=db.ref('rooms/'+code);
  const r=await withTimeout(room.transaction(cur=>cur&&cur.created>Date.now()-6*3600e3?undefined:{created:Date.now()}),15000,'サーバーにつながりませんでした');
  if(!r.committed){const e=new Error('used');e.type='unavailable-id';throw e;}
  let got=false;
  const g2h=room.child('g2h');
  const first=sn=>{const v=sn.val();let m=null;try{m=JSON.parse(v.d);}catch(e){}
    if(got||!m||m.t!=='hello')return;got=true;g2h.off('child_added',first);
    const t=fbWrap(room,'h2g','g2h');onConn(t,()=>{});};   // fbWrap が g2h を最初から読み直すので hello も届く
  g2h.on('child_added',first);
  return{close(){g2h.off('child_added',first);},remove(){room.remove().catch(()=>{});}};
}
async function fbJoin(code){
  const db=await fbDB();const room=db.ref('rooms/'+code);
  const sn=await withTimeout(room.child('created').get(),15000,'サーバーにつながりませんでした');
  if(!sn.exists())throw new Error('部屋が見つかりません。合言葉を確かめてください');
  const r=await room.child('guest').transaction(cur=>cur?undefined:Date.now());
  if(!r.committed)throw new Error('この部屋はもう対戦相手が入っています');
  return fbWrap(room,'g2h','h2g');
}
// local：同じブラウザの別タブ（BroadcastChannel）。動作確認用
function localHost(code,onConn){
  const bc=new BroadcastChannel('hb-'+code);let got=false;
  bc.onmessage=e=>{const m=e.data;if(m.to!=='h')return;
    if(!got&&m.o&&m.o.t==='hello'){got=true;const t=mkTransport('local',o=>bc.postMessage({to:'g',o}),()=>bc.close());bc.onmessage=e2=>{if(e2.data.to==='h')t._in(e2.data.o);};onConn(t,()=>{});t._in(m.o);}};
  return Promise.resolve({close(){if(!got)bc.close();}});
}
function localJoin(code){
  const bc=new BroadcastChannel('hb-'+code);
  const t=mkTransport('local',o=>bc.postMessage({to:'h',o}),()=>bc.close());
  bc.onmessage=e=>{if(e.data.to==='g')t._in(e.data.o);};
  return Promise.resolve(t);
}
const NET_IMPL={peer:{host:peerHost,join:peerJoin},firebase:{host:fbHost,join:fbJoin},local:{host:localHost,join:localJoin}};

// ---------- 送受信の共通処理 ----------
function netSend(o){if(NET.tr)NET.tr.send({...o,s:++NET.seqOut});}
function netAttach(tr,onMsg){
  NET.tr=tr;NET.lost=false;NET.seqIn=0;NET.lastIn=Date.now();
  tr.onMsg(m=>{if(!m||typeof m!=='object')return;
    if(typeof m.s==='number'){if(m.s<=NET.seqIn)return;NET.seqIn=m.s;}
    NET.lastIn=Date.now();netInfo(null);
    if(m.t==='ping')return;
    if(m.t==='bye'){netLost('相手が退出しました');return;}
    onMsg(m);});
  tr.onClose(()=>netLost('相手との通信が切れました'));
  clearInterval(NET.timer);
  NET.timer=setInterval(()=>{if(!NET.tr)return;netSend({t:'ping'});
    const q=Date.now()-NET.lastIn;
    if(q>45000)netLost('相手から応答がありません。通信が切れました');
    else if(q>12000)netInfo('相手からの応答を待っています…（通信が不安定です）');},4000);
}
function netInfo(msg){let el=$('netInfo');
  if(!el){el=document.createElement('div');el.id='netInfo';document.body.appendChild(el);}
  el.textContent=msg||'';el.style.display=msg?'block':'none';}
// 通信が切れた：進行中の対戦を止めて知らせる
function netLost(msg){
  if(NET.lost||!G.online)return;NET.lost=true;
  const tr=NET.tr;NET.tr=null;if(tr)tr.close();clearInterval(NET.timer);netInfo(null);document.body.classList.remove('netwait');
  for(const p of NET.pending.values())p.rej(new Error('abort'));NET.pending.clear();
  const ended=G.s&&G.s.winner!=null;
  modal(`<h2>${esc(msg)}</h2><p>${ended?'対戦は終わっています。':'対戦は中断しました。'}</p><div class="btns"><button class="pri" data-x>タイトルへ</button></div>`,
    (r,close)=>r.querySelector('[data-x]').onclick=()=>{close();startScreen();},'refRoot');
}
// 部屋を出る（タイトルへ戻るときに必ず呼ぶ）
function netLeave(){
  if(NET.tr){NET.tr.send({t:'bye',s:++NET.seqOut});NET.tr.close();}
  if(NET.room){try{NET.room.close();if(NET.room.remove)NET.room.remove();}catch(e){}}
  clearInterval(NET.timer);
  for(const p of NET.pending.values())p.rej(new Error('abort'));NET.pending.clear();
  NET.tr=null;NET.room=null;NET.role=null;NET.code=null;NET.queue=Promise.resolve();NET.epoch++;netInfo(null);document.body.classList.remove('netwait');
  G.online=null;$('modalRoot').innerHTML='';
}

// ---------- ホスト側 ----------
// ゲストに見える状態（ゲストが players[0] になる向き）。ホストの手札は枚数だけ、山札は枚数だけ。構造化ログ s.ev は送らない
function guestView(s){
  const g=1,h=0,F=x=>x==null?null:(x===g?0:1),P=s.players;
  return{turn:F(s.turn),first:F(s.first),winner:F(s.winner),turnCount:s.turnCount,playsAllowed:s.playsAllowed,playsUsed:s.playsUsed,
    stock:s.stock,deck:s.deck.length,discard:[...s.discard],
    players:[{hand:[...P[g].hand],field:[...P[g].field],life:P[g].life,chips:P[g].chips},
             {hand:P[h].hand.length,field:[...P[h].field],life:P[h].life,chips:P[h].chips}],
    known:[[...s.known[g]],[...s.known[h]]]};
}
function netStatePayload(s){const from=NET.logSent;NET.logSent=s.log.length;return{v:guestView(s),logFrom:from,log:s.log.slice(from)};}
// 通信エージェント：エンジンからの問い合わせをゲストに送り、返事を待つ（返事は確かめてから使う）
function remoteAgent(s){
  const ask=(kind,args,check)=>new Promise((res,rej)=>{
    if(!NET.tr){rej(new Error('abort'));return;}
    const id=++NET.askId;NET.pending.set(id,{res:v=>res(check(v)),rej});
    netInfo(null);document.body.classList.add('netwait');
    netSend({t:'ask',id,kind,args,...netStatePayload(s)});
  });
  const me=()=>s.players[1];
  return{
    choosePlay:(s_,p)=>ask('choosePlay',[],v=>v&&me().hand.includes(v.card)&&v.card!==HARA?{card:v.card}:null),
    decideNegate:(s_,p,card)=>ask('decideNegate',[card],v=>!!v),
    decideCounter:(s_,p,card)=>ask('decideCounter',[card],v=>!!v),
    chooseCard:(s_,p,opts,ctx)=>ask('chooseCard',[[...opts],{card:ctx.card,purpose:ctx.purpose,reveal:!!ctx.reveal}],v=>opts.includes(v)?v:opts[0]),
    chooseDiscard:(s_,p,n,purpose,card)=>ask('chooseDiscard',[n,purpose,card],v=>{const h=me().hand;
      return Array.isArray(v)&&v.length===n&&new Set(v).size===n&&v.every(c=>h.includes(c))?v:h.slice(0,n);}),
    declareName:(s_,p)=>ask('declareName',[],v=>Number.isInteger(v)&&v>=0&&v<16&&v!==SUISHO?v:KNIFE),
  };
}
function netHostMsg(m){
  if(m.t==='hello'){
    if(m.v!==NET_VER){netSend({t:'oldver'});return;}
    if(!G.s)netHostStart();
    return;
  }
  if(m.t==='answer'){const p=NET.pending.get(m.id);if(p){NET.pending.delete(m.id);document.body.classList.remove('netwait');p.res(m.value);}}
}
async function netHostStart(){
  $('modalRoot').innerHTML='';$('refRoot').innerHTML='';
  const first=Math.random()<.5?0:1;
  G.online={role:'host',me:0};
  const s=newGame(first,Math.random,NET_NAMES);G.s=s;G.result=null;G.stat={n:0,m:0,k:{}};G.sel=null;G.info=null;G.awaitPlay=null;G.snaps=[];
  NET.logSent=0;
  netSend({t:'start',first:first===1?0:1});
  const upd=makeUpdater(s);
  s.hooks.update=async kind=>{if(G.s===s)netSend({t:'view',kind,...netStatePayload(s)});await upd(kind);};
  render();
  try{
    const w=await runGame(s,[human,remoteAgent(s)]);
    G.result={w,turns:s.turnCount};netSend({t:'end',w:w===1?0:1,turns:s.turnCount});
    render();w===0?sfx.win():sfx.lose();
    await showResult();
  }catch(e){if(e.message!=='abort')console.error(e);}
}
async function netHostLobby(){
  G.online={role:'lobby',me:0};const mode=netMode();const ep=++NET.epoch;
  modal(`<h2>部屋を作る</h2><div id="lobby"><p>部屋を用意しています…</p></div><div class="btns"><button data-x>やめる</button></div>`,
    (r,close)=>{r.querySelector('[data-x]').onclick=()=>{close();startScreen();};});
  const body=()=>$('lobby');
  for(let k=0;k<6;k++){
    const code=newCode();
    try{
      NET.room=await NET_IMPL[mode].host(code,(tr,reject)=>{
        if(NET.tr||ep!==NET.epoch){reject();return;}
        NET.role='host';netAttach(tr,netHostMsg);
      });
      if(ep!==NET.epoch){NET.room.close();if(NET.room.remove)NET.room.remove();NET.room=null;return;}
      NET.code=code;
      if(body())body().innerHTML=`<p>この合言葉を相手に伝えてください。相手が入ると対戦が始まります（先攻・後攻はランダム）。</p>
        <div class="codebig">${code}</div><p style="font-size:12px;color:#555">相手の入室を待っています…</p>`;
      return;
    }catch(e){
      if(ep!==NET.epoch)return;
      if(e&&e.type==='unavailable-id')continue;
      if(body())body().innerHTML=`<p>部屋を作れませんでした：${esc(netErr(e))}</p>`;return;
    }
  }
}
function netErr(e){
  const t=e&&e.type;
  if(t==='network'||t==='server-error'||t==='socket-error'||t==='socket-closed')return '仲介サーバーにつながりません。時間をおいて試してください';
  if(t==='browser-incompatible')return 'このブラウザは対応していません';
  return (e&&e.message)||String(e);
}
// 結果画面（オンライン）
function netShowResult(){const R=G.result;
  const host=G.online&&G.online.role==='host';
  return modal(`<div class="title-big">${R.w===0?'あなたの勝ち！🎉':'相手の勝ち…'}</div><p>${R.turns}ターンで決着。「ログ」で流れを振り返れます。</p>
    ${host?'':'<p style="font-size:12px">部屋を作った人が「もう一度」を押すと、次の対戦が始まります。</p>'}
    <div class="btns">${host?'<button class="pri" data-a>もう一度（同じ相手と）</button>':''}<button data-b>盤面を見る</button><button data-q>退出</button></div>`,
    (r,close)=>{if(host)r.querySelector('[data-a]').onclick=()=>{close();if(NET.tr)netHostStart();};
      r.querySelector('[data-b]').onclick=()=>close();r.querySelector('[data-q]').onclick=()=>{close();startScreen();};});
}

// ---------- ゲスト側 ----------
function netGuestMsg(m){
  const ep=NET.epoch;
  NET.queue=NET.queue.then(()=>ep===NET.epoch&&netGuestHandle(m)).catch(e=>{if(e&&e.message!=='abort')console.error(e);});
}
function newPseudoState(){
  return{players:[{hand:[],field:[],life:4,chips:2},{hand:[],field:[],life:4,chips:2}],known:[new Set(),new Set()],
    deck:[],discard:[],stock:2,turn:0,first:0,turnCount:0,playsAllowed:0,playsUsed:0,winner:null,log:[],hooks:{}};
}
function applyView(m){
  const s=G.s,v=m.v;if(!s||!v)return;
  for(const k of ['turn','first','winner','turnCount','playsAllowed','playsUsed','stock'])s[k]=v[k];
  s.deck=new Array(v.deck).fill(-1);s.discard=v.discard;
  s.players[0]={...v.players[0]};s.players[1]={...v.players[1],hand:new Array(v.players[1].hand).fill(-1)};
  s.known=[new Set(v.known[0]),new Set(v.known[1])];
  if(Array.isArray(m.log)&&m.logFrom===s.log.length)s.log.push(...m.log);
}
async function netGuestHandle(m){
  switch(m.t){
    case 'oldver':netLost('相手とアプリの版が違います。両方ともページを読み込み直してください');return;
    case 'start':{
      $('modalRoot').innerHTML='';$('refRoot').innerHTML='';
      G.online={role:'guest',me:1};
      const s=newPseudoState();s.first=m.first;G.s=s;G.result=null;G.stat={n:0,m:0,k:{}};G.sel=null;G.info=null;G.awaitPlay=null;G.snaps=[];
      NET.upd=makeUpdater(s);render();return;}
    case 'view':if(!G.s)return;applyView(m);await NET.upd(m.kind);return;
    case 'ask':{
      if(!G.s)return;applyView(m);render();
      const s=G.s,a=m.args||[];let v;
      switch(m.kind){
        case 'choosePlay':v=await human.choosePlay(s,0);break;
        case 'decideNegate':v=await human.decideNegate(s,0,a[0]);break;
        case 'decideCounter':v=await human.decideCounter(s,0,a[0]);break;
        case 'chooseCard':v=await human.chooseCard(s,0,a[0],a[1]);break;
        case 'chooseDiscard':v=await human.chooseDiscard(s,0,a[0],a[1],a[2]);break;
        case 'declareName':v=await human.declareName(s,0);break;
        default:return;
      }
      if(G.s===s)netSend({t:'answer',id:m.id,value:v===undefined?null:v});
      return;}
    case 'end':{
      if(!G.s)return;G.result={w:m.w,turns:m.turns};render();m.w===0?sfx.win():sfx.lose();
      showResult();return;}
  }
}
function netJoinLobby(){
  G.online={role:'lobby',me:1};const mode=netMode();const ep=++NET.epoch;
  modal(`<h2>部屋に入る</h2><p>相手から聞いた合言葉（英数字5文字）を入れてください。</p>
    <input class="codein" id="codeIn" maxlength="8" autocomplete="off" autocorrect="off" autocapitalize="characters" spellcheck="false" inputmode="text" placeholder="ABC23">
    <p id="joinMsg" style="min-height:1.4em"></p>
    <div class="btns"><button class="pri" data-go>入る</button><button data-x>もどる</button></div>`,
    (r,close)=>{
      const inp=r.querySelector('#codeIn'),msg=r.querySelector('#joinMsg'),go=r.querySelector('[data-go]');
      r.querySelector('[data-x]').onclick=()=>{close();startScreen();};
      inp.oninput=()=>{const c=normCode(inp.value);if(c!==inp.value)inp.value=c;};
      const join=async()=>{
        const code=normCode(inp.value);
        if(code.length!==5||[...code].some(c=>!CODE_CH.includes(c))){msg.textContent='合言葉は英数字5文字です（I・L・O・0・1 は使いません）';return;}
        go.disabled=true;inp.disabled=true;msg.textContent='つないでいます…';
        try{
          const tr=await NET_IMPL[mode].join(code);
          if(ep!==NET.epoch){tr.close();return;}
          NET.role='guest';NET.code=code;netAttach(tr,netGuestMsg);
          netSend({t:'hello',v:NET_VER});
          msg.textContent='入室しました。対戦の開始を待っています…';
          if(mode==='local')setTimeout(()=>{if(ep===NET.epoch&&!G.s&&NET.tr&&NET.seqIn===0){NET.tr.close();NET.tr=null;msg.textContent='部屋が見つかりません。合言葉を確かめてください';go.disabled=false;inp.disabled=false;}},4000);
        }catch(e){if(ep!==NET.epoch)return;msg.textContent=netErr(e);go.disabled=false;inp.disabled=false;}
      };
      go.onclick=join;inp.onkeydown=e=>{if(e.key==='Enter')join();};
      setTimeout(()=>inp.focus(),50);
    });
}
// ページを閉じる・移動するときは、相手にすぐ知らせる
window.addEventListener('pagehide',()=>{if(NET.tr)NET.tr.send({t:'bye',s:++NET.seqOut});});
