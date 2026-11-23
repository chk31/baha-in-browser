"""構造化ログの読み込み。
  from games import load
  H, G = load('games_ai6.jsonl.gz')     # H=ヘッダ（カード名など）, G=局のリスト
  plays(G), decisions(G) で表（pandas.DataFrame）にできる
"""
import gzip, json
def load(path):
    with gzip.open(path, 'rt', encoding='utf-8') as f:
        H = json.loads(f.readline()); G = [json.loads(l) for l in f]
    return H, G
def seat(g, p): return '先攻' if p == g['first'] else '後攻'
def plays(G):
    """1行=1プレイ：誰が・何を・その時のライフと書・打ち消されたか・勝ったか"""
    import pandas as pd
    rows = []
    for g in G:
        cur = None
        for e in g['ev']:
            if e['k'] == 'decide' and e['kind'] == 'play': cur = e['st']
            if e['k'] == 'play':
                p = e['who']; o = 1 - p; st = cur
                rows.append(dict(seed=g['seed'], t=e['t'], who=p, seat=seat(g, p), card=e['card'],
                    my_life=st['life'][p], op_life=st['life'][o], my_chips=st['chips'][p], op_chips=st['chips'][o],
                    stock=st['stock'], win=int(g['winner'] == p), negated=None))
            if e['k'] == 'resolved': rows[-1]['negated'] = int(not e['ok'])
    return pd.DataFrame(rows)
def decisions(G):
    """1行=1判断（play/negate/counter/choose/discard/declare）と、その時の状態"""
    import pandas as pd
    rows = []
    for g in G:
        for e in g['ev']:
            if e['k'] != 'decide': continue
            p = e['who']; o = 1 - p; st = e['st']
            rows.append(dict(seed=g['seed'], t=e['t'], who=p, seat=seat(g, p), kind=e['kind'], card=e.get('card'),
                options=e.get('options'), choice=e['choice'], my_life=st['life'][p], op_life=st['life'][o],
                my_chips=st['chips'][p], op_chips=st['chips'][o], my_hand=st['hand'][p], op_hand=st['hand'][o],
                my_field=st['field'][p], op_field=st['field'][o], known=st['known'][p], win=int(g['winner'] == p)))
    return pd.DataFrame(rows)
