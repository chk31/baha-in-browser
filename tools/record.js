// 使い方: node record.js 6000 games_ai6.jsonl.gz [開始シード=1]
// 1行=1局のJSON。seed と first があれば同じ対戦を再現できる（AI6は乱数を使わない）
const fs=require('fs'),zlib=require('zlib');const {mulberry32}=require('./rec_lib.js');const A=require('../app/load_all.js');
const N=+process.argv[2]||6000,OUT=process.argv[3]||'games_ai6.jsonl.gz',S0=+process.argv[4]||1;
const L6=A.rlLoad(A.RL_WEIGHTS6);const mk=()=>A.withRules(A.makeRL(L6));
(async()=>{const gz=zlib.createGzip();const fo=fs.createWriteStream(OUT);gz.pipe(fo);
 gz.write(JSON.stringify({header:true,version:1,agents:['AI6+rules','AI6+rules'],cards:A.CARDS.map(c=>c.name),
   note:'seed: mulberry32の種, first: 先攻(0/1), ev: 構造化イベント列, winner: 勝者'})+'\n');
 const t0=Date.now();
 for(let i=0;i<N;i++){const seed=S0+i,first=i%2;const s=A.newGame(first,mulberry32(seed),['P0','P1']);
  const w=await A.runGame(s,[mk(),mk()]);
  gz.write(JSON.stringify({seed,first,winner:w,turns:s.turnCount,ev:s.ev})+'\n');
  if(i%1000===999)console.error(i+1,((Date.now()-t0)/1000).toFixed(0)+'s');}
 gz.end();fo.on('finish',()=>console.error('done',OUT,(fs.statSync(OUT).size/1e6).toFixed(1)+'MB'));})();
