"""はらぺこバハムート ゲームエンジン + ルールベースCPU（v1 / v2）
JavaScript版（対戦アプリ）からの移植。エンジンはジェネレーターで、判断が必要になるたびに
Request を yield し、send() で答えを受け取る。
"""
import random
from dataclasses import dataclass, field

(HARA, KODOMO, GOB, IDEYON, YOMI, IREKAE, OWAKARE, KNIFE, MAJO, SAND,
 KARASU, GIN, KURO, SUISHO, MEGANE, FUKIYA) = range(16)
NAMES = ['はらぺこバハムート', 'こどもバハムート', 'はねかえしゴブリン', 'イデヨン！', 'ヨミガエール！',
         'イレカエール！', 'オワカーレ！', 'そらとぶナイフ', '魔女のおとどけもの', 'ほしふる砂時計',
         'カラスのおつかい', '銀ネコのしっぽ', '黒ネコのしっぽ', 'ひらめき水晶', 'ようせいのメガネ', 'あくまの吹き矢']
MONSTERS = (HARA, KODOMO, GOB)
ALL = tuple(range(16))


def is_monster(c):
    return c <= 2


class GameOver(Exception):
    def __init__(self, winner):
        self.winner = winner


@dataclass
class Player:
    hand: list = field(default_factory=list)
    field: list = field(default_factory=list)
    life: int = 4
    chips: int = 2


@dataclass
class Request:
    player: int
    kind: str          # 'play' | 'negate' | 'counter' | 'choose' | 'discard' | 'declare'
    options: list      # 選べるカードID（play/choose/discard/declare）
    card: int = -1     # 関係するカード（negate/counter/choose/discard の文脈）
    intent: str = ''
    remaining: int = 0


class State:
    def __init__(self, first, rng=None, verbose=False):
        self.rng = rng or random.Random()
        self.deck = list(ALL)
        self.rng.shuffle(self.deck)
        self.discard = []
        self.limbo = None
        self.stock = 2
        self.players = [Player(), Player()]
        self.known = [set(), set()]          # known[p] = pが知っている「相手の手札」
        self.hidden_draws = [0, 0]
        self.misses = [dict(), dict()]       # 水晶の外れ: card -> 相手のhidden_draws
        self.ideyon_results = [[], []]       # 解決したイデヨンで出たカード（None=不発）
        self.turn = first
        self.first = first
        self.turn_count = 0
        self.plays_allowed = 0
        self.plays_used = 0
        self.winner = None
        self.verbose = verbose
        self.log = []
        for _ in range(5):
            for p in (0, 1):
                self.players[p].hand.append(self.deck.pop())

    def say(self, msg):
        if self.verbose:
            self.log.append(msg)


# ------------------------------------------------------------ 基本操作
def remove_from_hand(s, p, c):
    h = s.players[p].hand
    if c in h:
        h.remove(c)
    s.known[0].discard(c)
    s.known[1].discard(c)


def add_to_hand(s, p, c, public):
    s.players[p].hand.append(c)
    if public:
        s.known[1 - p].add(c)


def reshuffle(s):
    s.deck = s.discard
    s.discard = []
    s.rng.shuffle(s.deck)


def draw_cards(s, p, n):
    k = 0
    for _ in range(n):
        if not s.deck:
            if not s.discard:
                break
            reshuffle(s)
        add_to_hand(s, p, s.deck.pop(), False)
        s.hidden_draws[p] += 1
        k += 1
    return k


def damage(s, target, amt, src):
    t = target
    if src != HARA and GOB in s.players[t].field:
        t = 1 - t
    pl = s.players[t]
    pl.life = max(0, pl.life - amt)
    s.say(f'P{t}に{amt}ダメージ（残り{pl.life}）')
    if pl.life <= 0:
        raise GameOver(1 - t)


def locate(s, c):
    for p in (0, 1):
        if c in s.players[p].hand:
            return ('hand', p, s.players[p].hand, s.players[p].hand.index(c))
        if c in s.players[p].field:
            return ('field', p, s.players[p].field, s.players[p].field.index(c))
    if c in s.deck:
        return ('deck', -1, s.deck, s.deck.index(c))
    if c in s.discard:
        return ('discard', -1, s.discard, s.discard.index(c))
    return None


def do_irekae(s):
    a, b = locate(s, KODOMO), locate(s, HARA)
    if not a or not b:
        return
    a[2][a[3]] = HARA
    b[2][b[3]] = KODOMO
    for loc, c in ((a, HARA), (b, KODOMO)):
        if loc[0] == 'hand':
            other = KODOMO if c == HARA else HARA
            s.known[0].discard(other)
            s.known[1].discard(other)
            s.known[1 - loc[1]].add(c)


