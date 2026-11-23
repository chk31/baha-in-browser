"""GitHub の records ブランチに貯まった対戦記録（records/年/月/*.json）を、構造化ログの形式（docs/LOG_FORMAT.md）の
jsonl.gz にまとめる。tools/games.py の load() / plays() / decisions() でそのまま読める。

使い方:
  git fetch origin records
  git worktree add ../baha-records origin/records      # 初回だけ（以後は  cd ../baha-records && git pull  でもよい）
  python tools/records_to_jsonl.py ../baha-records/records out.jsonl.gz [--level AI6.5]

プレイヤー番号は 0=人間（あなた）、1=CPU。seed は無い（実際の対戦なので None）。各局に id・level・rules・hint・endedAt も付ける。
"""
import gzip, json, os, sys


def main():
    args = sys.argv[1:]
    level = None
    if '--level' in args:
        i = args.index('--level'); level = args[i + 1]; del args[i:i + 2]
    if len(args) != 2:
        print(__doc__); sys.exit(1)
    src, out = args
    games, cards = [], None
    for root, _, files in os.walk(src):
        for fn in files:
            if not fn.endswith('.json'):
                continue
            with open(os.path.join(root, fn), encoding='utf-8') as f:
                r = json.load(f)
            if level and r.get('level') != level:
                continue
            if not r.get('ev'):
                continue
            cards = cards or r.get('cards')
            games.append(dict(seed=None, id=r['id'], level=r.get('level'), rules=r.get('rules'), hint=r.get('hint'),
                              endedAt=r.get('endedAt'), first=0 if r['first'] == 'あなた' else 1,
                              winner=0 if r['winner'] == 'あなた' else 1, turns=r.get('turns'), ev=r['ev']))
    games.sort(key=lambda g: g['endedAt'] or '')
    levels = sorted({g['level'] for g in games if g['level']})
    with gzip.open(out, 'wt', encoding='utf-8') as f:
        f.write(json.dumps(dict(header=True, version=1, agents=['人間', '/'.join(levels) or 'CPU'], cards=cards or []),
                           ensure_ascii=False) + '\n')
        for g in games:
            f.write(json.dumps(g, ensure_ascii=False, separators=(',', ':')) + '\n')
    win = sum(g['winner'] == 0 for g in games)
    print(f'{out}: {len(games)}局（人間 {win}勝 {len(games) - win}敗）')


if __name__ == '__main__':
    main()
