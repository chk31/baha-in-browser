// ===== 対戦記録の保存（GitHub Pages 版） =====
// ・1局ごとの記録を、この端末のブラウザ（localStorage）に残す →「過去の記録」と勝率バッジに使う。
// ・GitHub の鍵（このリポジトリだけに書き込める fine-grained トークン）を設定した端末では、
//   記録を GitHub の records ブランチの records/年/月/<id>.json に1局1ファイルで保存する。
//   鍵はこの端末のブラウザの中だけに置く（ページには埋め込まない）。送れなかった記録は、次に開いたときに送り直す。
// 詳しくは docs/RECORDS.md。
const REC_LOCAL_KEY='hb_records',REC_PENDING_KEY='hb_rec_pending',GH_KEY='hb_gh';
const REC_LOCAL_MAX=300,REC_PENDING_MAX=50;
const lsGet=(k,d)=>{try{const v=localStorage.getItem(k);return v?JSON.parse(v):d;}catch(e){return d;}};
const lsSet=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v));return true;}catch(e){return false;}};

// 既定の保存先：GitHub Pages（<owner>.github.io/<repo>/）で開いていればそのリポジトリ
function ghDefaultRepo(){
  try{const h=location.hostname;if(h.endsWith('.github.io')){const r=location.pathname.split('/').filter(Boolean)[0];if(r)return h.split('.')[0]+'/'+r;}}catch(e){}
  return 'chk31/baha-in-browser';
}
function ghCfg(){const c=lsGet(GH_KEY,null);return c&&c.token?{repo:c.repo||ghDefaultRepo(),branch:c.branch||'records',token:c.token}:null;}
async function ghReq(cfg,method,path,body){
  const r=await fetch('https://api.github.com/repos/'+cfg.repo+path,{method,
    headers:{Authorization:'Bearer '+cfg.token,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28',...(body?{'Content-Type':'application/json'}:{})},
    body:body?JSON.stringify(body):undefined});
  let j=null;try{j=await r.json();}catch(e){}
  return{status:r.status,ok:r.ok,j};
}
function ghErrText(st,j){
  if(st===401)return '鍵が正しくないか、期限が切れています';
  if(st===403)return '鍵に書き込みの権限がありません（Contents: Read and write が必要）';
  if(st===404)return 'リポジトリが見つかりません（名前か、鍵の対象リポジトリを確認）';
  return `GitHub のエラー（${st}${j&&j.message?'：'+j.message:''}）`;
}
// 保存先のブランチが無ければ、既定ブランチの先端から作る
async function ghEnsureBranch(cfg){
  const b=await ghReq(cfg,'GET','/branches/'+encodeURIComponent(cfg.branch));
  if(b.ok)return;
  if(b.status!==404)throw new Error(ghErrText(b.status,b.j));
  const repo=await ghReq(cfg,'GET','');if(!repo.ok)throw new Error(ghErrText(repo.status,repo.j));
  const ref=await ghReq(cfg,'GET','/git/ref/heads/'+encodeURIComponent(repo.j.default_branch));if(!ref.ok)throw new Error(ghErrText(ref.status,ref.j));
  const mk=await ghReq(cfg,'POST','/git/refs',{ref:'refs/heads/'+cfg.branch,sha:ref.j.object.sha});
  if(!mk.ok&&mk.status!==422)throw new Error(ghErrText(mk.status,mk.j));
}
function b64utf8(str){const b=new TextEncoder().encode(str);let s='';for(let i=0;i<b.length;i+=0x8000)s+=String.fromCharCode.apply(null,b.subarray(i,i+0x8000));return btoa(s);}
const recPath=rec=>`records/${rec.endedAt.slice(0,4)}/${rec.endedAt.slice(5,7)}/${rec.id}.json`;
async function ghPutRecord(cfg,rec){
  const r=await ghReq(cfg,'PUT','/contents/'+recPath(rec),{message:`記録 ${rec.level} ${rec.winner}の勝ち ${rec.turns}T`,content:b64utf8(JSON.stringify(rec)),branch:cfg.branch});
  if(r.ok||r.status===422)return;           // 422＝同じファイルがもうある（送信済み）
  const e=new Error(ghErrText(r.status,r.j));e.status=r.status;throw e;
}
// 未送信の記録を送る。戻り値 {sent, left, error}
let ghFlushing=null;
function ghFlush(){
  if(ghFlushing)return ghFlushing;
  ghFlushing=(async()=>{
    const cfg=ghCfg();let sent=0,error=null;
    if(!cfg)return{sent,left:lsGet(REC_PENDING_KEY,[]).length,error:'GitHub の鍵が設定されていません'};
    try{
      let q=lsGet(REC_PENDING_KEY,[]);
      if(q.length)await ghEnsureBranch(cfg);
      while(q.length){await ghPutRecord(cfg,q[0]);sent++;q=lsGet(REC_PENDING_KEY,[]);q.shift();lsSet(REC_PENDING_KEY,q);}
    }catch(e){error=e.message||String(e);}
    return{sent,left:lsGet(REC_PENDING_KEY,[]).length,error};
  })().finally(()=>{ghFlushing=null;});
  return ghFlushing;
}
// 1局の記録を残す（saveGame から呼ぶ）。rec は全部入り（構造化ログ ev を含む）
function recordGame(rec){
  const {ev,snapshots,...sum}=rec;                       // 端末に残すのは一覧と「過去の記録」に要る分だけ
  const L=lsGet(REC_LOCAL_KEY,[]);L.unshift(sum);
  while(L.length>REC_LOCAL_MAX||(!lsSet(REC_LOCAL_KEY,L)&&L.length>1))L.pop();
  if(!ghCfg())return;
  const q=lsGet(REC_PENDING_KEY,[]);q.push(rec);
  while(q.length>REC_PENDING_MAX||(!lsSet(REC_PENDING_KEY,q)&&q.length>1))q.shift();
  ghFlush().then(r=>{if(r.error)banner('記録をGitHubに送れませんでした（次に開いたとき送り直します）');else if(r.sent)banner('記録をGitHubに保存しました');});
}
const localRecords=()=>lsGet(REC_LOCAL_KEY,[]);
// 書き出したファイル（{games:[…]} か配列）を端末の記録に取り込む。同じ id は飛ばす。戻り値 {added, total}
function importRecordsText(text){
  const d=JSON.parse(text);const arr=Array.isArray(d)?d:d.games;
  if(!Array.isArray(arr))throw new Error('記録のファイルではありません');
  const L=lsGet(REC_LOCAL_KEY,[]),have=new Set(L.map(x=>x.id));let added=0;
  for(const g of arr){if(!g||!g.id||!g.endedAt||have.has(g.id))continue;const {ev,snapshots,...sum}=g;L.push({...sum,snapshots});have.add(g.id);added++;}
  L.sort((a,b)=>(b.endedAt||'').localeCompare(a.endedAt||''));
  while(L.length>REC_LOCAL_MAX||(!lsSet(REC_LOCAL_KEY,L)&&L.length>1))L.pop();
  return{added,total:L.length};
}

// 設定画面
function showGhSettings(onDone){
  const c=lsGet(GH_KEY,{})||{};
  modal(`<h2>記録をGitHubに保存</h2>
    <p>対戦（CPU戦）が終わるたびに、記録を GitHub のリポジトリに1局1ファイルで保存します。鍵は<b>この端末のブラウザの中だけ</b>に保存され、ページや GitHub には書き込まれません。</p>
    <p style="font-size:12px">鍵の作り方：GitHub → Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token。Repository access は「Only select repositories」でこのリポジトリだけ、Permissions の Contents を「Read and write」にする。</p>
    <label class="fl">鍵（github_pat_…）<input class="tin" id="ghTok" type="password" autocomplete="off" spellcheck="false" value="${esc(c.token||'')}"></label>
    <label class="fl">リポジトリ<input class="tin" id="ghRepo" autocomplete="off" spellcheck="false" value="${esc(c.repo||ghDefaultRepo())}"></label>
    <label class="fl">ブランチ<input class="tin" id="ghBr" autocomplete="off" spellcheck="false" value="${esc(c.branch||'records')}"></label>
    <p id="ghMsg" style="min-height:1.4em;font-size:12px"></p>
    <div class="btns"><button class="pri" data-s>保存して接続を確かめる</button></div>
    <div class="btns"><button class="danger" data-d>鍵を消す</button><button data-x>閉じる</button></div>`,
  (r,close)=>{
    const msg=r.querySelector('#ghMsg'),val=id=>r.querySelector(id).value.trim();
    const pend=()=>{const n=lsGet(REC_PENDING_KEY,[]).length;return n?`（未送信 ${n}局）`:'';};
    msg.textContent=(ghCfg()?'設定済み':'未設定')+pend();
    r.querySelector('[data-x]').onclick=()=>{close();if(onDone)onDone();};
    r.querySelector('[data-d]').onclick=()=>{try{localStorage.removeItem(GH_KEY);}catch(e){}r.querySelector('#ghTok').value='';msg.textContent='鍵を消しました。GitHub には保存しません'+pend();};
    r.querySelector('[data-s]').onclick=async()=>{
      const token=val('#ghTok'),repo=val('#ghRepo').replace(/^https?:\/\/github\.com\//,'').replace(/\.git$/,'').replace(/\/+$/,''),branch=val('#ghBr')||'records';
      if(!token){msg.textContent='鍵を入れてください';return;}
      if(!/^[\w.-]+\/[\w.-]+$/.test(repo)){msg.textContent='リポジトリは「持ち主/名前」の形で入れてください';return;}
      const prev=lsGet(GH_KEY,null);
      if(!lsSet(GH_KEY,{token,repo,branch})){msg.textContent='このブラウザでは保存できません（プライベートブラウズ中など）';return;}
      msg.textContent='確かめています…';
      try{
        const cfg=ghCfg();const info=await ghReq(cfg,'GET','');
        if(!info.ok)throw new Error(ghErrText(info.status,info.j));
        await ghEnsureBranch(cfg);
        const f=await ghFlush();
        msg.textContent=f.error?'つながりましたが、送信に失敗：'+f.error:`OK：${repo} の ${branch} ブランチに保存します`+(f.sent?`（未送信だった ${f.sent}局を送りました）`:'');
      }catch(e){   // 確かめられなかった設定は残さない（前の設定に戻す）
        try{if(prev)localStorage.setItem(GH_KEY,JSON.stringify(prev));else localStorage.removeItem(GH_KEY);}catch(x){}
        msg.textContent='失敗（設定は保存していません）：'+(e.message||e);}
    };
  },'refRoot');
}
// 開いたときと、回線が戻ったときに、未送信の記録を送る
if(ghCfg())setTimeout(()=>ghFlush(),3000);
window.addEventListener('online',()=>{if(ghCfg())ghFlush();});