# ------------------------------------------------------------ 進行（ジェネレーター）
def run_game(s):
    """勝者を return するジェネレーター。"""
    try:
        while True:
            yield from take_turn(s)
            s.turn = 1 - s.turn
    except GameOver as e:
        s.winner = e.winner
        return e.winner


def take_turn(s):
    p = s.turn
    me = s.players[p]
    s.turn_count += 1
    s.plays_used = 0
    if KODOMO in me.field:
        damage(s, 1 - p, 1, KODOMO)
    if HARA in me.field:
        damage(s, 1 - p, 4, HARA)
    first_turn = s.turn_count == 1
    if not first_turn:
        draw_cards(s, p, 1)
    s.plays_allowed = 1 if first_turn else 2
    while s.plays_used < s.plays_allowed:
        opts = [c for c in me.hand if c != HARA]
        ans = yield Request(p, 'play', opts)
        if ans is None:
            break
        card, intent = ans if isinstance(ans, tuple) else (ans, '')
        yield from play_card(s, p, card, intent)
    n = len(me.hand) - 5
    for i in range(max(0, n)):
        c = yield Request(p, 'discard', list(me.hand), remaining=n - i)
        remove_from_hand(s, p, c)
        s.discard.append(c)


def play_card(s, p, card, intent=''):
    o = 1 - p
    me, op = s.players[p], s.players[o]
    if card not in me.hand or card == HARA:
        return
    remove_from_hand(s, p, card)
    s.limbo = card
    s.plays_used += 1
    s.say(f'P{p}: {NAMES[card]}')
    neg = False
    if op.chips >= 1:
        if (yield Request(o, 'negate', [], card=card)):
            op.chips -= 1
            s.stock += 1
            neg = True
            if me.chips >= 2 and (yield Request(p, 'counter', [], card=card, intent=intent)):
                me.chips -= 2
                s.stock += 2
                neg = False
    if neg:
        s.limbo = None
        s.discard.append(card)
        return
    try:
        yield from resolve(s, p, card, intent)
    finally:
        s.limbo = None
        if not is_monster(card):
            s.discard.append(card)


def resolve(s, p, card, intent):
    o = 1 - p
    me, op = s.players[p], s.players[o]

    def choose(opts):
        return (yield Request(p, 'choose', list(opts), card=card, intent=intent))

    if card in (KODOMO, GOB):
        me.field.append(card)
    elif card in (IDEYON, YOMI):
        src = me.hand if card == IDEYON else s.discard
        opts = [c for c in src if is_monster(c)]
        if not opts:
            if card == IDEYON:
                s.ideyon_results[p].append(None)
            return
        c = yield from choose(opts)
        if card == IDEYON:
            remove_from_hand(s, p, c)
            s.ideyon_results[p].append(c)
        else:
            s.discard.remove(c)
        me.field.append(c)
    elif card == IREKAE:
        do_irekae(s)
    elif card == OWAKARE:
        opts = op.field + me.field
        if not opts:
            return
        c = yield from choose(opts)
        owner = o if c in op.field else p
        s.players[owner].field.remove(c)
        s.discard.append(c)
    elif card == KNIFE:
        damage(s, o, 2, KNIFE)
    elif card == MAJO:
        if s.stock > 0:
            s.stock -= 1
            me.chips += 1
    elif card == SAND:
        s.plays_allowed += 2
    elif card == KARASU:
        if not s.discard:
            return
        c = yield from choose(s.discard)
        s.discard.remove(c)
        add_to_hand(s, p, c, True)
    elif card in (GIN, KURO):
        draw_cards(s, p, 3 if card == GIN else 2)
        n = min(2, len(me.hand))
        for i in range(n):
            c = yield Request(p, 'discard', list(me.hand), card=card, remaining=n - i)
            remove_from_hand(s, p, c)
            s.discard.append(c)
        if card == KURO:
            s.plays_allowed += 1
    elif card == SUISHO:
        c = yield Request(p, 'declare', [x for x in ALL if x != SUISHO], card=card, intent=intent)
        if c in op.hand:
            remove_from_hand(s, o, c)
            add_to_hand(s, p, c, True)
        else:
            s.misses[p][c] = s.hidden_draws[o]
    elif card == MEGANE:
        if not s.deck:                 # 山札が0枚なら何もしない（捨て札は混ぜ直さない）
            return
        c = yield from choose(s.deck)
        s.deck.remove(c)
        add_to_hand(s, p, c, False)
        s.hidden_draws[p] += 1
        s.rng.shuffle(s.deck)
    elif card == FUKIYA:
        if not op.hand:
            return
        s.known[p] = set(op.hand)
        c = yield from choose(op.hand)
        remove_from_hand(s, o, c)
        s.discard.append(c)


