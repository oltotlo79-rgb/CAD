# 2D製図ツール Phase 1「土台」実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 単一HTMLで配布できる2D製図ツールの土台 — 座標系・縮尺・グリッド自動切替・用紙枠・ユーザー原点・JSON保存/読込(上書き+フォールバック)・直線/連続線/矩形の作図 — を作る。

**Architecture:** 純粋ロジック(座標変換・グリッド計算・データモデル・シリアライズ・履歴)は `src/` のESモジュールに分離し `node --test` でTDD。Canvas描画とUI(`renderer.js` / `app.js`)は薄い層とし手動検証。配布時は esbuild で1本にバンドルし `dist/seizu.html` に埋め込む(実行時依存ゼロ)。

**Tech Stack:** Vanilla JS (ESモジュール) / HTML Canvas / Node.js組み込みテストランナー / esbuild(開発時のみ)

**要件対応:** `drawing-tool-requirements.md` v0.2 の §2〜§5, §7(回転を除く), §11(枠のみ・表題欄はPhase外), §12(IndexedDBスナップショットはPhase 1外), §15 Phase 1。
- 座標規約: エンティティ・ユーザー原点は**実寸mm**、用紙枠は**用紙mm**。縮尺k = ratio[0]/ratio[1] で 実寸→用紙 変換(1:5 → k=0.2)。y軸上向き、画面描画時のみy反転。
- 実寸空間の原点(0,0)は用紙左下に一致させ、縮尺は用紙原点を中心に適用する。
- Undo/Redoはエンティティ+nextId+ユーザー原点のスナップショット方式。用紙・縮尺等の設定変更はPhase 1ではUndo対象外。
- 回転はPhase 2以降に先送り(§7の編集のうち移動・複製・削除のみPhase 1)。

---

## ファイル構成

```
package.json          — scripts: test / dev / build。devDependencies: esbuild
.gitignore            — node_modules/ dist/ www/app.js
src/papers.js         — 用紙サイズ表・図面枠矩形
src/viewTransform.js  — 実寸mm↔用紙mm↔画面px変換、ズーム、フィット
src/gridCalc.js       — グリッド段階の自動選択
src/geometry.js       — 点・線分の幾何計算、グリッドスナップ
src/model.js          — ドキュメント生成、エンティティCRUD、縮尺文字列パース
src/serializer.js     — JSON化・読込検証
src/history.js        — Undo/Redoスタック
src/renderer.js       — Canvas描画(用紙・枠・グリッド・図形・原点・ドラフト)
src/fileio.js         — File System Access API + ダウンロードフォールバック
src/app.js            — 全体の配線(イベント・ツール・ステータスバー)
www/index.html        — UIマークアップ(開発時ページ兼配布テンプレート)
www/styles.css        — レイアウト
build.mjs             — dist/seizu.html 生成(JS/CSSインライン化)
test/*.test.js        — 各純粋モジュールのテスト
```

---

### Task 1: プロジェクト scaffold

**Files:**
- Create: `package.json`, `.gitignore`, `test/sanity.test.js`

- [ ] **Step 1: package.json と .gitignore を作成**

`package.json`:
```json
{
  "name": "seizu-tool",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "node --test",
    "dev": "esbuild src/app.js --bundle --outfile=www/app.js --servedir=www --watch",
    "build": "node build.mjs"
  },
  "devDependencies": {
    "esbuild": "^0.25.0"
  }
}
```

`.gitignore`:
```
node_modules/
dist/
www/app.js
```

- [ ] **Step 2: esbuild をインストール**

Run: `npm install`
Expected: `node_modules/` が作成され、エラーなし。

- [ ] **Step 3: サニティテストを作成して実行**

`test/sanity.test.js`:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';

test('テストランナーが動く', () => {
  assert.equal(1 + 1, 2);
});
```

Run: `npm test`
Expected: `pass 1` で終了コード0。

- [ ] **Step 4: Commit**

```bash
git add package.json .gitignore test/sanity.test.js package-lock.json
git commit -m "chore: scaffold project with esbuild and node test runner"
```

---

### Task 2: papers.js — 用紙サイズと図面枠

**Files:**
- Create: `src/papers.js`
- Test: `test/papers.test.js`

- [ ] **Step 1: 失敗するテストを書く**

`test/papers.test.js`:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { paperDimensions, frameRect, FRAME_MARGIN_MM } from '../src/papers.js';

test('A4縦は210×297mm', () => {
  assert.deepEqual(paperDimensions('A4', 'portrait'), { width: 210, height: 297 });
});

test('A3横は420×297mm', () => {
  assert.deepEqual(paperDimensions('A3', 'landscape'), { width: 420, height: 297 });
});

test('B4縦は257×364mm (JIS B列)', () => {
  assert.deepEqual(paperDimensions('B4', 'portrait'), { width: 257, height: 364 });
});

test('未知の用紙サイズは例外', () => {
  assert.throws(() => paperDimensions('A9', 'portrait'), /unknown paper size/);
});

test('図面枠は全周10mm内側', () => {
  assert.equal(FRAME_MARGIN_MM, 10);
  assert.deepEqual(frameRect('A4', 'portrait'),
    { x: 10, y: 10, width: 190, height: 277 });
});
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `npm test`
Expected: FAIL(`Cannot find module ... papers.js`)

- [ ] **Step 3: 実装**

`src/papers.js`:
```js
// 縦置き(portrait)基準の寸法。B列はJIS B。
export const PAPER_SIZES = {
  A2: { width: 420, height: 594 },
  A3: { width: 297, height: 420 },
  A4: { width: 210, height: 297 },
  B3: { width: 364, height: 515 },
  B4: { width: 257, height: 364 },
  B5: { width: 182, height: 257 },
};

export const FRAME_MARGIN_MM = 10;

export function paperDimensions(size, orientation) {
  const base = PAPER_SIZES[size];
  if (!base) throw new Error(`unknown paper size: ${size}`);
  return orientation === 'landscape'
    ? { width: base.height, height: base.width }
    : { width: base.width, height: base.height };
}

// 用紙mm・左下原点の図面枠矩形
export function frameRect(size, orientation) {
  const { width, height } = paperDimensions(size, orientation);
  return {
    x: FRAME_MARGIN_MM,
    y: FRAME_MARGIN_MM,
    width: width - FRAME_MARGIN_MM * 2,
    height: height - FRAME_MARGIN_MM * 2,
  };
}
```

- [ ] **Step 4: テストが通ることを確認**

Run: `npm test`
Expected: 全PASS。

- [ ] **Step 5: Commit**

```bash
git add src/papers.js test/papers.test.js
git commit -m "feat: paper size table and drawing frame rect"
```

---

### Task 3: viewTransform.js — 座標変換・ズーム・フィット

**Files:**
- Create: `src/viewTransform.js`
- Test: `test/viewTransform.test.js`

view オブジェクトの形: `{ panX, panY, pxPerMm, canvasWidth, canvasHeight }`(pan は画面左下に表示される用紙mm座標、pxPerMm は用紙1mmあたりの画面px)。

- [ ] **Step 1: 失敗するテストを書く**

`test/viewTransform.test.js`:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  scaleK, realToPaper, paperToReal,
  paperToScreen, screenToPaper, zoomAt, fitPaperView,
} from '../src/viewTransform.js';

const near = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} !~ ${b}`);

test('scaleK: 1:5 は 0.2、2:1 は 2', () => {
  near(scaleK({ ratio: [1, 5] }), 0.2);
  near(scaleK({ ratio: [2, 1] }), 2);
});

test('realToPaper: 1:5 では実寸500mmが紙上100mm', () => {
  const p = realToPaper({ x: 500, y: 250 }, { ratio: [1, 5] });
  near(p.x, 100); near(p.y, 50);
});

test('paperToReal は realToPaper の逆変換', () => {
  const scale = { ratio: [1, 2] };
  const p = paperToReal(realToPaper({ x: 33.3, y: -7 }, scale), scale);
  near(p.x, 33.3); near(p.y, -7);
});

test('y軸: 紙のyが増えると画面yは減る(上向き)', () => {
  const view = { panX: 0, panY: 0, pxPerMm: 2, canvasWidth: 800, canvasHeight: 600 };
  const low = paperToScreen({ x: 0, y: 10 }, view);
  const high = paperToScreen({ x: 0, y: 20 }, view);
  assert.ok(high.y < low.y);
  near(low.y, 600 - 20);
});

test('screenToPaper は paperToScreen の逆変換', () => {
  const view = { panX: -5, panY: 12, pxPerMm: 3.7, canvasWidth: 800, canvasHeight: 600 };
  const p = screenToPaper(paperToScreen({ x: 42, y: 99 }, view), view);
  near(p.x, 42); near(p.y, 99);
});

test('zoomAt はカーソル位置の紙座標を固定する', () => {
  const view = { panX: 0, panY: 0, pxPerMm: 2, canvasWidth: 800, canvasHeight: 600 };
  const cursor = { x: 300, y: 200 };
  const before = screenToPaper(cursor, view);
  const zoomed = zoomAt(view, cursor, 1.5);
  const after = screenToPaper(cursor, zoomed);
  near(zoomed.pxPerMm, 3);
  near(after.x, before.x); near(after.y, before.y);
});

