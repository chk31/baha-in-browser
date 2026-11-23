// すべてのCPU同士で数局ずつ対戦させ、例外なく終わることを確かめる。
const {mulberry32}=require('../tools/rec_lib.js');const A=require('../app/load_all.js');
const W={AI5:A.RL_WEIGHTS5,AI6:A.RL_WEIGHTS6,'AI6.5':A.RL_WEIGHTS65};const N={};for(const k in W)N[k]=A.rlLoad(W[k]);
const mk=n=>n==='ふつう'?A.makeCPU():n==='つよい'?A.makeCPU2():A.withRules(A.makeRL(N[n]));
const M=['ふつう','つよい','AI5','AI6','AI6.5'];
(async()=>{let n=0;for(const a of M)for(const b of M)for(let i=0;i<4;i++){const s=A.newGame(i%2,mulberry32(n+1),['P0','P1']);const w=await A.runGame(s,[mk(a),mk(b)]);if(w!==0&&w!==1)throw new Error('勝者なし '+a+' '+b);n++;}
 console.log('smoke OK',n,'局');})().catch(e=>{console.error(e);process.exit(1);});