def play_match(s, agents):
    """エージェント2体で1局進めて勝者を返す。agent.act(s, req) -> 答え"""
    g = run_game(s)
    ans = None
    try:
        req = g.send(None)
        while True:
            ans = agents[req.player].act(s, req)
            req = g.send(ans)
    except StopIteration as e:
        return e.value


# ============================================================ ルールベースCPU 共通
class View:
    def __init__(self, s, p, use_misses=False):
        self.s, self.p = s, p
        self.me, self.op = s.players[p], s.players[1 - p]
        seen = set(self.me.hand) | set(self.me.field) | set(self.op.field) | set(s.discard)
        if s.limbo is not None:
            seen.add(s.limbo)
        self.unseen = [c for c in ALL if c not in seen]
        self.unseen_set = set(self.unseen)
        self.known = s.known[p]
        self.not_ = set()
        if use_misses:
            for c, d in s.misses[p].items():
                if d == s.hidden_draws[1 - p] and c in self.unseen_set and c not in self.known:
                    self.not_.add(c)
        pool = [c for c in self.unseen if c not in self.known and c not in self.not_]
        self.pool_n = len(pool)
        self.slots = max(0, len(self.op.hand) - len(self.known))
        self.deck_n = max(1, len(s.deck))

    def H(self, c): return c in self.me.hand
    def myF(self, c): return c in self.me.field
    def opF(self, c): return c in self.op.field
    def inDisc(self, c): return c in self.s.discard
    def isUnseen(self, c): return c in self.unseen_set

    def pOpp(self, c):
        if c in self.known:
            return 1.0
        if c not in self.unseen_set or c in self.not_:
            return 0.0
        return min(1.0, self.slots / self.pool_n) if self.pool_n else 0.0

    def pNext(self, c):
        ph = self.pOpp(c)
        if c not in self.unseen_set:
            return ph
        return ph + (1 - ph) * min(1.0, 1 / self.deck_n)


BASE_VALUE = [7, 4, 8, 5, 4, 8, 9, 6, 5, 4, 6, 6, 3, 3, 6, 5]


def card_value(s, p, c):
    v = View(s, p)
    x = BASE_VALUE[c]
    if c == HARA and v.H(IDEYON): x += 2
    if c == IDEYON and v.H(HARA): x += 3
    if c == YOMI and v.inDisc(HARA): x += 4
    if c == KNIFE:
        if v.op.life <= 2: x += 3
        if v.opF(GOB): x -= 4
    if c == KODOMO and v.opF(GOB): x -= 2
    if c == MAJO and s.stock == 0: x -= 4
    if c == SUISHO and v.known: x += 3
    if c in (OWAKARE, IREKAE) and v.opF(HARA): x += 5
    return x


def threat_value(s, p, c):
    v = View(s, p)
    plan = v.H(HARA) or v.myF(HARA)
    t = {HARA: 9, OWAKARE: 9 if plan else 6, IREKAE: 7, KNIFE: 9 if (v.me.life <= 2 and not v.myF(GOB)) else 6,
         GOB: 7, IDEYON: 5, YOMI: 8 if v.inDisc(HARA) else 4, KODOMO: 4, MAJO: 5, GIN: 5, KARASU: 5, MEGANE: 5,
         FUKIYA: 4, SAND: 4, KURO: 3, SUISHO: 3}
    if c == IDEYON and HARA in v.known:
        return 8
    return t[c]


def P(card, intent='', target=None):
    return {'card': card, 'intent': intent, 'target': target}


def landing_route(s, p, v, left):
    H = v.H
    if v.myF(HARA) or v.opF(HARA):
        return None
    if H(IDEYON) and H(HARA): return P(IDEYON, 'land', HARA)
    if H(YOMI) and v.inDisc(HARA): return P(YOMI, 'land', HARA)
    if H(IREKAE) and v.myF(KODOMO): return P(IREKAE, 'land')
    if left >= 2:
        if H(IREKAE) and H(KODOMO): return P(KODOMO, 'setup')
        if H(KARASU) and v.inDisc(HARA) and H(IDEYON): return P(KARASU, 'setup', HARA)
        if H(MEGANE) and H(IDEYON) and v.isUnseen(HARA) and HARA not in v.known: return P(MEGANE, 'setup', HARA)
        if H(SUISHO) and H(IDEYON) and HARA in v.known: return P(SUISHO, 'setup', HARA)
    return None


def sim_irekae(s, p):
    a, b = locate(s, KODOMO), locate(s, HARA)
    if not a or not b:
        return False, False
    op_gets = a[0] == 'field' and a[1] == 1 - p
    me_loses = b[0] == 'field' and b[1] == p
    return op_gets, me_loses


