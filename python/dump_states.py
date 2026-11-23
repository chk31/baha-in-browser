import json, random, sys
import os; sys.path.insert(0,os.path.join(os.path.dirname(os.path.abspath(__file__)),'stub'))
from harapeko_engine import *
import harapeko_rules as R
rng=random.Random(7); out=[]
class Rand:
    def __init__(s,r): s.r=r
    def act(s,st,req):
        if req.kind=='play':
            o=[c for c in req.options if c!=HARA]
            return None if (not o or s.r.random()<0.15) else (s.r.choice(o),'')
        if req.kind in('negate','counter'): return s.r.random()<0.5
        return s.r.choice(req.options)
def mixed(r):
    return Rand(r) if r.random()<0.3 else (CPUv2() if r.random()<0.5 else CPUv1())
def dumpst(s):
    return json.loads(json.dumps(_dumpst(s)))
def _dumpst(s):
    return {'deck':s.deck,'discard':s.discard,'limbo':s.limbo,'stock':s.stock,
      'players':[{'hand':P.hand,'field':P.field,'life':P.life,'chips':P.chips} for P in s.players],
      'known':[sorted(k) for k in s.known],'hiddenDraws':s.hidden_draws,'misses':[[[c,d] for c,d in m.items()] for m in s.misses],
      'turn':s.turn,'turnCount':s.turn_count,'playsAllowed':s.plays_allowed,'playsUsed':s.plays_used,'first':s.first}
N=int(sys.argv[1])
for gi in range(N):
    s=State(gi%2,random.Random(rng.random()))
    # ライフを低めに：勝敗局面を増やす
    for P in s.players: P.life=rng.choice([1,2,2,3,4])
    ag=[mixed(rng),mixed(rng)]
    g=run_game(s)
    try:
        req=g.send(None)
        while True:
            p=req.player
            rec={'s':dumpst(s),'p':p,'kind':req.kind,'card':req.card,'opts':req.options}
            d=R.rule_decide(s,p)
            rec['decide']=({'forced':d['forced'][0],'why':d['why']} if 'forced' in d else {'allow':sorted(d['allow']),'why':d['why']} if 'allow' in d else {})
            if req.kind=='play': rec['r4']=R.r4_play(s,p,[c for c in req.options if c!=HARA])
            if req.kind=='negate': rec['neg']=R.rule_negate(s,p,req.card)
            if req.kind=='counter': rec['ctr']=R.rule_counter(s,p,req.card)
            if req.kind=='choose' and len(req.options)>1: t=R.rule_targets(s,p,req.card,req.options);rec['tgt']=sorted(t) if t else None; rec['r4c']=R.r4_choose(s,p,req.options,req.card)
            if req.kind=='declare': t=R.rule_targets(s,p,SUISHO,None);rec['tgt']=sorted(t) if t else None
            if req.kind=='discard': rec['prot']=sorted(R.rule_protect(s,p,req.card))
            out.append(rec)
            req=g.send(ag[p].act(s,req))
    except StopIteration: pass
json.dump(out,open(sys.argv[2] if len(sys.argv)>2 else '/tmp/states.json','w'))
print(len(out))
