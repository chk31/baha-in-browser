const A=require('../app/load_all.js');const fs=require('fs');
const recs=JSON.parse(fs.readFileSync(process.argv[2]||'/tmp/states.json'));
function mk(d){return {deck:[...d.deck],discard:[...d.discard],limbo:d.limbo,stock:d.stock,rng:Math.random,names:['a','b'],
 players:d.players.map(P=>({hand:[...P.hand],field:[...P.field],life:P.life,chips:P.chips})),
 known:d.known.map(k=>new Set(k)),hiddenDraws:[...d.hiddenDraws],misses:d.misses.map(m=>new Map(m)),ideyonResults:[[],[]],
 turn:d.turn,first:d.first,turnCount:d.turnCount,playsAllowed:d.playsAllowed,playsUsed:d.playsUsed,winner:null,log:[],hooks:{}};}
const bad={};const cnt={};const eq=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const B=(k,r,j,py)=>{cnt[k]=(cnt[k]||0)+1;if(!eq(j,py)){bad[k]=bad[k]||[];if(bad[k].length<3)bad[k].push({j,py,r:{p:r.p,kind:r.kind,card:r.card,s:r.s}});bad[k].n=(bad[k].n||0)+1;}};
let fired={};
for(const r of recs){const s=mk(r.s),p=r.p;
 const d=A.ruleDecide(s,p);const dj=d.forced?{forced:d.forced.card,why:d.why}:d.allow?{allow:[...d.allow].sort((a,b)=>a-b),why:d.why}:{};
 B('decide',r,dj,r.decide);if(r.decide.why)fired[r.decide.why]=(fired[r.decide.why]||0)+1;
 if('r4' in r)B('r4',r,A.ruleR4Play(s,p,r.opts.filter(c=>c!==0)),r.r4);
 if('neg' in r)B('neg',r,A.ruleNegate(s,p,r.card),r.neg);
 if('ctr' in r)B('ctr',r,A.ruleCounter(s,p,r.card),r.ctr);
 if('tgt' in r){const t=r.kind==='declare'?A.ruleTargets(s,p,13,null):A.ruleTargets(s,p,r.card,r.opts);B('tgt',r,t?[...t].sort((a,b)=>a-b):null,r.tgt);}
 if('prot' in r)B('prot',r,[...A.ruleProtect(s,p,r.card)].sort((a,b)=>a-b),r.prot);
}
console.log('件数',cnt,'発火',fired);
for(const k in bad)console.log('不一致',k,bad[k].n,JSON.stringify(bad[k].slice(0,2)).slice(0,1500));