class RuleCPU:
    """v1 / v2 共通の act() ディスパッチ。"""
    COUNTER_INTENTS = ('land', 'answer', 'lethal', 'defend')

    def __init__(self):
        self.plan = None

    def act(self, s, req):
        p = req.player
        if req.kind == 'play':
            self.plan = self.choose_play(s, p)
            return None if self.plan is None else (self.plan['card'], self.plan['intent'])
        if req.kind == 'negate':
            return self.negate(s, p, req.card)
        if req.kind == 'counter':
            return self.counter(s, p, req.card, req.intent)
        if req.kind == 'choose':
            return self.choose(s, p, req.options, req.card)
        if req.kind == 'discard':
            return self.discard_one(s, p, req.options)
        if req.kind == 'declare':
            return self.declare(s, p)
        raise ValueError(req.kind)

    def counter(self, s, p, card, intent):
        return intent in self.COUNTER_INTENTS

    def planned_target(self, card, opts):
        if self.plan and self.plan['card'] == card and self.plan['target'] is not None and self.plan['target'] in opts:
            return self.plan['target']
        return None

    def choose(self, s, p, opts, card):
        t = self.planned_target(card, opts)
        if t is not None:
            return t
        v = View(s, p)
        if card == OWAKARE:
            for c in (HARA, KODOMO, GOB):
                if v.opF(c) and c in opts:
                    return c
            return opts[0]
        if card in (IDEYON, YOMI):
            for c in (HARA, GOB, KODOMO):
                if c in opts and not (c == KODOMO and v.opF(GOB)):
                    return c
            return opts[0]
        if card == FUKIYA:
            return max(opts, key=lambda c: threat_value(s, p, c))
        return max(opts, key=lambda c: card_value(s, p, c))

    def discard_one(self, s, p, opts):
        return min(opts, key=lambda c: card_value(s, p, c))

    def declare(self, s, p):
        if self.plan and self.plan['card'] == SUISHO and self.plan['target'] is not None:
            return self.plan['target']
        v = View(s, p)
        return max([c for c in ALL if c != SUISHO], key=lambda c: v.pOpp(c) * threat_value(s, p, c))


