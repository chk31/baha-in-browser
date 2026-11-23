# 対戦記録の保存（GitHub Pages 版）

## どうなっているか
- CPU対戦が終わるたびに、記録をこの端末のブラウザ（localStorage）に残す。「過去の記録」と、タイトル画面の CPU 勝率バッジはこれを使う（その端末で遊んだ分だけ。最大300局）。
- タイトル画面の「GitHub保存」で鍵を設定した端末では、記録を GitHub にも保存する。
  - 保存先：このリポジトリの **`records` ブランチ** の `records/年/月/<id>.json`（1局1ファイル、1局 20〜30KB ほど）。
  - `main` に入れないのは、push のたびに GitHub Pages が作り直されるのを避けるため。
  - 送れなかった記録（電波が無い等）は端末にためておき（最大50局）、次にページを開いたときや回線が戻ったときに送り直す。
- オンライン対戦の記録は保存しない。
- claude.ai のアーティファクト版は、今まで通り claude.ai の DB に保存する（GitHub 保存の設定は出ない）。

## claude.ai 版の記録の移行
claude.ai 版から書き出した JSON（`{exportedAt,count,games:[…]}`）は、次の2か所に入れられる。
- GitHub：`records` ブランチの `records/年/月/<id>.json` に、1局1ファイルで入れる（2026-11-23 に86局を入れた。`imported` の項目が付く）。構造化ログ `ev` は無いので、`records_to_jsonl.py` では飛ばされる。
- この端末：「対戦の記録」→「記録ファイルを読み込む」。同じ id は飛ばす。勝率バッジに反映される。

## 鍵の作り方（端末ごとに一度）
1. GitHub → 右上のアイコン → Settings → Developer settings → Personal access tokens → **Fine-grained tokens** → Generate new token。
2. Expiration は好みで（切れたら作り直して貼り直す）。
3. Repository access：**Only select repositories** で `baha-in-browser` だけを選ぶ。
4. Permissions → Repository permissions → **Contents：Read and write**（Metadata：Read-only は自動で付く）。
5. 出てきた `github_pat_…` を、アプリのタイトル画面「GitHub保存」→「鍵」に貼り、「保存して接続を確かめる」。`records` ブランチが無ければ、このとき作られる。

鍵はその端末のブラウザの中だけに保存され、ページにも GitHub にも書き込まれない。その端末で鍵を入れた人なら誰でも保存できるので、人に貸す端末には入れない。「鍵を消す」で消せる。万一漏れたら GitHub の同じ画面でその鍵を削除する。

リポジトリが公開なら、貯めた記録も誰でも読める（中身は対戦の流れと手札で、個人情報は入らない）。

## 記録の中身
`saveGame` が作るもの（claude.ai 版の DB と同じ項目）に、`version`・`id`・`cards`（カード名）・`ev`（構造化ログ。形式は `LOG_FORMAT.md`）を足したもの。
プレイヤー番号は 0=人間、1=CPU。`first` / `winner` は「あなた」「CPU」の文字。`agree` は AI のおすすめと同じ選択をした回数、`snapshots` は各ターン開始時の状態（カード名）。

## 分析に使う
```
git fetch origin records
git worktree add ../baha-records origin/records     # 初回だけ。以後は git fetch して worktree を更新
python tools/records_to_jsonl.py ../baha-records/records data/human_games.jsonl.gz [--level AI6.5]
python tools/check_log.py data/human_games.jsonl.gz
```
できた `jsonl.gz` は `tools/games.py` の `load()` / `plays()` / `decisions()` でそのまま読める（`seed` は None）。