test('fitPaperView で用紙中心が画面中心に来る', () => {
  const view = fitPaperView(420, 297, 1000, 700);
  const c = paperToScreen({ x: 210, y: 148.5 }, view);
  near(c.x, 500); near(c.y, 350);
});
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `npm test`
Expected: FAIL(モジュールなし)

- [ ] **Step 3: 実装**

`src/viewTransform.js`:
```js
export function scaleK(scale) {
  return scale.ratio[0] / scale.ratio[1];
}

export function realToPaper(p, scale) {
  const k = scaleK(scale);
  return { x: p.x * k, y: p.y * k };
}

export function paperToReal(p, scale) {
  const k = scaleK(scale);
  return { x: p.x / k, y: p.y / k };
}

export function paperToScreen(p, view) {
  return {
    x: (p.x - view.panX) * view.pxPerMm,
    y: view.canvasHeight - (p.y - view.panY) * view.pxPerMm,
  };
}

export function screenToPaper(p, view) {
  return {
    x: p.x / view.pxPerMm + view.panX,
    y: (view.canvasHeight - p.y) / view.pxPerMm + view.panY,
  };
}

export function zoomAt(view, screenPoint, factor) {
  const pxPerMm = Math.min(2000, Math.max(0.05, view.pxPerMm * factor));
  const before = screenToPaper(screenPoint, view);
  const next = { ...view, pxPerMm };
  const after = screenToPaper(screenPoint, next);
  return { ...next, panX: next.panX + before.x - after.x, panY: next.panY + before.y - after.y };
}

export function fitPaperView(paperW, paperH, canvasW, canvasH, marginPx = 40) {
  const pxPerMm = Math.min((canvasW - marginPx * 2) / paperW, (canvasH - marginPx * 2) / paperH);
  return {
    pxPerMm,
    panX: -(canvasW / pxPerMm - paperW) / 2,
    panY: -(canvasH / pxPerMm - paperH) / 2,
    canvasWidth: canvasW,
    canvasHeight: canvasH,
  };
}
```

- [ ] **Step 4: テストが通ることを確認**

Run: `npm test`
Expected: 全PASS。

- [ ] **Step 5: Commit**

```bash
git add src/viewTransform.js test/viewTransform.test.js
git commit -m "feat: view transforms (real/paper/screen, zoom, fit)"
```

---

### Task 4: gridCalc.js — グリッド段階の自動選択

**Files:**
- Create: `src/gridCalc.js`
- Test: `test/gridCalc.test.js`

- [ ] **Step 1: 失敗するテストを書く**

`test/gridCalc.test.js`:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { autoGridStep, effectiveGridStep, GRID_STEPS_MM, MIN_GRID_PX } from '../src/gridCalc.js';

test('段階は 0.1/0.5/1/2/5/10 の6種、最小表示は8px', () => {
  assert.deepEqual(GRID_STEPS_MM, [0.1, 0.5, 1, 2, 5, 10]);
  assert.equal(MIN_GRID_PX, 8);
});

test('十分ズームインしていれば 0.1mm を選ぶ', () => {
  assert.equal(autoGridStep(100), 0.1); // 0.1mm = 10px ≥ 8px
});

test('中間ズームでは 8px 以上になる最小の段階を選ぶ', () => {
  assert.equal(autoGridStep(10), 1);   // 0.1→1px, 0.5→5px は不足、1→10px
  assert.equal(autoGridStep(5), 2);    // 2mm → 10px
  assert.equal(autoGridStep(1), 10);   // 10mm → 10px
});

test('ズームアウトしすぎたら null(グリッド非表示)', () => {
  assert.equal(autoGridStep(0.5), null); // 10mm でも 5px < 8px
});

test('effectiveGridStep: manual モードは固定値を返す', () => {
  assert.equal(effectiveGridStep({ mode: 'manual', manualMm: 5 }, 100), 5);
  assert.equal(effectiveGridStep({ mode: 'auto', manualMm: 5 }, 100), 0.1);
});
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `npm test`
Expected: FAIL(モジュールなし)

- [ ] **Step 3: 実装**

`src/gridCalc.js`:
```js
export const GRID_STEPS_MM = [0.1, 0.5, 1, 2, 5, 10];
export const MIN_GRID_PX = 8;
export const MAJOR_STEP_MM = 10;

// pxPerRealMm = 実寸1mmが画面上で何pxか (= scaleK * view.pxPerMm)
export function autoGridStep(pxPerRealMm) {
  for (const step of GRID_STEPS_MM) {
    if (step * pxPerRealMm >= MIN_GRID_PX) return step;
  }
  return null;
}

export function effectiveGridStep(grid, pxPerRealMm) {
  if (grid.mode === 'manual') return grid.manualMm;
  return autoGridStep(pxPerRealMm);
}
```

- [ ] **Step 4: テストが通ることを確認**

Run: `npm test`
Expected: 全PASS。

- [ ] **Step 5: Commit**

```bash
git add src/gridCalc.js test/gridCalc.test.js
git commit -m "feat: automatic grid step selection"
```

---

### Task 5: geometry.js — 幾何計算とスナップ

**Files:**
- Create: `src/geometry.js`
- Test: `test/geometry.test.js`

- [ ] **Step 1: 失敗するテストを書く**

`test/geometry.test.js`:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  round6, distance, angleDegOf, lineEndPoint, snapToGrid, distancePointToSegment,
} from '../src/geometry.js';

const near = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} !~ ${b}`);

test('lineEndPoint: 長さ10・角度0°で x+10', () => {
  assert.deepEqual(lineEndPoint({ x: 5, y: 5 }, 10, 0), { x: 15, y: 5 });
});

test('lineEndPoint: 角度90°で y+10', () => {
  assert.deepEqual(lineEndPoint({ x: 0, y: 0 }, 10, 90), { x: 0, y: 10 });
});

test('distance と angleDegOf は lineEndPoint と整合する', () => {
  const start = { x: 3, y: 4 };
  const end = lineEndPoint(start, 25, 30);
  near(distance(start, end), 25, 1e-6);
  near(angleDegOf(start, end), 30, 1e-6);
});

test('snapToGrid: 0.1mm ステップでも浮動小数のゴミが出ない', () => {
  assert.deepEqual(snapToGrid({ x: 0.32, y: 0.27 }, 0.1), { x: 0.3, y: 0.3 });
  assert.deepEqual(snapToGrid({ x: 14.9, y: -6.2 }, 10), { x: 10, y: -10 });
});

test('distancePointToSegment: 中央上は垂線距離、端の外は端点距離', () => {
  const a = { x: 0, y: 0 }, b = { x: 10, y: 0 };
  near(distancePointToSegment({ x: 5, y: 3 }, a, b), 3);
  near(distancePointToSegment({ x: 14, y: 3 }, a, b), 5);
  near(distancePointToSegment({ x: 2, y: 0 }, a, a), 2); // 零長セグメント
});
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `npm test`
Expected: FAIL(モジュールなし)

- [ ] **Step 3: 実装**

`src/geometry.js`:
```js
const DEG = Math.PI / 180;

export function round6(v) {
  return Math.round(v * 1e6) / 1e6;
}