# ============================================================ v1
class CPUv1(RuleCPU):
    def choose_play(self, s, p):
        v = View(s, p)
        me, op, H = v.me, v.op, v.H
        left = s.plays_allowed - s.plays_used
        oppGob, myGob = v.opF(GOB), v.myF(GOB)
        knifeOK = not oppGob
        if knifeOK and op.life <= 2 and H(KNIFE): return P(KNIFE, 'lethal')
        if knifeOK and op.life <= 2 and H(KARASU) and v.inDisc(KNIFE) and left >= 2: return P(KARASU, 'lethal', KNIFE)
        if knifeOK and op.life <= 4 and H(KNIFE) and H(KARASU) and left >= 3: return P(KNIFE, 'lethal')
        if knifeOK and op.life <= 4 and H(SAND) and H(KNIFE) and H(KARASU) and left == 2: return P(SAND, 'lethal')
        if knifeOK and op.life <= 2 and H(MEGANE) and left >= 2 and v.isUnseen(KNIFE) and KNIFE not in v.known:
            return P(MEGANE, 'lethal', KNIFE)
        if v.opF(HARA):
            if H(OWAKARE): return P(OWAKARE, 'answer', HARA)
            if H(IREKAE): return P(IREKAE, 'answer')
            ans = (OWAKARE, IREKAE)
            if H(KARASU) and left >= 2:
                t = next((c for c in ans if v.inDisc(c)), None)
                if t is not None: return P(KARASU, 'answer', t)
            if H(MEGANE) and left >= 2:
                t = next((c for c in ans if v.isUnseen(c) and c not in v.known), None)
                if t is not None: return P(MEGANE, 'answer', t)
            if H(SUISHO) and left >= 2:
                cands = sorted([c for c in ans if v.pOpp(c) > 0], key=lambda c: -v.pOpp(c))
                if cands: return P(SUISHO, 'answer', cands[0])
            if H(SAND) and left == 1 and (H(KARASU) or H(MEGANE) or H(SUISHO) or H(GIN)): return P(SAND, 'answer')
            if H(KURO): return P(KURO, 'dig')
            if H(GIN) and left >= 2: return P(GIN, 'dig')
        if v.opF(KODOMO) and not myGob and me.life <= 1:
            if H(GOB): return P(GOB, 'defend')
            if H(OWAKARE): return P(OWAKARE, 'defend', KODOMO)
            if H(YOMI) and v.inDisc(GOB): return P(YOMI, 'defend', GOB)
        canForce = me.chips >= 2 or op.chips == 0
        route = landing_route(s, p, v, left)
        if route and canForce and not v.opF(HARA):
            if H(GOB) and not myGob and left >= 2 and route['intent'] == 'land': return P(GOB, 'setup')
            if H(SAND) and s.plays_used == 0 and left >= 1: return P(SAND, 'setup')
            return route
        useful = sum(1 for c in (KNIFE, GIN, MAJO, FUKIYA, KODOMO, GOB) if H(c) and (c != KNIFE or knifeOK)
                     and (c != MAJO or s.stock > 0) and (c != KODOMO or (not oppGob and not v.myF(KODOMO)))
                     and (c != GOB or not myGob))
        if H(SAND) and s.plays_used == 0 and useful >= 2: return P(SAND, 'tempo')
        if H(GIN): return P(GIN, 'draw')
        if H(GOB) and not myGob: return P(GOB, 'board')
        if H(KODOMO) and not oppGob and not v.myF(KODOMO): return P(KODOMO, 'board')
        if oppGob and H(OWAKARE) and H(IREKAE): return P(OWAKARE, 'remove', GOB)
        if v.opF(KODOMO) and not myGob and H(OWAKARE) and (H(IREKAE) or me.life <= 2): return P(OWAKARE, 'remove', KODOMO)
        if H(KNIFE) and knifeOK: return P(KNIFE, 'pressure')
        if H(MAJO) and s.stock > 0: return P(MAJO, 'chip')
        if H(FUKIYA) and len(op.hand) >= 2: return P(FUKIYA, 'disrupt')
        if H(SUISHO) and v.known:
            t = max(v.known, key=lambda c: threat_value(s, p, c))
            if threat_value(s, p, t) >= 5: return P(SUISHO, 'steal', t)
        if route and not canForce and op.chips >= 1 and me.chips >= 1 and H(IDEYON) and not H(HARA) and left >= 1 \
                and s.rng.random() < 0.3:
            return P(IDEYON, 'bluff')
        if H(MEGANE) and s.deck: return P(MEGANE, 'search')
        if H(KARASU) and s.discard:
            t = max(s.discard, key=lambda c: card_value(s, p, c))
            if card_value(s, p, t) >= 6: return P(KARASU, 'recover', t)
        if H(KURO) and len(me.hand) >= 3: return P(KURO, 'filter')
        if H(YOMI) and v.inDisc(GOB): return P(YOMI, 'board', GOB)
        if H(YOMI) and v.inDisc(KODOMO) and not oppGob and not v.myF(KODOMO): return P(YOMI, 'board', KODOMO)
        return None

    def negate(self, s, p, card):
        v = View(s, p)
        me, op = v.me, v.op
        if me.chips < 1:
            return False
        ans = v.H(OWAKARE) or v.H(IREKAE)
        if card == KNIFE:
            if v.myF(GOB): return False
            if me.life <= 2: return True
            return me.chips >= 3 or (me.chips >= 2 and v.H(MAJO) and s.stock > 0)
        if card == IDEYON:
            if v.myF(HARA) or v.opF(HARA): return False
            ph = v.pOpp(HARA)
            if ph == 0: return False
            if HARA in v.known: return True
            return ph >= 0.6 if ans else ph >= 0.3
        if card == YOMI:
            if v.inDisc(HARA): return (not ans) or me.chips >= 2
            return v.inDisc(GOB) and me.chips >= 2 and (v.myF(KODOMO) or v.H(KNIFE))
        if card == IREKAE:
            a, b = sim_irekae(s, p)
            return a or b
        if card == OWAKARE:
            if v.myF(HARA): return True
            return v.myF(GOB) and me.chips >= 2 and (v.myF(KODOMO) or v.H(KNIFE) or v.opF(KODOMO))
        if card == KODOMO: return (not v.myF(GOB)) and me.life <= 2 and me.chips >= 2
        if card == GOB: return me.chips >= 2 and (v.myF(KODOMO) or v.H(KNIFE) or v.H(KODOMO))
        if card == SUISHO: return any(c in me.hand and card_value(s, p, c) >= 7 for c in s.known[1 - p])
        if card == GIN: return s.turn_count <= 2 and me.chips >= 2 and v.H(MAJO) and s.stock > 0
        if card == FUKIYA: return me.chips >= 3
        return False


# ============================================================ v2
def any_p(ps):
    r = 1.0
    for x in ps:
        r *= 1 - max(0.0, min(1.0, x))
    return 1 - r


def opp_answer_prob(s, p, v):
    ps = []
    kod_my = v.myF(KODOMO)
    for a in (OWAKARE, IREKAE):
        if a == IREKAE and kod_my:
            continue
        if v.H(a):
            ps.append(v.pNext(SUISHO) if a in s.known[1 - p] else v.pNext(SUISHO) * 0.15)
            continue
        if v.inDisc(a):
            ps.append(v.pNext(KARASU))
            continue
        if v.isUnseen(a):
            ps.append(v.pNext(a))
            ps.append(v.pNext(MEGANE) * (1 - v.pOpp(a)))
    return any_p(ps)


