// 保存した対戦データ（data/games_ai6_6000.jsonl.gz）を、同じシードで対戦し直して照合する。
// エンジン・AI6・確定手ルールのどれかの挙動が変わると不一致が出る。
// 使い方: node tests/regression.js [局数=300]
const fs=require('fs'),zlib=require('zlib'),path=require('path');const {mulberry32}=require('../tools/rec_lib.js');const A=require('../app/load_all.js');
const N=+process.argv[2]||300;
const L=zlib.gunzipSync(fs.readFileSync(path.join(__dirname,'../data/games_ai6_6000.jsonl.gz'))).toString().split('\n').slice(1,N+1).map(JSON.parse);
const net=A.rlLoad(A.RL_WEIGHTS6);const mk=()=>A.withRules(A.makeRL(net));
(async()=>{let bad=[];for(const g of L){const s=A.newGame(g.first,mulberry32(g.seed),['P0','P1']);const w=await A.runGame(s,[mk(),mk()]);
 if(w!==g.winner||JSON.stringify(s.ev)!==JSON.stringify(g.ev))bad.push(g.seed);}
 console.log(`照合 ${L.length}局、不一致 ${bad.length}局`,bad.slice(0,10).join(' '));process.exit(bad.length?1:0);})();