export function distance(a, b) {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

export function angleDegOf(a, b) {
  return Math.atan2(b.y - a.y, b.x - a.x) / DEG;
}

export function lineEndPoint(start, lengthMm, angleDeg) {
  return {
    x: round6(start.x + lengthMm * Math.cos(angleDeg * DEG)),
    y: round6(start.y + lengthMm * Math.sin(angleDeg * DEG)),
  };
}

export function snapToGrid(p, stepMm) {
  return {
    x: round6(Math.round(p.x / stepMm) * stepMm),
    y: round6(Math.round(p.y / stepMm) * stepMm),
  };
}

export function distancePointToSegment(p, a, b) {
  const abx = b.x - a.x, aby = b.y - a.y;
  const len2 = abx * abx + aby * aby;
  if (len2 === 0) return distance(p, a);
  let t = ((p.x - a.x) * abx + (p.y - a.y) * aby) / len2;
  t = Math.max(0, Math.min(1, t));
  return distance(p, { x: a.x + t * abx, y: a.y + t * aby });
}
```

- [ ] **Step 4: テストが通ることを確認**

Run: `npm test`
Expected: 全PASS。

- [ ] **Step 5: Commit**

```bash
git add src/geometry.js test/geometry.test.js
git commit -m "feat: geometry helpers (line math, grid snap, hit distance)"
```

---

### Task 6: model.js — ドキュメントとエンティティ操作

**Files:**
- Create: `src/model.js`
- Test: `test/model.test.js`

エンティティの形(実寸mm):
- 直線 `{ id, type:'line', layer, lineType, x1, y1, x2, y2 }`
- 矩形 `{ id, type:'rect', layer, lineType, x, y, width, height }`(x,y=左下)
- 連続線 `{ id, type:'polyline', layer, lineType, points:[[x,y],...], closed }`

- [ ] **Step 1: 失敗するテストを書く**

`test/model.test.js`:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createDocument, addEntity, removeEntities, translateEntities,
  duplicateEntities, entitySegments, parseScale, formatScale, DEFAULT_LAYERS,
} from '../src/model.js';

test('createDocument: 仕様どおりの既定値', () => {
  const doc = createDocument();
  assert.equal(doc.format, 'seizu-tool');
  assert.equal(doc.version, 1);
  assert.deepEqual(doc.paper, { size: 'A3', orientation: 'landscape' });
  assert.deepEqual(doc.scale.ratio, [1, 1]);
  assert.deepEqual(doc.userOrigin, { x: 10, y: 10 }); // 図面枠内側・左下
  assert.deepEqual(doc.grid, { mode: 'auto', manualMm: 1 });
  assert.equal(doc.layers.length, 6);
  assert.equal(doc.layers.find((l) => l.id === 'aux').printable, false);
  assert.deepEqual(doc.entities, []);
});

test('createDocument はレイヤー定義を共有しない(独立コピー)', () => {
  const doc = createDocument();
  doc.layers[0].visible = false;
  assert.equal(DEFAULT_LAYERS[0].visible, true);
  assert.equal(createDocument().layers[0].visible, true);
});

test('addEntity は連番idを振り既定レイヤーを付ける', () => {
  const doc = createDocument();
  const a = addEntity(doc, { type: 'line', x1: 0, y1: 0, x2: 10, y2: 0 });
  const b = addEntity(doc, { type: 'rect', x: 0, y: 0, width: 5, height: 5 });
  assert.equal(a.id, 1);
  assert.equal(b.id, 2);
  assert.equal(a.layer, 'outline');
  assert.equal(a.lineType, 'solid');
  assert.equal(doc.entities.length, 2);
});

test('removeEntities は指定idのみ消す', () => {
  const doc = createDocument();
  const a = addEntity(doc, { type: 'line', x1: 0, y1: 0, x2: 1, y2: 0 });
  const b = addEntity(doc, { type: 'line', x1: 0, y1: 0, x2: 2, y2: 0 });
  removeEntities(doc, [a.id]);
  assert.deepEqual(doc.entities.map((e) => e.id), [b.id]);
});

test('translateEntities は line/rect/polyline を平行移動する', () => {
  const doc = createDocument();
  const l = addEntity(doc, { type: 'line', x1: 0, y1: 0, x2: 10, y2: 0 });
  const r = addEntity(doc, { type: 'rect', x: 1, y: 1, width: 5, height: 5 });
  const p = addEntity(doc, { type: 'polyline', points: [[0, 0], [10, 0]], closed: false });
  translateEntities(doc, [l.id, r.id, p.id], 3, -2);
  assert.deepEqual([l.x1, l.y1, l.x2, l.y2], [3, -2, 13, -2]);
  assert.deepEqual([r.x, r.y], [4, -1]);
  assert.deepEqual(p.points, [[3, -2], [13, -2]]);
});

test('duplicateEntities は新idの複製をオフセット付きで作る', () => {
  const doc = createDocument();
  const a = addEntity(doc, { type: 'line', x1: 0, y1: 0, x2: 10, y2: 0 });
  const clones = duplicateEntities(doc, [a.id], 10, 10);
  assert.equal(doc.entities.length, 2);
  assert.notEqual(clones[0].id, a.id);
  assert.deepEqual([clones[0].x1, clones[0].y1], [10, 10]);
  assert.deepEqual([a.x1, a.y1], [0, 0]); // 元は動かない
});

test('entitySegments: 矩形は4辺、閉じた連続線は末尾→先頭の辺を持つ', () => {
  assert.equal(entitySegments({ type: 'rect', x: 0, y: 0, width: 2, height: 3 }).length, 4);
  assert.equal(entitySegments({ type: 'polyline', points: [[0, 0], [1, 0], [1, 1]], closed: false }).length, 2);
  assert.equal(entitySegments({ type: 'polyline', points: [[0, 0], [1, 0], [1, 1]], closed: true }).length, 3);
  assert.equal(entitySegments({ type: 'line', x1: 0, y1: 0, x2: 1, y2: 1 }).length, 1);
});

test('parseScale: "1:5"→[1,5]、全角コロン可、不正はnull', () => {
  assert.deepEqual(parseScale('1:5'), [1, 5]);
  assert.deepEqual(parseScale(' 2 : 1 '), [2, 1]);
  assert.deepEqual(parseScale('1：2.5'), [1, 2.5]);
  assert.equal(parseScale('abc'), null);
  assert.equal(parseScale('0:5'), null);
  assert.equal(parseScale('5'), null);
});

test('formatScale: [1,5]→"1:5"', () => {
  assert.equal(formatScale([1, 5]), '1:5');
});
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `npm test`
Expected: FAIL(モジュールなし)

- [ ] **Step 3: 実装**

`src/model.js`:
```js
import { FRAME_MARGIN_MM } from './papers.js';

export const DEFAULT_LAYERS = [
  { id: 'outline', name: '外形線', visible: true, printable: true },
  { id: 'hidden', name: 'かくれ線', visible: true, printable: true },
  { id: 'center', name: '中心線', visible: true, printable: true },
  { id: 'dim', name: '寸法', visible: true, printable: true },
  { id: 'note', name: '注記', visible: true, printable: true },
  { id: 'aux', name: '補助線', visible: true, printable: false },
];

export function createDocument({ paperSize = 'A3', orientation = 'landscape' } = {}) {
  return {
    format: 'seizu-tool',
    version: 1,
    paper: { size: paperSize, orientation },
    scale: { ratio: [1, 1] },
    userOrigin: { x: FRAME_MARGIN_MM, y: FRAME_MARGIN_MM },
    grid: { mode: 'auto', manualMm: 1 },
    layers: DEFAULT_LAYERS.map((l) => ({ ...l })),
    nextId: 1,
    entities: [],
  };
}

export function addEntity(doc, props) {
  const entity = { layer: 'outline', lineType: 'solid', ...props, id: doc.nextId };
  doc.nextId += 1;
  doc.entities.push(entity);
  return entity;
}

export function removeEntities(doc, ids) {
  const drop = new Set(ids);
  doc.entities = doc.entities.filter((e) => !drop.has(e.id));
}

export function translateEntities(doc, ids, dx, dy) {
  const target = new Set(ids);
  for (const e of doc.entities) {
    if (!target.has(e.id)) continue;
    if (e.type === 'line') {
      e.x1 += dx; e.y1 += dy; e.x2 += dx; e.y2 += dy;
    } else if (e.type === 'rect') {
      e.x += dx; e.y += dy;
    } else if (e.type === 'polyline') {
      e.points = e.points.map(([x, y]) => [x + dx, y + dy]);
    }
  }
}

export function duplicateEntities(doc, ids, dx, dy) {
  const clones = [];
  for (const e of doc.entities.filter((en) => ids.includes(en.id))) {
    const { id, ...rest } = e;
    clones.push(addEntity(doc, structuredClone(rest)));
  }
  translateEntities(doc, clones.map((e) => e.id), dx, dy);
  return clones;
}

export function entitySegments(e) {
  if (e.type === 'line') {
    return [[{ x: e.x1, y: e.y1 }, { x: e.x2, y: e.y2 }]];
  }
  if (e.type === 'rect') {
    const p = [
      { x: e.x, y: e.y },
      { x: e.x + e.width, y: e.y },
      { x: e.x + e.width, y: e.y + e.height },
      { x: e.x, y: e.y + e.height },
    ];
    return [[p[0], p[1]], [p[1], p[2]], [p[2], p[3]], [p[3], p[0]]];
  }
  if (e.type === 'polyline') {
    const pts = e.points.map(([x, y]) => ({ x, y }));
    const segs = [];
    for (let i = 0; i < pts.length - 1; i++) segs.push([pts[i], pts[i + 1]]);
    if (e.closed && pts.length > 2) segs.push([pts[pts.length - 1], pts[0]]);
    return segs;
  }
  return [];
}

export function parseScale(text) {
  const m = String(text).trim().match(/^(\d+(?:\.\d+)?)\s*[:：]\s*(\d+(?:\.\d+)?)$/);
  if (!m) return null;
  const num = Number(m[1]);
  const den = Number(m[2]);
  if (num <= 0 || den <= 0) return null;
  return [num, den];
}

export function formatScale(ratio) {
  return `${ratio[0]}:${ratio[1]}`;
}
```

- [ ] **Step 4: テストが通ることを確認**

Run: `npm test`
Expected: 全PASS。

- [ ] **Step 5: Commit**

```bash
git add src/model.js test/model.test.js
git commit -m "feat: document model, entity CRUD, scale parsing"
```

---

### Task 7: serializer.js — JSON保存/読込と検証

**Files:**
- Create: `src/serializer.js`
- Test: `test/serializer.test.js`

- [ ] **Step 1: 失敗するテストを書く**

`test/serializer.test.js`:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { serialize, deserialize } from '../src/serializer.js';
import { createDocument, addEntity } from '../src/model.js';

test('serialize→deserialize でエンティティと設定が保たれる', () => {
  const doc = createDocument({ paperSize: 'A4', orientation: 'portrait' });
  doc.scale.ratio = [1, 5];
  addEntity(doc, { type: 'line', x1: 0, y1: 0, x2: 100, y2: 0 });
  const restored = deserialize(serialize(doc));
  assert.deepEqual(restored, doc);
});

test('format が違うファイルは拒否する', () => {
  assert.throws(() => deserialize('{"format":"other","version":1}'), /図面ファイルではありません/);
});

test('未対応バージョンは拒否する', () => {
  assert.throws(() => deserialize('{"format":"seizu-tool","version":99}'), /未対応/);
});

test('JSONですらないテキストは拒否する', () => {
  assert.throws(() => deserialize('hello'), /JSON/);
});

test('欠けている設定は既定値で補完される', () => {
  const restored = deserialize('{"format":"seizu-tool","version":1,"entities":[]}');
  assert.deepEqual(restored.grid, { mode: 'auto', manualMm: 1 });
  assert.equal(restored.layers.length, 6);
  assert.equal(restored.nextId, 1);
});

test('nextId が欠けていても既存エンティティの最大id+1に復元される', () => {
  const restored = deserialize(
    '{"format":"seizu-tool","version":1,"entities":[{"id":7,"type":"line","x1":0,"y1":0,"x2":1,"y2":0}]}'
  );
  assert.equal(restored.nextId, 8);
});
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `npm test`
Expected: FAIL(モジュールなし)

- [ ] **Step 3: 実装**

`src/serializer.js`:
```js
import { createDocument } from './model.js';

export function serialize(doc) {
  return JSON.stringify(doc, null, 2);
}

export function deserialize(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('JSONとして読み込めないファイルです');
  }
  if (data.format !== 'seizu-tool') throw new Error('製図ツールの図面ファイルではありません');
  if (data.version !== 1) throw new Error(`未対応のファイルバージョンです: ${data.version}`);

  const base = createDocument();
  const entities = Array.isArray(data.entities) ? data.entities : [];
  const maxId = entities.reduce((m, e) => Math.max(m, e.id ?? 0), 0);
  return {
    ...base,
    ...data,
    paper: { ...base.paper, ...data.paper },
    scale: { ...base.scale, ...data.scale },
    userOrigin: { ...base.userOrigin, ...data.userOrigin },
    grid: { ...base.grid, ...data.grid },
    layers: Array.isArray(data.layers) ? data.layers : base.layers,
    entities,
    nextId: data.nextId ?? maxId + 1,
  };
}
```

- [ ] **Step 4: テストが通ることを確認**

Run: `npm test`
Expected: 全PASS。

- [ ] **Step 5: Commit**

```bash
git add src/serializer.js test/serializer.test.js
git commit -m "feat: JSON serializer with format validation and defaults"
```

---

### Task 8: history.js — Undo/Redo

**Files:**
- Create: `src/history.js`
- Test: `test/history.test.js`

方式: 変更前スナップショット(entities + nextId + userOrigin のJSON文字列)を積む。

- [ ] **Step 1: 失敗するテストを書く**

`test/history.test.js`:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createHistory, snapshot, pushSnapshot, undo, redo, applySnapshot,
} from '../src/history.js';
import { createDocument, addEntity } from '../src/model.js';

test('undo で直前の状態に戻り redo でやり直せる', () => {
  const doc = createDocument();
  const h = createHistory();

  pushSnapshot(h, snapshot(doc));           // 変更前を積む
  addEntity(doc, { type: 'line', x1: 0, y1: 0, x2: 10, y2: 0 });
  assert.equal(doc.entities.length, 1);

  const s1 = undo(h, snapshot(doc));
  applySnapshot(doc, s1);
  assert.equal(doc.entities.length, 0);

  const s2 = redo(h, snapshot(doc));
  applySnapshot(doc, s2);
  assert.equal(doc.entities.length, 1);
});

test('スタックが空のときは null を返す', () => {
  const h = createHistory();
  assert.equal(undo(h, '{}'), null);
  assert.equal(redo(h, '{}'), null);
});

test('新しい変更を積むと redo は消える', () => {
  const doc = createDocument();
  const h = createHistory();
  pushSnapshot(h, snapshot(doc));
  addEntity(doc, { type: 'line', x1: 0, y1: 0, x2: 1, y2: 0 });
  undo(h, snapshot(doc));
  pushSnapshot(h, snapshot(doc)); // 新しい変更
  assert.equal(redo(h, snapshot(doc)), null);
});

test('上限を超えると古いスナップショットから捨てる', () => {
  const h = createHistory(2);
  pushSnapshot(h, 'a');
  pushSnapshot(h, 'b');
  pushSnapshot(h, 'c');
  assert.equal(h.undoStack.length, 2);
  assert.deepEqual(h.undoStack, ['b', 'c']);
});

test('applySnapshot は userOrigin と nextId も復元する', () => {
  const doc = createDocument();
  const before = snapshot(doc);
  doc.userOrigin = { x: 50, y: 50 };
  addEntity(doc, { type: 'line', x1: 0, y1: 0, x2: 1, y2: 0 });
  applySnapshot(doc, before);
  assert.deepEqual(doc.userOrigin, { x: 10, y: 10 });
  assert.equal(doc.nextId, 1);
});
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `npm test`
Expected: FAIL(モジュールなし)

- [ ] **Step 3: 実装**

`src/history.js`:
```js
export function createHistory(limit = 100) {
  return { limit, undoStack: [], redoStack: [] };
}

