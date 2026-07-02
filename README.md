# 製図ツール (seizu-tool)

Excel感覚でグリッドに線を引ける軽量2D製図ツール。単一HTMLで動作。
要件: [drawing-tool-requirements.md](drawing-tool-requirements.md)

## 使う

`dist/seizu.html` をブラウザ(Chrome/Edge推奨)で開くだけ。配布もこのファイル1つをコピーするだけ。

### 基本操作

| 操作 | 方法 |
|---|---|
| 作図 | ツールバーで直線/連続線/矩形を選びクリック |
| 数値作図 | 下部パネルに始点X/Y・長さ・角度を入れて「作図」 |
| パン | 中ボタンドラッグ または Space+ドラッグ |
| ズーム | マウスホイール(グリッドが自動で 10/5/2/1/0.5/0.1mm 切替) |
| 選択 | 選択ツールでクリック / 空白からドラッグで範囲選択 |
| 移動 | 選択した図形をドラッグ |
| 複製 | Ctrl+D(+10mm,+10mmへ) |
| 削除 | Delete |
| Undo / Redo | Ctrl+Z / Ctrl+Y |
| 保存 / 開く | Ctrl+S / Ctrl+O(Chrome/Edgeなら同じファイルに上書き保存) |
| 図面を開く | JSONファイルをウィンドウへドラッグ&ドロップでも可 |
| 原点設定 | 「原点設定」を選んでクリック(座標表示の基準が変わる) |

## 開発

- `npm install` — 初回のみ
- `npm test` — ロジックのテスト
- `npm run dev` — http://localhost:8000 で開発サーバー
- `npm run build` — `dist/seizu.html` を生成
