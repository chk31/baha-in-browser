"""確定手ルール（R1〜R8）。対戦アプリの rules.js と同じ判断をする Python 版。

公開情報（自分の手札・場・捨て札・判明した相手の手札・山札に確定しているカード・書の枚数）だけで判断する。
- rule_actions(s, req) : その判断で選んでよい行動（0〜18）の一覧を返す。None なら制限なし。
  学習ではこれを MaskablePPO のマスクに重ねる。1つだけなら、その手が確定している。
"""
from harapeko_engine import (HARA, KODOMO, GOB, IDEYON, YOMI, IREKAE, OWAKARE, KNIFE, MAJO, SAND,
                             KARASU, GIN, KURO, SUISHO, MEGANE, FUKIYA, ALL, is_monster, View)

A_PASS, A_YES, A_NO = 16, 17, 18


class St:
    """「通せるか」の計算に使う小さな状態。"""
    __slots__ = ('hand', 'disc', 'deck', 'oppK', 'k', 'm', 'P', 'oGob', 'mGob', 'oKod', 'mKod', 'oHara',
                 'meLife', 'opLife', 'need', 'goal')

    def copy(self):
        n = St()
        for a in St.__slots__:
            v = getattr(self, a)
            setattr(n, a, set(v) if isinstance(v, set) else v)
        return n

    def key(self):
        return (self.goal, frozenset(self.hand), frozenset(self.disc), frozenset(self.deck), frozenset(self.oppK),
                self.k, self.m, self.P, self.need, self.oGob, self.mGob, self.oKod, self.mKod, self.oHara)


def snap(s, p):
    v = View(s, p)
    me, op = v.me, v.op
    slots = max(0, len(op.hand) - len(v.known))
    st = St()
    st.hand = set(me.hand)
    st.disc = set(s.discard)
    st.deck = {c for c in v.unseen if c not in v.known and
               (slots == 0 or s.misses[p].get(c) == s.hidden_draws[1 - p])}
    st.oppK = set(v.known)
    st.k, st.m, st.P = op.chips, me.chips, s.plays_allowed - s.plays_used
    st.oGob, st.mGob = GOB in op.field, GOB in me.field
    st.oKod, st.mKod, st.oHara = KODOMO in op.field, KODOMO in me.field, HARA in op.field
    st.meLife, st.opLife = me.life, op.life
    st.need = 1 if op.life <= 2 else 2
    st.goal = ''
    return st


def threat(st):
    return st.oHara or (st.oKod and st.meLife == 1 and not st.mGob) or (st.mKod and st.oGob and st.meLife == 1)


def done(st):
    if st.goal == 'G1': return st.need <= 0
    if st.goal == 'G2': return st.mGob
    return not threat(st)


def irek_ok(st):
    return (st.oHara and not st.oKod) or (not st.oHara and not st.oKod and st.mKod and st.oGob and st.meLife == 1)


def moves(st):
    """目標に向けて出せる手。(card, target, x) のタプル。"""
    H, mv, want, g = st.hand, [], [], st.goal

    def gob_moves():
        if GOB in H: mv.append((GOB, None, None))
        if IDEYON in H and GOB in H: mv.append((IDEYON, GOB, None))
        if YOMI in H and GOB in st.disc: mv.append((YOMI, GOB, None))
    if g == 'G1':
        if KNIFE in H and not st.oGob: mv.append((KNIFE, None, None))
        if OWAKARE in H and st.oGob: mv.append((OWAKARE, GOB, 'oGob'))
        want.append(KNIFE)
        if st.oGob: want.append(OWAKARE)
    elif g == 'G2':
        gob_moves(); want.append(GOB)
    else:
        if OWAKARE in H:
            if st.oHara: mv.append((OWAKARE, HARA, 'oHara'))
            if st.oKod and st.meLife == 1 and not st.mGob: mv.append((OWAKARE, KODOMO, 'oKod'))
            if st.mKod and st.oGob and st.meLife == 1:
                mv.append((OWAKARE, GOB, 'oGob')); mv.append((OWAKARE, KODOMO, 'mKod'))
        if IREKAE in H and irek_ok(st): mv.append((IREKAE, None, None))
        if st.oKod and st.meLife == 1 and not st.mGob:
            gob_moves(); want.append(GOB)
        want.append(OWAKARE)
        if irek_ok(st) or st.oHara: want.append(IREKAE)
    for t in want:
        if t in H: continue
        if KARASU in H and t in st.disc: mv.append((KARASU, t, None))
        if MEGANE in H and t in st.deck: mv.append((MEGANE, t, None))
        if SUISHO in H and t in st.oppK: mv.append((SUISHO, t, None))
    if SAND in H and st.P >= 1: mv.append((SAND, None, None))
    return mv


