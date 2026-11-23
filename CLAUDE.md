# はらぺこバハムート 対戦アプリ（Claude Code 向けの手引き）

ボードゲーム「はらぺこバハムート」の対戦アプリと、その強化学習CPUの開発リポジトリです。
これまで claude.ai のチャットで開発してきたものを、ここからは Claude Code で開発します。
**最初に `docs/SUMMARY.md`（経緯）と `docs/RULES.md`（ゲームのルール）を読んでください。**

ユーザーとのやり取りは日本語で行います。

## 今回の目標
1. **GitHub Pages でサイトを公開する。** `.github/workflows/pages.yml` で `app/build.py` を実行し、`site/index.html` を公開する。
2. **合言葉（ルームコード）で遊べるオンライン対戦を作る。** 設計案は `docs/ONLINE_PLAN.md`。方式（P2Pか、Firebaseなどのサーバーか）は、**作り始める前にユーザーに確認する。**
3. 既存のCPU対戦は、今の動きのまま残す。

## 中身
| 場所 | 中身 |
|---|---|
| `app/ui.html` | 画面とCPU対戦の流れ。`/*ENGINE*/` などの目印に各部品を埋め込む |
| `app/engine.js` | ゲームエンジン（非同期。各判断をエージェントに問い合わせる）。文章ログ `s.log` と構造化ログ `s.ev` を持つ |
| `app/rules.js` | 確定手ルール（R1〜R8）。`withRules(エージェント)` で包む |
| `app/rl.js`, `app/weights/` | 強化学習CPUの推論（JSで順伝播）と重み。アプリが使うのは AI5・AI6・AI6.5。AI2〜AI4 は分析用に残しているだけ |
| `app/cpu2.js` | ルールベースCPU「つよい」（「ふつう」は engine.js 内） |
| `app/art.js` | カードの絵 |
| `app/online.js`, `app/online_config.js` | オンライン対戦（合言葉）。ホストが進行役。通信は PeerJS か Firebase（`docs/ONLINE.md`） |
| `app/records.js` | GitHub Pages 版の対戦記録：端末に残し、鍵を設定した端末では GitHub の `records` ブランチに保存（`docs/RECORDS.md`） |
| `app/build.py` | 1ファイルのページ `site/index.html` を作る |
| `app/load_all.js` | Node.js から全部品を読み込む（テスト・分析用） |
| `tools/` | 対戦の記録・表示・再現（`docs/LOG_FORMAT.md`） |
| `tests/` | 動作確認・回帰テスト・JS/Python のルール照合 |
| `python/` | 学習側（ローカルPC）と同じ Python のエンジンと確定手ルール。照合テスト用 |
| `data/games_ai6_6000.jsonl.gz` | AI6同士 6,000局の構造化ログ（回帰テストの基準） |

## 守ること
- **ゲームのルール（`engine.js`）と確定手ルール（`rules.js`）は、ユーザーに確認せずに変えない。** 変えると学習側（Python）とずれる。変えるときは `python/` の同じ箇所も直し、照合テストを通す。
- **確定手ルールに経験則を足さない。** ルールは「勝ちが確定する手（R1）」「負けを避ける手（R2）」と、それを支える確実な判断だけ。弱い判断は学習で直す方針。R3（対処の道を残す）は不確実なので外した。新しいルールを思いついたら、提案してユーザーの判断を待つ。
- **対戦中の先読み（探索）はアプリに入れない。** 単一のモデルが明確なミスをしないことを目指している。
- **CPUの重み（`app/weights/`）は学習側から届いたものを変換するだけ。** 手で直さない。
- 画面の文言は日本語。スマホ（iPhone）で遊ぶことが多いので、狭い画面で崩れないようにする。

## 確認の手順（変更したら毎回）
```
node tests/smoke.js                 # 全CPUの総当たりで例外なく終わるか（数秒）
node tests/regression.js 300        # 保存した対戦を再現し、挙動が変わっていないか（数秒）
python app/build.py                 # site/index.html を作る
```
ルールを触ったときは、加えて:
```
python python/dump_states.py 300 /tmp/states.json && node tests/parity_js_py.js /tmp/states.json
```
最後の行に「不一致」が出なければ、JS と Python の判断は一致している。

`regression.js` が不一致を出したら、挙動が変わっている。意図した変更なら、ユーザーに伝えたうえで `node tools/record.js 6000 data/games_ai6_6000.jsonl.gz 1` で基準を作り直す。

## アプリの仕組みで知っておくこと
- **エンジンはエージェント方式。** `runGame(s, [agent0, agent1])` が進行し、判断が必要になるたびに `agent.choosePlay / decideNegate / decideCounter / chooseCard / chooseDiscard / declareName` を `await` する。人間の側は `ui.html` の `human` がボタン入力を待つ Promise を返す。**オンライン対戦の相手は、この同じ口を持つ「通信エージェント」として作れる。**
- 画面の更新は `s.hooks.update(kind)` から呼ばれる。
- 乱数は `newGame(first, rng)` に渡す関数だけを使う（`tools/rec_lib.js` の `mulberry32` でシード化できる）。AI は乱数を使わない。
- 対戦記録の保存（`saveGame`）と過去の記録（`loadRecords`）は、claude.ai のアーティファクトでは DB（`claude.use('db')`）を使う。**GitHub Pages 版（`claude` が無いとき）は `app/records.js`**：端末の localStorage に残し、鍵（fine-grained トークン）を設定した端末では GitHub の `records` ブランチの `records/年/月/<id>.json` に1局1ファイルで保存する。構造化ログ `ev` も入る。分析用には `tools/records_to_jsonl.py` で jsonl.gz にまとめる（`docs/RECORDS.md`）。
- `engine.js` は構造化ログ `s.ev` も作る。ゲームの進み方は、構造化ログを入れる前の版と同じであることを確認済み。

## 現状（2026-11-23）
- 公開中のアプリ（claude.ai のアーティファクト）は CPU 5段階：ふつう／つよい／AI5／AI6／AI6.5（初期値）。
- 最新は **AI6.5**（AI5 から 3,000万ステップ）。AI6 に 0.55〜0.56、AI5 に 0.61〜0.63。過去の全モデルに勝ち越し、すくみ（非推移）は無い。
- 学習は別途、ユーザーのローカルPCで Claude Code（VS Code 拡張）が回している。このリポジトリでは学習はしない。
- 対戦記録を GitHub（`records` ブランチ）に貯められるようにした（`docs/RECORDS.md`）。
- オンライン対戦（合言葉）を追加。今は PeerJS（WebRTC）でつなぐ。`app/online_config.js` に Firebase の設定を入れると Firebase に切り替わる（`docs/ONLINE.md`）。
- 直近の修正：R8 に「打ち消す側の手札が0枚なら、相手のひらめき水晶は打ち消さない」を追加（JS・Python とも）。
