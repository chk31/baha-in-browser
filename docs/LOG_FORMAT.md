# 構造化ログの形式

`engine.js` は、文章ログ `s.log`（画面用）とは別に、構造化ログ `s.ev` を作る。

## 保存ファイル（`*.jsonl.gz`）
- 1行目：ヘッダ `{"header":true,"version":1,"agents":[…],"cards":[カード名×16]}`。ログ内のカードは番号なので、`cards` で名前に戻す。
- 2行目以降：1局ずつ `{"seed","first","winner","turns","ev":[…]}`。プレイヤーは 0/1、`first` が先攻。

## イベント
すべて `{"k":種類,"t":ターン,"p":手番,…}` の形。`turn`・`turnEnd`・`end`・`decide` には、その時点の状態 `st`（`life, chips, stock, hand, field, deck, discard, plays, known`）が付く。

| k | 中身 |
|---|---|
| `start` | `first`, `hands`（初手）, `deck`（山札の並び） |
| `turn` / `turnEnd` / `end` | ターンの始まり・終わり・決着（`winner`） |
| `decide` | AIや人間の判断：`who`, `kind`（play/negate/counter/choose/discard/declare）, `options`, `card`, `choice`, `st` |
| `play` | `who`, `card`, `intent`（`rule` なら確定手ルールが選んだ手） |
| `negate` / `counter` | 打ち消し・うちけし返し。直後の書の枚数 `chips` |
| `resolved` | `ok`：効果が発動したか |
| `damage` | `src`, `aim`（狙い）, `to`（受けた側）, `amt`, `refl`（ゴブリンで跳ね返ったか）, `life` |
| `attack` | 手番の始めの攻撃（`src`） |
| `draw` / `discard` / `recover` / `search` / `snipe` / `declare` | 引いた・捨てた・回収・メガネ・吹き矢（`seen`：見た手札）・水晶（`hit`） |
| `enter` / `leave` / `gainChip` / `irekae` / `fizzle` / `reshuffle` | 場に出た・場を離れた・書を得た・入れ替え・不発・山札の切り直し |

まだ記録していないもの：黒ネコ・砂時計の「追加プレイ」（次の `st.plays` で分かる）。

## 道具
- `node tools/record.js 6000 out.jsonl.gz 1`：AI6同士で対戦して保存（6,000局で約80秒）
- `node tools/show_game.js data/games_ai6_6000.jsonl.gz 345`：1局を、ターンごとのライフ・書・手札つきで表示
- `node tools/replay.js data/games_ai6_6000.jsonl.gz 345`：同じシードで対戦し直し、画面と同じ文章ログを出す（保存と一致するかも確認）
- `python tools/games.py`：`load()`、`plays()`（1プレイ＝1行）、`decisions()`（1判断＝1行）。pandas を使う
- `python tools/check_log.py data/games_ai6_6000.jsonl.gz`：書とライフの整合性チェック
