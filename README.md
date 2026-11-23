# はらぺこバハムート vs CPU

ボードゲーム「はらぺこバハムート」をブラウザで遊べる対戦アプリです。強化学習で鍛えたCPU（AI5／AI6／AI6.5）と、ルールベースのCPU（ふつう／つよい）と対戦できます。合言葉で部屋に入れば、知り合いとオンライン対戦もできます（`docs/ONLINE.md`）。

- 遊ぶ：https://chk31.github.io/baha-in-browser/ （GitHub Pages。`main` に push すると自動で更新）
- 作る：`python app/build.py` で `site/index.html` ができる（外部ライブラリ不要の1ファイル）
- 確認：`node tests/smoke.js`、`node tests/regression.js 300`

- 記録：対戦記録を GitHub の `records` ブランチに貯められる（`docs/RECORDS.md`）

詳しくは `docs/` と `CLAUDE.md` を参照。
