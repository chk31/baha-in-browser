# 構造化ログの整合性チェック：イベントから数え直した書・ライフが、各ターン開始時の状態と一致するか
import sys; from games import load
H, G = load(sys.argv[1]); bad = 0
for g in G:
    chips = [2, 2]; life = [4, 4]
    for e in g['ev']:
        if e['k'] == 'negate': chips[e['who']] -= 1
        if e['k'] == 'counter': chips[e['who']] -= 2
        if e['k'] == 'gainChip': chips[e['who']] += 1
        if e['k'] == 'damage': life[e['to']] = e['life']
        if 'st' in e and (e['st']['chips'] != chips or e['st']['life'] != life): bad += 1; break
    assert g['ev'][-1]['k'] == 'end' and g['ev'][-1]['winner'] == g['winner']
print('局', len(G), '不一致', bad)