export function snapshot(doc) {
  return JSON.stringify({
    entities: doc.entities,
    nextId: doc.nextId,
    userOrigin: doc.userOrigin,
  });
}

export function pushSnapshot(history, snap) {
  history.undoStack.push(snap);
  if (history.undoStack.length > history.limit) history.undoStack.shift();
  history.redoStack.length = 0;
}

export function undo(history, currentSnap) {
  if (history.undoStack.length === 0) return null;
  history.redoStack.push(currentSnap);
  return history.undoStack.pop();
}

export function redo(history, currentSnap) {
  if (history.redoStack.length === 0) return null;
  history.undoStack.push(currentSnap);
  return history.redoStack.pop();
}

export function applySnapshot(doc, snap) {
  const data = JSON.parse(snap);
  doc.entities = data.entities;
  doc.nextId = data.nextId;
  doc.userOrigin = data.userOrigin;
}
```

- [ ] **Step 4: テストが通ることを確認**

Run: `npm test`
Expected: 全PASS。

- [ ] **Step 5: Commit**

```bash
git add src/history.js test/history.test.js
git commit -m "feat: snapshot-based undo/redo history"
```

---

### Task 9: UIシェル — index.html / styles.css / renderer.js / app.js(表示・パン・ズーム)

**Files:**
- Create: `www/index.html`, `www/styles.css`, `src/renderer.js`, `src/app.js`

- [ ] **Step 1: www/index.html を作成(全コントロールのマークアップを含む。配線は後続タスク)**

```html
<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>製図ツール</title>
<link rel="stylesheet" href="styles.css">
</head>
<body>
<header id="toolbar">
  <div class="group">
    <button id="file-new">新規</button>
    <button id="file-open">開く</button>
    <button id="file-save">保存</button>
    <button id="file-saveas">名前を付けて保存</button>
  </div>
  <div class="group">
    <button class="tool active" data-tool="select">選択</button>
    <button class="tool" data-tool="line">直線</button>
    <button class="tool" data-tool="polyline">連続線</button>
    <button class="tool" data-tool="rect">矩形</button>
    <button class="tool" data-tool="origin">原点設定</button>
  </div>
  <div class="group">
    <button id="undo">元に戻す</button>
    <button id="redo">やり直し</button>
  </div>
  <div class="group">
    <label>用紙 <select id="paper-size">
      <option>A2</option><option selected>A3</option><option>A4</option>
      <option>B3</option><option>B4</option><option>B5</option>
    </select></label>
    <label><select id="paper-orientation">
      <option value="landscape" selected>横</option>
      <option value="portrait">縦</option>
    </select></label>
    <label>縮尺 <input id="scale-input" size="6" value="1:1"></label>
    <label>グリッド <select id="grid-mode">
      <option value="auto" selected>自動</option>
      <option value="manual">手動</option>
    </select></label>
    <select id="grid-step" disabled>
      <option>10</option><option>5</option><option>2</option>
      <option selected>1</option><option>0.5</option><option>0.1</option>
    </select>
    <label><input type="checkbox" id="grid-snap" checked>スナップ</label>
  </div>
</header>
<main id="canvas-wrap"><canvas id="canvas"></canvas></main>
<section id="numpanel">
  <span>直線の数値入力:</span>
  <label>始点X <input id="num-x" size="7"></label>
  <label>Y <input id="num-y" size="7"></label>
  <label>長さ <input id="num-len" size="7"></label>
  <label>角度 <input id="num-ang" size="7" value="0"></label>
  <button id="num-draw">作図</button>
  <span class="hint">マウス作図中はEnterで数値確定 / Escで中止 / 連続線はEnterかダブルクリックで完了</span>
