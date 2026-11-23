// 使い方: node replay.js data/games_ai6_6000.jsonl.gz <seed>
// 保存した seed と first で対戦をやり直し、画面と同じ文章ログを出す。保存した構造化ログと一致するかも確かめる
const fs=require('fs'),zlib=require('zlib');const {mulberry32}=require('./rec_lib.js');const A=require('../app/load_all.js');
const [F,SEED]=[process.argv[2],+process.argv[3]];
const g=zlib.gunzipSync(fs.readFileSync(F)).toString().split('\n').slice(1).filter(Boolean).map(JSON.parse).find(x=>x.seed===SEED);
const L6=A.rlLoad(A.RL_WEIGHTS6);const mk=()=>A.withRules(A.makeRL(L6));
(async()=>{const s=A.newGame(g.first,mulberry32(g.seed),['P0','P1']);const w=await A.runGame(s,[mk(),mk()]);
 s.log.forEach(e=>console.log(e.msg));
 console.error(JSON.stringify(s.ev)===JSON.stringify(g.ev)&&w===g.winner?'保存したログと一致':'不一致');})();