def apply(st1, mv):
    n = st1.copy()
    c, t, x = mv
    if c != GOB: n.disc.add(c)
    if c == KNIFE: n.need -= 1
    elif c == OWAKARE:
        if x == 'oGob': n.oGob = False
        elif x == 'oHara': n.oHara = False
        elif x == 'oKod': n.oKod = False
        elif x == 'mKod': n.mKod = False
    elif c == IREKAE:
        if n.oHara:
            if not n.oKod: n.oHara, n.mKod, n.oKod = False, False, True
        elif n.mKod and not n.oKod: n.mKod = False
    elif c == GOB: n.mGob = True
    elif c == IDEYON: n.hand.discard(GOB); n.mGob = True
    elif c == YOMI: n.disc.discard(GOB); n.mGob = True
    elif c == KARASU: n.disc.discard(t); n.hand.add(t)
    elif c == MEGANE: n.deck.discard(t); n.hand.add(t)
    elif c == SUISHO: n.oppK.discard(t); n.hand.add(t)
    elif c == SAND: n.P += 2
    return n


class Solver:
    def __init__(self):
        self.memo, self.used = {}, set()

    def eval(self, st, mv):
        """手mvを打ったとき、相手がどう打ち消しても目標に届くか。"""
        if st.P < 1 or mv[0] not in st.hand: return False
        st1 = st.copy(); st1.hand.discard(mv[0]); st1.P -= 1
        if not self.solve(apply(st1, mv)): return False
        if st.k >= 1:
            neg = st1.copy(); neg.disc.add(mv[0]); neg.k -= 1
            ok = self.solve(neg)
            if not ok and st.m >= 2:
                ctr = apply(st1, mv); ctr.m -= 2; ctr.k -= 1
                ok = self.solve(ctr)
            if not ok: return False
        self.used.add(mv[0])
        return True

    def solve(self, st):
        if done(st): return True
        if st.P <= 0: return False
        k = st.key()
        if k in self.memo: return self.memo[k]
        r = any(self.eval(st, mv) for mv in moves(st))
        self.memo[k] = r
        return r

    def first(self, st):
        if done(st): return None
        for mv in moves(st):
            if self.eval(st, mv): return mv
        return None


def with_goal(st, g):
    n = st.copy(); n.goal = g
    return n


def goals(st):
    g = []
    if st.opLife <= 4: g.append('G1')
    if st.oKod and st.opLife == 1 and not st.mGob: g.append('G2')
    return g


def keeps(sv, z, c):
    """その手を打っても、目標zに確実に届くままか。手順に使う手はその効果で確かめる。
    それ以外の手は「効果なし」とみなし、手数が足りるかだけを見る（良し悪しはAIに任せる）。"""
    if any(m[0] == c and sv.eval(z, m) for m in moves(z)):
        return True
    g = z.copy(); g.hand.discard(c); g.disc.add(c); g.P -= (0 if c == KURO else 1)
    return g.P >= 0 and sv.solve(g)