</section>
<footer id="statusbar">&nbsp;</footer>
<script src="app.js" defer></script>
</body>
</html>
```

- [ ] **Step 2: www/styles.css を作成**

```css
* { box-sizing: border-box; }
html, body { height: 100%; margin: 0; }
body {
  display: flex; flex-direction: column;
  font-family: "Yu Gothic UI", "Meiryo", sans-serif; font-size: 13px;
  background: #2b2e33; color: #ddd;
}
#toolbar {
  display: flex; flex-wrap: wrap; gap: 12px; align-items: center;
  padding: 6px 10px; background: #1e2126; border-bottom: 1px solid #000;
}
#toolbar .group { display: flex; gap: 4px; align-items: center; }
#toolbar .group + .group { border-left: 1px solid #444; padding-left: 12px; }
button { background: #3a3f46; color: #ddd; border: 1px solid #555; border-radius: 3px; padding: 3px 10px; cursor: pointer; }
button:hover { background: #4a5058; }
button.tool.active { background: #0b6bcb; border-color: #0b6bcb; color: #fff; }
select, input { background: #23262b; color: #ddd; border: 1px solid #555; border-radius: 3px; padding: 2px 4px; }
input:disabled, select:disabled { opacity: 0.4; }
#canvas-wrap { flex: 1; min-height: 0; }
#canvas { width: 100%; height: 100%; display: block; cursor: crosshair; }
#numpanel {
  display: flex; gap: 8px; align-items: center;
  padding: 5px 10px; background: #1e2126; border-top: 1px solid #000;
}
#numpanel .hint { color: #888; margin-left: auto; }
#statusbar { padding: 4px 10px; background: #14161a; color: #9ab; font-family: Consolas, monospace; }
```

- [ ] **Step 3: src/renderer.js を作成**

```js
import { paperDimensions, frameRect } from './papers.js';
import { scaleK, paperToScreen, realToPaper } from './viewTransform.js';
import { effectiveGridStep, MAJOR_STEP_MM } from './gridCalc.js';
import { entitySegments } from './model.js';

const COLORS = {
  background: '#3c4048',
  paper: '#ffffff',
  frame: '#222222',
  gridMinor: '#dfe6ee',
  gridMajor: '#b9c6d6',
  entity: '#111111',
  selected: '#0b6bcb',
  draft: '#0a8a3e',
  origin: '#cc4400',
  selectBox: '#0b6bcb',
};

function realToScreen(p, doc, view) {
  return paperToScreen(realToPaper(p, doc.scale), view);
}

export function draw(ctx, state) {
  const { doc, view, selection, draft } = state;
  const paper = paperDimensions(doc.paper.size, doc.paper.orientation);
  const frame = frameRect(doc.paper.size, doc.paper.orientation);
  const k = scaleK(doc.scale);

  ctx.fillStyle = COLORS.background;
  ctx.fillRect(0, 0, view.canvasWidth, view.canvasHeight);

  const tl = paperToScreen({ x: 0, y: paper.height }, view);
  ctx.fillStyle = COLORS.paper;
  ctx.fillRect(tl.x, tl.y, paper.width * view.pxPerMm, paper.height * view.pxPerMm);

  drawGrid(ctx, doc, view, frame, k);

  const ftl = paperToScreen({ x: frame.x, y: frame.y + frame.height }, view);
  ctx.strokeStyle = COLORS.frame;
  ctx.lineWidth = Math.max(1, 0.7 * view.pxPerMm);
  ctx.strokeRect(ftl.x, ftl.y, frame.width * view.pxPerMm, frame.height * view.pxPerMm);

  drawEntities(ctx, doc, view, selection, k);
  drawOrigin(ctx, doc, view);
  if (draft) drawDraft(ctx, doc, view, draft);
}

function drawGrid(ctx, doc, view, frame, k) {
  const pxPerRealMm = k * view.pxPerMm;
  const step = effectiveGridStep(doc.grid, pxPerRealMm);
  if (!step || step * pxPerRealMm < 2) return;

  // 図面枠内側の実寸mm範囲
  const x0 = frame.x / k, x1 = (frame.x + frame.width) / k;
  const y0 = frame.y / k, y1 = (frame.y + frame.height) / k;
  const isMajor = (v) =>
    Math.abs(v / MAJOR_STEP_MM - Math.round(v / MAJOR_STEP_MM)) < 1e-6;

  ctx.lineWidth = 1;
  const drawLine = (a, b, major) => {
    ctx.strokeStyle = major ? COLORS.gridMajor : COLORS.gridMinor;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  };
  for (let i = Math.ceil(x0 / step); i * step <= x1; i++) {
    const x = i * step;
    drawLine(realToScreen({ x, y: y0 }, doc, view), realToScreen({ x, y: y1 }, doc, view), isMajor(x));
  }
  for (let i = Math.ceil(y0 / step); i * step <= y1; i++) {
    const y = i * step;
    drawLine(realToScreen({ x: x0, y }, doc, view), realToScreen({ x: x1, y }, doc, view), isMajor(y));
  }
}

function strokeSegments(ctx, doc, view, segments) {
  ctx.beginPath();
  for (const [a, b] of segments) {
    const sa = realToScreen(a, doc, view);
    const sb = realToScreen(b, doc, view);
    ctx.moveTo(sa.x, sa.y);
    ctx.lineTo(sb.x, sb.y);
  }
  ctx.stroke();
}

function drawEntities(ctx, doc, view, selection, k) {
  const visible = new Map(doc.layers.map((l) => [l.id, l.visible]));
  const baseWidth = Math.max(1, 0.5 * k * view.pxPerMm); // 外形線 0.5mm
  for (const e of doc.entities) {
    if (visible.get(e.layer) === false) continue;
    const isSelected = selection.has(e.id);
    ctx.strokeStyle = isSelected ? COLORS.selected : COLORS.entity;
    ctx.lineWidth = isSelected ? baseWidth + 2 : baseWidth;
    strokeSegments(ctx, doc, view, entitySegments(e));
  }
}

function drawOrigin(ctx, doc, view) {
  const s = realToScreen(doc.userOrigin, doc, view);
  ctx.strokeStyle = COLORS.origin;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(s.x - 10, s.y); ctx.lineTo(s.x + 10, s.y);
  ctx.moveTo(s.x, s.y - 10); ctx.lineTo(s.x, s.y + 10);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(s.x, s.y, 4, 0, Math.PI * 2);
  ctx.stroke();
}

function drawDraft(ctx, doc, view, draft) {
  ctx.save();
  ctx.setLineDash([6, 4]);
  ctx.lineWidth = 1.5;
  if (draft.kind === 'box') {
    ctx.strokeStyle = COLORS.selectBox;
    const { startScreen: a, currentScreen: b } = draft;
    ctx.strokeRect(Math.min(a.x, b.x), Math.min(a.y, b.y), Math.abs(b.x - a.x), Math.abs(b.y - a.y));
  } else {
    ctx.strokeStyle = COLORS.draft;
    if (draft.kind === 'line') {
      strokeSegments(ctx, doc, view, [[draft.start, draft.current]]);
    } else if (draft.kind === 'rect') {
      const x = Math.min(draft.start.x, draft.current.x);
      const y = Math.min(draft.start.y, draft.current.y);
      const e = {
        type: 'rect', x, y,
        width: Math.abs(draft.current.x - draft.start.x),
        height: Math.abs(draft.current.y - draft.start.y),
      };
      strokeSegments(ctx, doc, view, entitySegments(e));
    } else if (draft.kind === 'polyline') {
      const pts = [...draft.points, draft.current];
      const segs = [];
      for (let i = 0; i < pts.length - 1; i++) segs.push([pts[i], pts[i + 1]]);
      strokeSegments(ctx, doc, view, segs);
    }
  }
  ctx.restore();
}
```

- [ ] **Step 4: src/app.js を作成(表示・リサイズ・パン・ズーム・ステータスバーのみ。ツール等のハンドラ枠は後続タスクで拡張)**

```js
import { paperDimensions } from './papers.js';
import * as vt from './viewTransform.js';
import { effectiveGridStep } from './gridCalc.js';
import * as geo from './geometry.js';
import {
  createDocument, addEntity, removeEntities, translateEntities,
  duplicateEntities, entitySegments, parseScale, formatScale,
} from './model.js';
import { serialize, deserialize } from './serializer.js';
import {
  createHistory, snapshot, pushSnapshot, undo, redo, applySnapshot,
} from './history.js';
import { draw } from './renderer.js';
import { createFileIO } from './fileio.js';

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const el = (id) => document.getElementById(id);

const state = {
  doc: createDocument(),
  view: null,
  history: createHistory(100),
  fileio: createFileIO(),
  fileName: '図面.json',
  dirty: false,
  tool: 'select',
  selection: new Set(),
  draft: null,
  gridSnap: true,
  spaceDown: false,
  panDrag: null,   // { startScreen, startPanX, startPanY }
  moveDrag: null,  // { lastReal, snapshotPushed }
  mouseReal: null,
};

// ---- 座標ヘルパー ----
function eventScreen(ev) {
  const r = canvas.getBoundingClientRect();
  return { x: ev.clientX - r.left, y: ev.clientY - r.top };
}
function screenToReal(s) {
  return vt.paperToReal(vt.screenToPaper(s, state.view), state.doc.scale);
}
function pxPerRealMm() {
  return vt.scaleK(state.doc.scale) * state.view.pxPerMm;
}
function currentGridStep() {
  return effectiveGridStep(state.doc.grid, pxPerRealMm());
}
function snapReal(p) {
  const step = state.gridSnap ? currentGridStep() : null;
  return step ? geo.snapToGrid(p, step) : p;
}
function originToAbs(p) {
  return { x: p.x + state.doc.userOrigin.x, y: p.y + state.doc.userOrigin.y };
}

// ---- 描画・状態表示 ----
function render() {
  draw(ctx, state);
  updateStatus();
}
function updateStatus() {
  const o = state.doc.userOrigin;
  const m = state.mouseReal;
  const pos = m ? `X:${(m.x - o.x).toFixed(2)}  Y:${(m.y - o.y).toFixed(2)}` : 'X:--  Y:--';
  const step = currentGridStep();
  const grid = step ? `グリッド:${step}mm${state.doc.grid.mode === 'manual' ? '(手動)' : ''}` : 'グリッド:--';
  el('statusbar').textContent =
    `${pos}   ${grid}   縮尺 ${formatScale(state.doc.scale.ratio)}   表示 ${state.view.pxPerMm.toFixed(1)}px/mm   要素 ${state.doc.entities.length}`;
}
function updateTitle() {
  document.title = `${state.dirty ? '* ' : ''}${state.fileName} - 製図ツール`;
}
function markDirty() {
  state.dirty = true;
  updateTitle();
}
// 変更前スナップショットを積んでから mutator を実行する
function commit(mutator) {
  pushSnapshot(state.history, snapshot(state.doc));
  mutator();
  markDirty();
  render();
}

// ---- キャンバスサイズ・ビュー ----
function refitView() {
  const p = paperDimensions(state.doc.paper.size, state.doc.paper.orientation);
  state.view = vt.fitPaperView(p.width, p.height, canvas.clientWidth, canvas.clientHeight);
}
function resizeCanvas() {
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.clientWidth, h = canvas.clientHeight;
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  if (state.view) {
    state.view = { ...state.view, canvasWidth: w, canvasHeight: h };
  } else {
    refitView();
  }
  render();
}
window.addEventListener('resize', resizeCanvas);

// ---- パン・ズーム ----
canvas.addEventListener('wheel', (ev) => {
  ev.preventDefault();
  const factor = ev.deltaY < 0 ? 1.2 : 1 / 1.2;
  state.view = vt.zoomAt(state.view, eventScreen(ev), factor);
  render();
}, { passive: false });

function startPan(s) {
  state.panDrag = { startScreen: s, startPanX: state.view.panX, startPanY: state.view.panY };
}
function movePan(s) {
  const d = state.panDrag;
  state.view = {
    ...state.view,
    panX: d.startPanX - (s.x - d.startScreen.x) / state.view.pxPerMm,
    panY: d.startPanY + (s.y - d.startScreen.y) / state.view.pxPerMm,
  };
  render();
}

// ---- ポインタイベント(ツック処理は後続タスクで実装) ----
canvas.addEventListener('pointerdown', (ev) => {
  const s = eventScreen(ev);
  canvas.setPointerCapture(ev.pointerId);
  if (ev.button === 1 || state.spaceDown) {
    startPan(s);
    return;
  }
  if (ev.button !== 0) return;
  handleToolPointerDown(s, ev);
});
canvas.addEventListener('pointermove', (ev) => {
  const s = eventScreen(ev);
  state.mouseReal = snapReal(screenToReal(s));
  if (state.panDrag) {
    movePan(s);
    return;
  }
  handleToolPointerMove(s, ev);
  render();
});
canvas.addEventListener('pointerup', (ev) => {
  if (state.panDrag) {
    state.panDrag = null;
    return;
  }
  handleToolPointerUp(eventScreen(ev), ev);
});
window.addEventListener('keydown', (ev) => {
  if (ev.code === 'Space' && !isTyping(ev)) { state.spaceDown = true; ev.preventDefault(); }
});
window.addEventListener('keyup', (ev) => {
  if (ev.code === 'Space') state.spaceDown = false;
});
function isTyping(ev) {
  return ev.target instanceof HTMLInputElement || ev.target instanceof HTMLSelectElement;
}

// 後続タスクで実装するツールハンドラのプレースホルダ
function handleToolPointerDown() {}
function handleToolPointerMove() {}
function handleToolPointerUp() {}

// ---- 起動 ----
resizeCanvas();
updateTitle();
```

- [ ] **Step 5: src/fileio.js の空実装を作成(app.js のimportを満たすだけ。中身は Task 14)**

```js
export function createFileIO() {
  return {
    hasHandle: () => false,
    reset() {},
  };
}
```

- [ ] **Step 6: 手動検証**

Run: `npm run dev` → ブラウザで http://localhost:8000 を開く。
確認項目:
- A3横の白い用紙と図面枠(全周10mm内側)が中央に表示される
- グリッドが見え、10mm線が濃い
- ホイールでカーソル位置を中心にズームし、ズームに応じてグリッドが 10→5→2→1→0.5→0.1mm と切り替わる
- 中ボタンドラッグ(またはSpace+ドラッグ)でパンできる
- 原点マーカー(オレンジの十字)が図面枠の左下内側にある
- ステータスバーに座標(原点相対)・グリッド・縮尺が出る
- ウィンドウリサイズで表示が崩れない

- [ ] **Step 7: Commit**

```bash
git add www/index.html www/styles.css src/renderer.js src/app.js src/fileio.js
git commit -m "feat: UI shell with canvas rendering, pan/zoom, grid display"
```

---

### Task 10: 直線ツール(マウス+数値入力)とグリッドスナップ

**Files:**
- Modify: `src/app.js`(プレースホルダのツールハンドラを実装で置換)

- [ ] **Step 1: ツール切替とツールハンドラを実装**

`src/app.js` のプレースホルダ3関数を削除し、以下に置き換える:

```js
// ---- ツール ----
function setTool(tool) {
  state.tool = tool;
  state.draft = null;
  document.querySelectorAll('#toolbar .tool').forEach((b) =>
    b.classList.toggle('active', b.dataset.tool === tool));
  render();
}
document.querySelectorAll('#toolbar .tool').forEach((b) =>
  b.addEventListener('click', () => setTool(b.dataset.tool)));

function commitLine(a, b) {
  if (a.x === b.x && a.y === b.y) return;
  commit(() => addEntity(state.doc, { type: 'line', x1: a.x, y1: a.y, x2: b.x, y2: b.y }));
}

function handleToolPointerDown(s, ev) {
  const p = snapReal(screenToReal(s));
  if (state.tool === 'line') {
    if (!state.draft) {
      state.draft = { kind: 'line', start: p, current: p };
      const o = state.doc.userOrigin;
      el('num-x').value = (p.x - o.x).toFixed(2);
      el('num-y').value = (p.y - o.y).toFixed(2);
    } else {
      commitLine(state.draft.start, p);
      state.draft = null;
    }
    render();
  } else if (state.tool === 'origin') {
    commit(() => { state.doc.userOrigin = p; });
    setTool('select');
  }
}

function handleToolPointerMove(s) {
  const p = snapReal(screenToReal(s));
  if (state.draft && state.draft.kind !== 'box') {
    state.draft.current = p;
    if (state.draft.kind === 'line') {
      el('num-len').value = geo.distance(state.draft.start, p).toFixed(2);
      el('num-ang').value = geo.angleDegOf(state.draft.start, p).toFixed(1);
    }
  }
}

function handleToolPointerUp() {}

// ---- 数値入力パネル ----
function drawLineFromInputs() {
  const x = Number(el('num-x').value);
  const y = Number(el('num-y').value);
  const len = Number(el('num-len').value);
  const ang = Number(el('num-ang').value);
  if (![x, y, len, ang].every(Number.isFinite) || len <= 0) return;
  const start = originToAbs({ x, y });
  commitLine(start, geo.lineEndPoint(start, len, ang));
}
el('num-draw').addEventListener('click', drawLineFromInputs);

// 直線ドラフト中に長さ/角度欄でEnter → その数値で確定
for (const id of ['num-len', 'num-ang']) {
  el(id).addEventListener('keydown', (ev) => {
    if (ev.key !== 'Enter') return;
    if (state.draft?.kind === 'line') {
      const len = Number(el('num-len').value);
      const ang = Number(el('num-ang').value);
      if (Number.isFinite(len) && len > 0 && Number.isFinite(ang)) {
        commitLine(state.draft.start, geo.lineEndPoint(state.draft.start, len, ang));
        state.draft = null;
        render();
      }
    } else {
      drawLineFromInputs();
    }
  });
}

// ---- キーボード(Esc) ----
window.addEventListener('keydown', (ev) => {
  if (isTyping(ev) && ev.key !== 'Escape') return;
  if (ev.key === 'Escape') {
    state.draft = null;
    state.selection.clear();
    render();
  }
});
```

- [ ] **Step 2: 手動検証**

Run: `npm run dev` → http://localhost:8000
確認項目:
- 「直線」を選び、クリック→マウス移動(緑破線プレビュー)→クリックで黒い直線が引ける
- スナップONでグリッド交点に吸い付く(ステータスバー座標がグリッド刻みになる)
- 1クリック目の後、数値パネルの始点X/Yに原点相対座標が入り、移動中に長さ/角度が更新される
- ドラフト中に長さ欄へ「50」角度「45」と入れてEnter → 長さ50mm・45°の線で確定
- 図形なしの状態で数値パネルに始点(0,0)長さ100角度0を入れ「作図」→ 原点から右へ100mmの線
- Escでドラフト中止
- 「原点設定」でクリックした位置に原点マーカーが移動し、以後の座標表示が新原点相対になる

- [ ] **Step 3: Commit**

```bash
git add src/app.js
git commit -m "feat: line tool with grid snap and numeric input"
```

---

### Task 11: 矩形・連続線ツール

**Files:**
- Modify: `src/app.js`

- [ ] **Step 1: handleToolPointerDown に rect / polyline 分岐を追加**

`handleToolPointerDown` の `state.tool === 'origin'` 分岐の前に追加:

```js
  } else if (state.tool === 'rect') {
    if (!state.draft) {
      state.draft = { kind: 'rect', start: p, current: p };
    } else {
      commitRect(state.draft.start, p);
      state.draft = null;
    }
    render();
  } else if (state.tool === 'polyline') {
    if (!state.draft) {
      state.draft = { kind: 'polyline', points: [p], current: p };
    } else {
      state.draft.points.push(p);
    }
    render();
```

補助関数を `commitLine` の下に追加:

```js
function commitRect(a, b) {
  const width = Math.abs(b.x - a.x);
  const height = Math.abs(b.y - a.y);
  if (width === 0 || height === 0) return;
  commit(() => addEntity(state.doc, {
    type: 'rect', x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), width, height,
  }));
}

function finishPolyline() {
  const d = state.draft;
  if (d?.kind !== 'polyline') return;
  state.draft = null;
  if (d.points.length >= 2) {
    commit(() => addEntity(state.doc, {
      type: 'polyline', points: d.points.map((pt) => [pt.x, pt.y]), closed: false,
    }));
  } else {
    render();
  }
}
canvas.addEventListener('dblclick', () => finishPolyline());
```

キーボードハンドラ(Task 10で追加したもの)に Enter を追加:

```js
  if (ev.key === 'Enter' && !isTyping(ev)) {
    finishPolyline();
  }
```

- [ ] **Step 2: 手動検証**

確認項目:
- 「矩形」: 2クリックで矩形(どの方向にドラッグしても正しく描ける)
- 「連続線」: クリックを重ねて折れ線 → Enterまたはダブルクリックで確定、Escで破棄
- 連続線1点だけでEnter → 何も作られない

- [ ] **Step 3: Commit**

```bash
git add src/app.js
git commit -m "feat: rectangle and polyline tools"
```

---

### Task 12: 選択・移動・複製・削除・Undo/Redo

**Files:**
- Modify: `src/app.js`

- [ ] **Step 1: ヒットテストと選択処理を実装**

`handleToolPointerDown` の先頭分岐に select を追加し、`handleToolPointerMove` / `handleToolPointerUp` を拡張する。以下を app.js に追加:

```js
// ---- ヒットテスト ----
function hitTestScreen(s) {
  const real = screenToReal(s);
  const tolMm = 6 / pxPerRealMm();
  let best = null;
  let bestDist = tolMm;
  for (const e of state.doc.entities) {
    for (const [a, b] of entitySegments(e)) {
      const d = geo.distancePointToSegment(real, a, b);
      if (d <= bestDist) { best = e; bestDist = d; }
    }
  }
  return best;
}

function selectInBox(startScreen, endScreen) {
  const a = screenToReal(startScreen);
  const b = screenToReal(endScreen);
  const minX = Math.min(a.x, b.x), maxX = Math.max(a.x, b.x);
  const minY = Math.min(a.y, b.y), maxY = Math.max(a.y, b.y);
  for (const e of state.doc.entities) {
    const pts = entitySegments(e).flat();
    const inside = pts.every((p) => p.x >= minX && p.x <= maxX && p.y >= minY && p.y <= maxY);
    if (inside && pts.length > 0) state.selection.add(e.id);
  }
}
```

`handleToolPointerDown` に select 分岐を追加(最初の分岐として):

```js
  if (state.tool === 'select') {
    const hit = hitTestScreen(s);
    if (hit) {
      if (ev.shiftKey) {
        state.selection.has(hit.id) ? state.selection.delete(hit.id) : state.selection.add(hit.id);
      } else if (!state.selection.has(hit.id)) {
        state.selection = new Set([hit.id]);
      }
      state.moveDrag = { lastReal: snapReal(screenToReal(s)), snapshotPushed: false };
    } else {
      if (!ev.shiftKey) state.selection.clear();
      state.draft = { kind: 'box', startScreen: s, currentScreen: s };
    }
    render();
  } else if (state.tool === 'line') {
```

(既存の line 分岐の `if` を `else if` に変える)

`handleToolPointerMove` に移動ドラッグと選択ボックスを追加:

```js
function handleToolPointerMove(s) {
  const p = snapReal(screenToReal(s));
  if (state.moveDrag) {
    const dx = p.x - state.moveDrag.lastReal.x;
    const dy = p.y - state.moveDrag.lastReal.y;
    if (dx !== 0 || dy !== 0) {
      if (!state.moveDrag.snapshotPushed) {
        pushSnapshot(state.history, snapshot(state.doc));
        state.moveDrag.snapshotPushed = true;
        markDirty();
      }
      translateEntities(state.doc, [...state.selection], dx, dy);
      state.moveDrag.lastReal = p;
    }
    return;
  }
  if (state.draft?.kind === 'box') {
    state.draft.currentScreen = s;
    return;
  }
  // (既存のドラフト更新処理はそのまま)
  if (state.draft) {
    state.draft.current = p;
    if (state.draft.kind === 'line') {
      el('num-len').value = geo.distance(state.draft.start, p).toFixed(2);
      el('num-ang').value = geo.angleDegOf(state.draft.start, p).toFixed(1);
    }
  }
}

function handleToolPointerUp(s) {
  if (state.moveDrag) {
    state.moveDrag = null;
    return;
  }
  if (state.draft?.kind === 'box') {
    selectInBox(state.draft.startScreen, state.draft.currentScreen);
    state.draft = null;
    render();
  }
}
```

- [ ] **Step 2: 削除・複製・Undo/Redo を配線**

```js
function doUndo() {
  const snap = undo(state.history, snapshot(state.doc));
  if (!snap) return;
  applySnapshot(state.doc, snap);
  state.selection.clear();
  markDirty();
  render();
}
function doRedo() {
  const snap = redo(state.history, snapshot(state.doc));
  if (!snap) return;
  applySnapshot(state.doc, snap);
  state.selection.clear();
  markDirty();
  render();
}
el('undo').addEventListener('click', doUndo);
el('redo').addEventListener('click', doRedo);

function deleteSelection() {
  if (state.selection.size === 0) return;
  commit(() => removeEntities(state.doc, [...state.selection]));
  state.selection.clear();
  render();
}
function duplicateSelection() {
  if (state.selection.size === 0) return;
  let clones;
  commit(() => { clones = duplicateEntities(state.doc, [...state.selection], 10, 10); });
  state.selection = new Set(clones.map((e) => e.id));
  render();
}
```

キーボードハンドラに追加:

```js
  if (ev.key === 'Delete' || ev.key === 'Backspace') deleteSelection();
  if (ev.ctrlKey && ev.key.toLowerCase() === 'z' && !ev.shiftKey) { ev.preventDefault(); doUndo(); }
  if ((ev.ctrlKey && ev.key.toLowerCase() === 'y') ||
      (ev.ctrlKey && ev.shiftKey && ev.key.toLowerCase() === 'z')) { ev.preventDefault(); doRedo(); }
  if (ev.ctrlKey && ev.key.toLowerCase() === 'd') { ev.preventDefault(); duplicateSelection(); }
```

- [ ] **Step 3: 手動検証**

確認項目:
- 「選択」で図形をクリック → 青くハイライト。Shift+クリックで追加/解除
- 空白からドラッグ → 破線ボックスで完全に囲んだ図形が選択される
- 選択図形をドラッグ → グリッド刻みで移動
- Delete で削除、Ctrl+D で+10,+10mmに複製
- Ctrl+Z / Ctrl+Y で作図・移動・削除・原点変更が戻る/やり直せる
- 描画ツール使用中は選択が働かない

- [ ] **Step 4: Commit**

```bash
git add src/app.js
git commit -m "feat: selection, move, duplicate, delete, undo/redo"
```

---

### Task 13: 設定UI(用紙・縮尺・グリッド)の配線

**Files:**
- Modify: `src/app.js`

- [ ] **Step 1: 設定コントロールを配線**

```js
// ---- 設定UI ----
function syncSettingsUI() {
  el('paper-size').value = state.doc.paper.size;
  el('paper-orientation').value = state.doc.paper.orientation;
  el('scale-input').value = formatScale(state.doc.scale.ratio);
  el('grid-mode').value = state.doc.grid.mode;
  el('grid-step').value = String(state.doc.grid.manualMm);
  el('grid-step').disabled = state.doc.grid.mode !== 'manual';
}

el('paper-size').addEventListener('change', () => {
  state.doc.paper.size = el('paper-size').value;
  markDirty(); refitView(); render();
});
el('paper-orientation').addEventListener('change', () => {
  state.doc.paper.orientation = el('paper-orientation').value;
  markDirty(); refitView(); render();
});
el('scale-input').addEventListener('change', () => {
  const ratio = parseScale(el('scale-input').value);
  if (!ratio) {
    alert('縮尺は「1:5」の形式で入力してください');
    el('scale-input').value = formatScale(state.doc.scale.ratio);
    return;
  }
  state.doc.scale.ratio = ratio;
  markDirty(); render();
});
el('grid-mode').addEventListener('change', () => {
  state.doc.grid.mode = el('grid-mode').value;
  el('grid-step').disabled = state.doc.grid.mode !== 'manual';
  markDirty(); render();
});
el('grid-step').addEventListener('change', () => {
  state.doc.grid.manualMm = Number(el('grid-step').value);
  markDirty(); render();
});
el('grid-snap').addEventListener('change', () => {
  state.gridSnap = el('grid-snap').checked;
});
```

起動処理の `updateTitle();` の前に `syncSettingsUI();` を追加。

- [ ] **Step 2: 手動検証**

確認項目:
- 用紙をA4縦に変更 → 枠が変わり全体表示にフィットし直す
- 縮尺を 1:5 に変更 → 図形の見た目が1/5に縮む(データは実寸のまま=ステータスバー座標は不変)。100mmの線が用紙上20mm相当になる
- 不正な縮尺入力(「abc」) → 警告が出て元の値に戻る
- グリッド手動 + 5mm → ズームしても5mm固定
- スナップOFF → 自由な座標に線が引ける

- [ ] **Step 3: Commit**

```bash
git add src/app.js
git commit -m "feat: paper, scale, and grid settings UI"
```

---

### Task 14: ファイルI/O — 上書き保存・フォールバック・D&D・離脱警告

**Files:**
- Modify: `src/fileio.js`(空実装を置換), `src/app.js`

- [ ] **Step 1: src/fileio.js を本実装に置換**

```js
const PICKER_OPTS = {
  types: [{
    description: '製図ツール図面 (JSON)',
    accept: { 'application/json': ['.json'] },
  }],
};

function downloadText(text, name) {
  const blob = new Blob([text], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function openViaInput() {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.onchange = async () => {
      const f = input.files[0];
      resolve(f ? { name: f.name, text: await f.text() } : null);
    };
    input.click();
  });
}

async function writeHandle(handle, text) {
  const writable = await handle.createWritable();
  await writable.write(text);
  await writable.close();
}

export function createFileIO() {
  let handle = null;
  return {
    hasHandle: () => handle !== null,
    reset() { handle = null; },
    adoptHandle(h) { handle = h; },

    // 戻り値 { name, text } / キャンセル時 null
    async open() {
      if (window.showOpenFilePicker) {
        try {
          const [h] = await window.showOpenFilePicker(PICKER_OPTS);
          handle = h;
          const f = await h.getFile();
          return { name: f.name, text: await f.text() };
        } catch (err) {
          if (err.name === 'AbortError') return null;
          throw err;
        }
      }
      return openViaInput();
    },

    // 戻り値: 保存したファイル名 / キャンセル時 null
    async save(text, suggestedName) {
      if (handle) {
        await writeHandle(handle, text);
        return handle.name;
      }
      return this.saveAs(text, suggestedName);
    },

    async saveAs(text, suggestedName) {
      if (window.showSaveFilePicker) {
        try {
          handle = await window.showSaveFilePicker({ ...PICKER_OPTS, suggestedName });
        } catch (err) {
          if (err.name === 'AbortError') return null;
          throw err;
        }
        await writeHandle(handle, text);
        return handle.name;
      }
      downloadText(text, suggestedName);
      return suggestedName;
    },
  };
}
```

- [ ] **Step 2: app.js にファイル操作を配線**

```js
// ---- ファイル操作 ----
function confirmDiscard() {
  return !state.dirty || confirm('未保存の変更があります。破棄して続行しますか?');
}

function loadDocText(text, name) {
  try {
    const doc = deserialize(text);
    state.doc = doc;
    state.history = createHistory(100);
    state.selection = new Set();
    state.draft = null;
    state.fileName = name;
    state.dirty = false;
    syncSettingsUI();
    refitView();
    updateTitle();
    render();
  } catch (err) {
    alert(err.message);
  }
}

async function saveFile(saveAs = false) {
  const text = serialize(state.doc);
  const name = saveAs
    ? await state.fileio.saveAs(text, state.fileName)
    : await state.fileio.save(text, state.fileName);
  if (name) {
    state.fileName = name;
    state.dirty = false;
    updateTitle();
  }
}

el('file-new').addEventListener('click', () => {
  if (!confirmDiscard()) return;
  state.fileio.reset();
  state.doc = createDocument();
  state.history = createHistory(100);
  state.selection = new Set();
  state.draft = null;
  state.fileName = '図面.json';
  state.dirty = false;
  syncSettingsUI();
  refitView();
  updateTitle();
  render();
});
el('file-open').addEventListener('click', async () => {
  if (!confirmDiscard()) return;
  const res = await state.fileio.open();
  if (res) loadDocText(res.text, res.name);
});
el('file-save').addEventListener('click', () => saveFile(false));
el('file-saveas').addEventListener('click', () => saveFile(true));

// Ctrl+S / Ctrl+O(キーボードハンドラに追加)
//   if (ev.ctrlKey && ev.key.toLowerCase() === 's') { ev.preventDefault(); saveFile(ev.shiftKey); }
//   if (ev.ctrlKey && ev.key.toLowerCase() === 'o') { ev.preventDefault(); el('file-open').click(); }

// ---- ドラッグ&ドロップで開く ----
window.addEventListener('dragover', (ev) => ev.preventDefault());
window.addEventListener('drop', async (ev) => {
  ev.preventDefault();
  const item = ev.dataTransfer.items?.[0];
  const file = ev.dataTransfer.files?.[0];
  if (!file) return;
  if (!confirmDiscard()) return;
  // 可能なら書込ハンドルも取得(Chromium)。awaitより先に取ること
  let handlePromise = null;
  if (item?.getAsFileSystemHandle) handlePromise = item.getAsFileSystemHandle();
  const text = await file.text();
  state.fileio.reset();
  if (handlePromise) {
    try {
      const h = await handlePromise;
      if (h?.kind === 'file') state.fileio.adoptHandle(h);
    } catch { /* ハンドルが取れなくても読み込みは続行 */ }
  }
  loadDocText(text, file.name);
});

// ---- 離脱警告 ----
window.addEventListener('beforeunload', (ev) => {
  if (state.dirty) ev.preventDefault();
});
```

キーボードハンドラにコメントで示した Ctrl+S / Ctrl+O の2行を実際に追加する。

- [ ] **Step 3: 手動検証**

確認項目(Chrome/Edgeで):
- 線を数本引いて「保存」→ 保存先を選ぶ → 以後の「保存」はダイアログなしで上書き(タイトルの * が消える)
- 「名前を付けて保存」で別ファイルに保存できる
- 「開く」で保存したJSONを開くと図形・縮尺・原点が復元され、そのまま「保存」で同じファイルに上書きできる
- JSONファイルをウィンドウにドラッグ&ドロップ → 開ける
- 不正なファイル(テキスト等)をドロップ → エラーメッセージ、既存の図面は無事
- 未保存変更ありでタブを閉じる → ブラウザの警告が出る
- 「新規」で未保存変更があると確認が出る

- [ ] **Step 4: Commit**

```bash
git add src/fileio.js src/app.js
git commit -m "feat: file save/open with FS Access API, D&D, unload guard"
```

---

### Task 15: 単一HTMLビルドと配布確認

**Files:**
- Create: `build.mjs`, `README.md`

- [ ] **Step 1: build.mjs を作成**

```js
import { build } from 'esbuild';
import { readFile, writeFile, mkdir } from 'node:fs/promises';

const result = await build({
  entryPoints: ['src/app.js'],
  bundle: true,
  minify: true,
  format: 'iife',
  write: false,
});
const js = result.outputFiles[0].text;
const css = await readFile('www/styles.css', 'utf8');
let html = await readFile('www/index.html', 'utf8');

html = html
  .replace(/<link rel="stylesheet"[^>]*>/, () => `<style>\n${css}\n</style>`)
  .replace(/<script[^>]*src=[^>]*><\/script>/, () => `<script>\n${js}\n</script>`);

await mkdir('dist', { recursive: true });
await writeFile('dist/seizu.html', html);
console.log(`dist/seizu.html generated (${(html.length / 1024).toFixed(0)} KB)`);
```

- [ ] **Step 2: ビルドして単体動作を確認**

Run: `npm run build`
Expected: `dist/seizu.html generated (... KB)`

`dist/seizu.html` をエクスプローラーからダブルクリックで開き(file://)、以下を確認:
- ページが開き、Task 9〜14 の主要動作(作図・保存・読込)がローカルサーバーなしで動く

- [ ] **Step 3: README.md を作成**

```markdown
# 製図ツール (seizu-tool)

Excel感覚でグリッドに線を引ける軽量2D製図ツール。単一HTMLで動作。
要件: drawing-tool-requirements.md

## 使う
`dist/seizu.html` をブラウザ(Chrome/Edge推奨)で開くだけ。配布もこのファイル1つをコピーするだけ。

## 開発
- `npm install` — 初回のみ
- `npm test` — ロジックのテスト
- `npm run dev` — http://localhost:8000 で開発サーバー
- `npm run build` — `dist/seizu.html` を生成
```

- [ ] **Step 4: Commit**

```bash
git add build.mjs README.md
git commit -m "feat: single-file HTML build and README"
```

---

## 検証まとめ(Phase 1 完了条件)

1. `npm test` 全PASS
2. `npm run build` が成功し、`dist/seizu.html` 単体(file://)で以下が通しでできる:
   用紙A4縦+縮尺1:2を設定 → 数値入力で(0,0)から100mmの線 → マウスで矩形と連続線 →
   選択・移動・複製・Undo → 保存 → ブラウザ再起動 → 開く(またはD&D) → 続きから編集 → 上書き保存

## Phase 1 スコープ外(次フェーズ)

- 回転(§7)・オブジェクトスナップ(§5)・円/円弧(§6) → Phase 2
- IndexedDB自動スナップショット(§12) → Phase 2冒頭に推奨
- 表題欄(§11)・印刷ビュー(§13) → Phase 6

