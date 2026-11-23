const fs=require('fs');
const rd=n=>fs.readFileSync(__dirname+'/'+n,'utf8');
let c2=rd('cpu2.js');const i=c2.indexOf("if(typeof module!=='undefined')");if(i>=0)c2=c2.slice(0,i);
let eng=rd(process.env.ENGINE||'engine.js');
const code=eng+'\n'+c2+'\n'+rd('rl.js')+'\n'+rd('weights/rl_weights.js')+'\n'+rd('weights/rl_weights3.js')+'\n'+rd('weights/rl_weights4.js')+'\n'+rd('weights/rl_weights5.js')+'\n'+rd('weights/rl_weights6.js')+'\n'+rd('weights/rl_weights65.js')+'\n'+rd(process.env.RULES||'rules.js')+
 '\nreturn {newGame,runGame,makeCPU,makeCPU2,makeRL,rlLoad,withRules,RL_WEIGHTS,RL_WEIGHTS3,RL_WEIGHTS4,RL_WEIGHTS5,RL_WEIGHTS6,RL_WEIGHTS65,rlEncode4,rlForward,view,ruleDecide,ruleSnap,ruleNegate,ruleCounter,'+(process.env.PREV?'':'ruleTargets,')+'ruleProtect,ruleR4Play,rThreat,isMonster,ruleNoNeed,CARDS,NAME,HARA,KODOMO,GOB,IDEYON,YOMI,IREKAE,OWAKARE,KNIFE,MAJO,SAND,KARASU,GIN,KURO,SUISHO,MEGANE,FUKIYA};';
module.exports=new Function(code)();