def rule_decide(s, p):
    """自分の手番のプレイ（1プレイごとに判定する）。
    目標に確実に届く状態なら、その確実さが崩れない手だけを残す（パスも外す）。
    残る手が1つならそれが強制（最後の1手）、2つ以上ならその中からAIが選ぶ。
    {'forced': (card,), 'why'} / {'allow': set, 'noPass': True, 'why'} / {}"""
    st = snap(s, p)
    tries = [(with_goal(st, g), 'R1') for g in goals(st)]
    if threat(st):
        tries.append((with_goal(st, 'G3'), 'R2'))
    for z, why in tries:
        sv = Solver()
        if done(z) or not sv.solve(z):
            continue
        allow = {c for c in st.hand if c != HARA and keeps(sv, z, c)}
        if not allow:
            continue
        if len(allow) == 1:
            return {'forced': (next(iter(allow)), None, None), 'why': why}
        return {'allow': allow, 'noPass': True, 'why': why}
    return {}


def r4_play(s, p, opts):
    """R4：必ず損をする手を外す。全部外れたら空リスト（パスする）。"""
    v = View(s, p)
    me, op = v.me, v.op
    oGob, oKod, oHara = v.opF(GOB), v.opF(KODOMO), v.opF(HARA)
    monH = [c for c in me.hand if is_monster(c)]
    monD = [c for c in s.discard if is_monster(c)]
    protect_gob = v.myF(GOB) and oKod and (me.life == 1 or op.life == 1)
    field_all = op.field + me.field

    def ok(c):
        if c == KNIFE and oGob: return False
        if c == KODOMO and oGob and me.life == 1: return False
        if c == IDEYON and oGob and me.life == 1 and monH and all(x == KODOMO for x in monH): return False
        if c == YOMI and oGob and me.life == 1 and monD and all(x == KODOMO for x in monD): return False
        if c == IREKAE and oKod and not oHara: return False
        if c == OWAKARE and protect_gob and field_all and all(x == GOB and v.myF(GOB) for x in field_all): return False
        return True
    return [c for c in opts if ok(c)]


def r4_choose(s, p, opts, card):
    v = View(s, p)
    me, op = v.me, v.op
    r = list(opts)
    if card == OWAKARE and v.myF(GOB) and v.opF(KODOMO) and (me.life == 1 or op.life == 1):
        r = [c for c in r if not (c == GOB and v.myF(GOB) and GOB not in op.field)]
    if card in (IDEYON, YOMI) and v.opF(GOB) and me.life == 1:
        r = [c for c in r if c != KODOMO]
    return r or list(opts)


def rule_targets(s, p, card, opts):
    """解決時の対象選択：目標に確実に届く状態なら、その確実さが崩れない対象を返す（制限なしなら None）。
    opts=None は水晶の宣言（返り値は集合）。"""
    st = snap(s, p)
    gl = [with_goal(st, g) for g in goals(st)]
    if threat(st): gl.append(with_goal(st, 'G3'))
    sv = Solver()
    for g in gl:
        if done(g): continue
        tmp = g.copy(); tmp.hand.add(card)
        mv_c = [m for m in moves(tmp) if m[0] == card]
        good = {m[1] for m in mv_c if m[1] is not None and sv.solve(apply(g, m))}
        none = g.copy(); none.disc.add(card)
        none_ok = sv.solve(none)
        if not good and not none_ok: continue
        if opts is None:
            return None if none_ok else good
        moved = {m[1] for m in mv_c}
        allow = [t for t in opts if t in good or (none_ok and t not in moved)]
        return allow if allow and len(allow) < len(opts) else None
    return None


def rule_counter(s, p, card):
    """うちけし返しするか。True/False、決まらなければ None。"""
    st = snap(s, p)
    gl = [with_goal(st, g) for g in goals(st)]
    if threat(st): gl.append(with_goal(st, 'G3'))
    sv = Solver()
    for g in gl:
        if done(g): continue
        stn = g.copy(); stn.disc.add(card)
        no_ok = sv.solve(stn)
        ctr_ok = False
        if g.m >= 2:
            tmp = g.copy(); tmp.hand.add(card)
            mvs = [m for m in moves(tmp) if m[0] == card] or [(card, None, None)]
            for mv in mvs:
                res = apply(g, mv); res.m -= 2
                if sv.solve(res): ctr_ok = True; break
        if no_ok or ctr_ok: return ctr_ok and not no_ok
    return None