def answer_resolves(m, o):
    return (1 if o >= 2 else 0) if m >= 1 else 1


def land_success(m, o, pa):
    B = 1 - pa * answer_resolves(m, o)
    if o < 1:
        return B
    A = 1 - pa * answer_resolves(m - 2, o - 1) if m >= 2 else 0
    return min(A, B)


def danger_knife(s, p, v, ignore_my_gob=False):
    if v.myF(GOB) and not ignore_my_gob:
        return 0.0
    if v.inDisc(KNIFE):
        acc = v.pNext(KARASU)
    elif v.isUnseen(KNIFE):
        acc = v.pNext(KNIFE)
    else:
        acc = 0.0
    tick = 1 if v.opF(KODOMO) else 0
    L = v.me.life - tick
    if L <= 0:
        return 1.0
    if L <= 2:
        return acc
    return 0.0


class CPUv2(RuleCPU):
    """既定値は対戦アプリの「つよい」と同じ。引数を変えると癖の違う変種になる。"""
    def __init__(self, land_t=0.55, bait_t=0.25, bluff=0.0, board_first=False, knife_neg_m=3):
        super().__init__()
        self.LAND_T, self.BAIT_T = land_t, bait_t
        self.bluff, self.board_first, self.knife_neg_m = bluff, board_first, knife_neg_m

    def choose_play(self, s, p):
        v = View(s, p, use_misses=True)
        me, op, H = v.me, v.op, v.H
        left = s.plays_allowed - s.plays_used
        oppGob, myGob = v.opF(GOB), v.myF(GOB)
        knifeOK = not oppGob
        m, o = me.chips, op.chips
        # A. 勝ち切り
        if knifeOK and op.life <= 2 and H(KNIFE): return P(KNIFE, 'lethal')
        if knifeOK and op.life <= 2 and H(KARASU) and v.inDisc(KNIFE) and left >= 2: return P(KARASU, 'lethal', KNIFE)
        if knifeOK and op.life <= 4 and H(KNIFE) and H(KARASU) and left >= 3: return P(KNIFE, 'lethal')
        if knifeOK and op.life <= 4 and H(SAND) and H(KNIFE) and H(KARASU) and left == 2: return P(SAND, 'lethal')
        if knifeOK and op.life <= 2 and H(MEGANE) and left >= 2 and v.isUnseen(KNIFE) and KNIFE not in v.known:
            return P(MEGANE, 'lethal', KNIFE)
        # B. 相手のはらぺこへの対処
        if v.opF(HARA):
            iOK = H(IREKAE) and not v.opF(KODOMO)
            answers = [c for c, ok in ((OWAKARE, H(OWAKARE)), (IREKAE, iOK)) if ok]
            if len(answers) == 1 and o >= 1 and m < 2 and left >= 2:
                if H(KNIFE) and knifeOK and op.life <= 2: return P(KNIFE, 'lethal')
                if H(MAJO) and s.stock > 0 and m == 1: return P(MAJO, 'chip')
            if answers:
                a = answers[0]
                return P(a, 'answer', HARA if a == OWAKARE else None)
            ans = (OWAKARE, IREKAE)
            if H(KARASU) and left >= 2:
                t = next((c for c in ans if v.inDisc(c)), None)
                if t is not None: return P(KARASU, 'answer', t)
            if H(MEGANE) and left >= 2:
                t = next((c for c in ans if v.isUnseen(c) and c not in v.known), None)
                if t is not None: return P(MEGANE, 'answer', t)
            if H(SUISHO) and left >= 2:
                cands = sorted([c for c in ans if v.pOpp(c) > 0], key=lambda c: -v.pOpp(c))
                if cands: return P(SUISHO, 'answer', cands[0])
            if H(SAND) and left == 1 and (H(KARASU) or H(MEGANE) or H(SUISHO) or H(GIN) or H(KURO)): return P(SAND, 'answer')
            if H(KURO): return P(KURO, 'dig')
            if H(GIN) and left >= 2: return P(GIN, 'dig')
        # C. 防御
        dk = danger_knife(s, p, v)
        if (v.opF(KODOMO) and not myGob and me.life <= 1) or dk >= 0.3:
            if H(GOB) and not myGob: return P(GOB, 'defend')
            if H(YOMI) and v.inDisc(GOB): return P(YOMI, 'defend', GOB)
            if H(IDEYON) and H(GOB): return P(IDEYON, 'defend', GOB)
            if v.opF(KODOMO) and me.life <= 1 and H(OWAKARE): return P(OWAKARE, 'defend', KODOMO)
        # （変種）盤面優先：まものを先に並べて相手の書を使わせる
        if self.board_first:
            if H(GOB) and not myGob: return P(GOB, 'board')
            if H(KODOMO) and not oppGob and not v.myF(KODOMO) and not v.opF(HARA): return P(KODOMO, 'board')
        # （変種）イデヨンの空撃ちで書を削る
        if self.bluff and H(IDEYON) and not H(HARA) and o >= 1 and s.rng.random() < self.bluff:
            return P(IDEYON, 'bluff')
        # D. はらぺこ着地
        route = landing_route(s, p, v, left)
        if route and not v.opF(HARA):
            pa = opp_answer_prob(s, p, v)
            succ = land_success(m, o, pa)
            if succ >= self.LAND_T:
                if H(FUKIYA) and left >= (2 if route['intent'] == 'land' else 3) and op.hand and pa > 0.25:
                    return P(FUKIYA, 'strip')
                if H(GOB) and not myGob and left >= 2 and route['intent'] == 'land': return P(GOB, 'setup')
                if H(SAND) and s.plays_used == 0: return P(SAND, 'setup')
                return route
            if succ >= self.BAIT_T and o >= 1 and m <= 1 and route['intent'] == 'land':
                return dict(route, intent='bait')
        # E. 捨て札のはらぺこを確保
        if H(KARASU) and v.inDisc(HARA) and (v.pNext(YOMI) > 0.3 or v.pNext(KARASU) > 0.3 or H(IDEYON)):
            return P(KARASU, 'deny', HARA)
        # F. 相手の「こども＋イレカエール」を潰す
        if v.opF(KODOMO) and v.pNext(IREKAE) >= 0.35 and not v.myF(HARA) and H(OWAKARE) and \
                (H(IREKAE) or (not v.inDisc(IREKAE) and not H(IREKAE) and m >= 1)):
            return P(OWAKARE, 'remove', KODOMO)
        # G. 砂時計は1枚目
        useful = sum(1 for c in (KNIFE, GIN, MAJO, FUKIYA, KODOMO, GOB) if H(c) and (c != KNIFE or knifeOK)
                     and (c != MAJO or s.stock > 0) and (c != KODOMO or (not oppGob and not v.myF(KODOMO)))
                     and (c != GOB or not myGob))
        if H(SAND) and s.plays_used == 0 and useful >= 2: return P(SAND, 'tempo')
        # H. 書の補充・ドロー
        if H(MAJO) and s.stock > 0 and m < 3: return P(MAJO, 'chip')
        if H(GIN): return P(GIN, 'draw')
        # I. 盤面
        if H(GOB) and not myGob: return P(GOB, 'board')
        if H(KODOMO) and not oppGob and not v.myF(KODOMO) and not v.opF(HARA): return P(KODOMO, 'board')
        if oppGob and H(OWAKARE) and H(IREKAE) and (H(KNIFE) or v.myF(KODOMO)): return P(OWAKARE, 'remove', GOB)
        # J. 圧力・リソース
        if H(KNIFE) and knifeOK: return P(KNIFE, 'pressure')
        if H(MAJO) and s.stock > 0: return P(MAJO, 'chip')
        if H(GIN): return P(GIN, 'draw')
        if H(FUKIYA) and len(op.hand) >= 2: return P(FUKIYA, 'disrupt')
        if H(SUISHO):
            cand = max((c for c in ALL if c != SUISHO), key=lambda c: v.pOpp(c) * threat_value(s, p, c))
            if v.pOpp(cand) * threat_value(s, p, cand) >= 4: return P(SUISHO, 'steal', cand)
        if H(MEGANE) and s.deck: return P(MEGANE, 'search')
        if H(KARASU) and s.discard:
            t = max(s.discard, key=lambda c: card_value(s, p, c))
            if card_value(s, p, t) >= 6: return P(KARASU, 'recover', t)
        if H(KURO) and len(me.hand) >= 3: return P(KURO, 'filter')
        if H(YOMI) and v.inDisc(GOB): return P(YOMI, 'board', GOB)
        if H(YOMI) and v.inDisc(KODOMO) and not oppGob and not v.myF(KODOMO): return P(YOMI, 'board', KODOMO)
        return None

    def negate(self, s, p, card):
        v = View(s, p, use_misses=True)
        me, op = v.me, v.op
        m, o = me.chips, op.chips
        if m < 1:
            return False
        answer_held = v.H(OWAKARE) or (v.H(IREKAE) and not v.opF(KODOMO))
        if card == IDEYON:
            if v.myF(HARA) or v.opF(HARA): return False
            ph = v.pOpp(HARA)
            if ph == 0: return False
            if HARA in v.known: return True
            b = sum(1 for r in s.ideyon_results[1 - p] if r != HARA)
            if b >= 1 and ph < 0.5 + 0.15 * (b - 1): return False
            return True
        if card == YOMI:
            if v.inDisc(HARA): return True
            return v.inDisc(GOB) and m >= 2 and (v.myF(KODOMO) or (v.H(KNIFE) and op.life <= 2))
        if card == IREKAE:
            a, b = sim_irekae(s, p)
            return a or b
        if card == OWAKARE:
            if v.myF(HARA): return True
            return v.myF(GOB) and m >= 2 and danger_knife(s, p, v, ignore_my_gob=True) >= 0.3
        if card == KNIFE:
            if v.myF(GOB): return False
            if me.life <= 2: return True
            if me.life == 3 and v.opF(KODOMO): return True
            return m >= self.knife_neg_m or (m == 2 and v.H(MAJO) and s.stock > 0)
        if card == KODOMO:
            return (not v.myF(GOB)) and me.life <= 2 and m >= 2
        if card == GOB:
            if v.H(KNIFE) and op.life <= 2: return True
            return m >= 2 and (v.myF(KODOMO) or v.H(KNIFE) or v.H(KODOMO))
        if card == FUKIYA:
            if v.opF(HARA) and answer_held: return True
            if v.H(HARA) and v.H(IDEYON) and m >= 2: return True
            return m >= 3
        if card == SUISHO:
            if v.opF(HARA) and any(v.H(a) and a in s.known[1 - p] for a in (OWAKARE, IREKAE)): return True
            return m >= 1 and any(c in me.hand and card_value(s, p, c) >= 7 for c in s.known[1 - p])
        if card == MEGANE:
            return v.myF(HARA) and any(v.isUnseen(a) for a in (OWAKARE, IREKAE))
        if card == KARASU:
            return v.myF(HARA) and any(v.inDisc(a) for a in (OWAKARE, IREKAE))
        if card in (GIN, KURO):
            if v.myF(HARA) and m >= 2: return True
            return card == GIN and s.turn_count <= 2 and m >= 2 and v.H(MAJO) and s.stock > 0
        if card == MAJO:
            return o == 1 and m >= 2 and v.pOpp(HARA) > 0.4
        return False

    def counter(self, s, p, card, intent):
        if intent in self.COUNTER_INTENTS:
            return True
        return intent == 'strip' and s.players[p].chips >= 3

    def choose(self, s, p, opts, card):
        if card == FUKIYA:
            t = self.planned_target(card, opts)
            if t is not None:
                return t
            v = View(s, p)
            strip = v.H(HARA) or v.myF(HARA) or (self.plan and self.plan['intent'] == 'strip')
            order = (OWAKARE, IREKAE, HARA, KNIFE, GOB) if strip else (HARA, OWAKARE, IREKAE, KNIFE, GOB)
            for c in order:
                if c in opts and not (c == IREKAE and v.myF(KODOMO)):
                    return c
            return max(opts, key=lambda c: threat_value(s, p, c))
        return super().choose(s, p, opts, card)

    def discard_one(self, s, p, opts):
        v = View(s, p)

        def val(c):
            x = card_value(s, p, c)
            if c == HARA:
                x += 2
                if v.H(YOMI): x -= 4
            if c in (OWAKARE, IREKAE): x += 2
            if c == KNIFE and v.H(KARASU): x += 1
            return x
        return min(opts, key=val)

    def declare(self, s, p):
        if self.plan and self.plan['card'] == SUISHO and self.plan['target'] is not None:
            return self.plan['target']
        v = View(s, p, use_misses=True)
        return max([c for c in ALL if c != SUISHO], key=lambda c: v.pOpp(c) * threat_value(s, p, c))


def make_v2_variant(rng):
    """癖をランダムに変えたv2（相手の多様性を増やすため）。"""
    return CPUv2(land_t=rng.uniform(0.35, 0.8), bait_t=rng.uniform(0.1, 0.5),
                 bluff=rng.choice([0.0, 0.0, 0.25, 0.6]), board_first=rng.random() < 0.4,
                 knife_neg_m=rng.choice([2, 3, 9]))


class RandomCPU:
    def act(self, s, req):
        r = s.rng
        if req.kind == 'play':
            if not req.options or r.random() < 0.15:
                return None
            return (r.choice(req.options), '')
        if req.kind == 'negate':
            return r.random() < 0.3
        if req.kind == 'counter':
            return r.random() < 0.5
        return r.choice(req.options)


def arena(make_a, make_b, n=2000, seed=0):
    """Aの勝率（座席と先攻・後攻を交互に入れ替え）"""
    rng = random.Random(seed)
    wins = 0
    for i in range(n):
        a_seat, first = i % 2, (i >> 1) % 2
        s = State(first, random.Random(rng.random()))
        agents = [make_a(), make_b()] if a_seat == 0 else [make_b(), make_a()]
        if play_match(s, agents) == a_seat:
            wins += 1
    return wins / n