def opp_may(s, p, c):
    """唱えた側（pの相手）の手札にcがありうるか。"""
    v = View(s, p)
    if c in v.known: return True
    if c not in v.unseen_set: return False
    return s.misses[p].get(c) != s.hidden_draws[1 - p]


def no_need(s, p, card):
    """R8：打ち消しても意味がない（効果が確実に何も起きない）。"""
    v = View(s, p)
    me, op = v.me, v.op
    # 効果が確実に何も起きないときだけ（経験則での判断は入れない）
    if card == IDEYON and not any(opp_may(s, p, c) for c in (HARA, KODOMO, GOB)): return True
    if card == YOMI and not any(is_monster(c) for c in s.discard): return True
    if card == OWAKARE and not me.field and not op.field: return True
    if card == MAJO and s.stock == 0: return True
    if card == KARASU and not s.discard: return True
    if card == MEGANE and not s.deck: return True
    if card == FUKIYA and not me.hand: return True
    if card == SUISHO and not me.hand: return True
    return False


def rule_negate(s, p, card, r8=True):
    """R5・R6・R8。True/False、決まらなければ None。"""
    v = View(s, p)
    me = v.me
    if card == KNIFE and v.myF(GOB): return False
    if me.chips < 1: return None
    if r8 and no_need(s, p, card): return False
    if card == KNIFE and me.life <= 2 and not v.myF(GOB): return True
    if v.myF(KODOMO) and me.life == 1:
        if card == GOB: return True
        if card == YOMI and v.inDisc(GOB): return True
        if card == IDEYON and GOB in v.known: return True
    return None


def rule_protect(s, p, card):
    """R7：R1・R2の手順に使うカード。"""
    st = snap(s, p)
    if card == KURO: st.P += 1
    used = set()
    for g in goals(st):
        sv = Solver(); sv.first(with_goal(st, g)); used |= sv.used
    if threat(st):
        sv = Solver(); sv.first(with_goal(st, 'G3')); used |= sv.used
    return used


def rule_actions(s, req, r8=True):
    """この判断で選んでよい行動の一覧（ルールが何も言わなければ None）と、効いたルールの名前。"""
    p, k = req.player, req.kind
    if k == 'play':
        d = rule_decide(s, p)
        if 'forced' in d:
            return [d['forced'][0]], d['why']
        opts = [c for c in req.options if c != HARA]
        o4 = r4_play(s, p, opts)
        why = 'R4' if len(o4) < len(opts) else ''
        if 'allow' in d:
            why = d['why']
            f = [c for c in o4 if c in d['allow']]
            if f: o4 = f
        acts = list(o4)
        if not (d.get('noPass') and o4): acts.append(A_PASS)
        return (acts, why) if why else (None, '')
    if k == 'negate':
        r = rule_negate(s, p, req.card, r8)
        if r is None: return None, ''
        why = 'R8' if (r is False and r8 and req.card != KNIFE and no_need(s, p, req.card)) else ('R5' if r is False else 'R6')
        return [A_YES if r else A_NO], why
    if k == 'counter':
        r = rule_counter(s, p, req.card)
        return (None, '') if r is None else ([A_YES if r else A_NO], 'R1')
    if k == 'choose':
        if len(req.options) > 1:
            t = rule_targets(s, p, req.card, req.options)
            o = t if t else list(req.options)
            r = r4_choose(s, p, o, req.card) if len(o) > 1 else o
            if len(r) < len(req.options): return r, ('R1' if t else 'R4')
        return None, ''
    if k == 'declare':
        t = rule_targets(s, p, SUISHO, None)
        return (sorted(t), 'R1') if t else (None, '')
    if k == 'discard':
        prot = rule_protect(s, p, req.card)
        f = [c for c in req.options if c not in prot]
        if f and len(f) < len(req.options): return f, 'R7'
        return None, ''
    return None, ''
