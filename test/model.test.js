import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createDocument, addEntity, removeEntities, translateEntities,
  duplicateEntities, entitySegments, parseScale, formatScale, DEFAULT_LAYERS,
  rotate90Entities, mirrorEntities, entitySnapPoints, entityBounds, hitTestEntity,
  LINE_STYLES, STYLE_PRESETS,
  polySegmentCount, polySegmentInfo, setPolySegment, nearestPolySegment, ellipsePoint,
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

test('translateEntities: 円・円弧・楕円・文字も移動する', () => {
  const doc = createDocument();
  const c = addEntity(doc, { type: 'circle', cx: 10, cy: 10, r: 5 });
  const a = addEntity(doc, { type: 'arc', cx: 0, cy: 0, r: 5, startAngle: 0, endAngle: 90 });
  const t = addEntity(doc, { type: 'text', x: 1, y: 2, content: 'あ', height: 3.5 });
  translateEntities(doc, [c.id, a.id, t.id], 5, -5);
  assert.deepEqual([c.cx, c.cy], [15, 5]);
  assert.deepEqual([a.cx, a.cy], [5, -5]);
  assert.deepEqual([t.x, t.y], [6, -3]);
});

test('rotate90Entities: 線分・矩形・円弧・楕円が90°回転する', () => {
  const doc = createDocument();
  const l = addEntity(doc, { type: 'line', x1: 10, y1: 0, x2: 20, y2: 0 });
  const r = addEntity(doc, { type: 'rect', x: 0, y: 0, width: 10, height: 4 });
  const a = addEntity(doc, { type: 'arc', cx: 10, cy: 0, r: 5, startAngle: 0, endAngle: 90 });
  const e = addEntity(doc, { type: 'ellipse', cx: 0, cy: 0, rx: 8, ry: 3 });
  const origin = { x: 0, y: 0 };
  rotate90Entities(doc, [l.id, r.id, a.id, e.id], origin);
  assert.deepEqual([l.x1, l.y1, l.x2, l.y2], [0, 10, 0, 20]);
  // 矩形: rotation=90 で同じ領域(x∈[-4,0], y∈[0,10])を占める
  assert.equal(r.rotation, 90);
  const rb = entityBounds(r);
  assert.ok(Math.abs(rb.minX - -4) < 1e-9 && Math.abs(rb.maxX) < 1e-9);
  assert.ok(Math.abs(rb.minY) < 1e-9 && Math.abs(rb.maxY - 10) < 1e-9);
  assert.deepEqual([a.cx, a.cy, a.startAngle, a.endAngle], [0, 10, 90, 180]);
  // 楕円: rx/ryは維持し rotation で表現
  assert.deepEqual([e.rx, e.ry, e.rotation], [8, 3, 90]);
});

test('mirrorEntities: 左右反転で線分・矩形・円弧が鏡映される', () => {
  const doc = createDocument();
  const l = addEntity(doc, { type: 'line', x1: 10, y1: 0, x2: 30, y2: 5 });
  const r = addEntity(doc, { type: 'rect', x: 10, y: 0, width: 20, height: 10 });
  const a = addEntity(doc, { type: 'arc', cx: 10, cy: 0, r: 5, startAngle: 0, endAngle: 90 });
  mirrorEntities(doc, [l.id, r.id, a.id], 'x', { x: 50, y: 0 });
  assert.deepEqual([l.x1, l.y1, l.x2, l.y2], [90, 0, 70, 5]);
  // 矩形は回転表現になるが占有領域は x∈[70,90], y∈[0,10]
  const rb = entityBounds(r);
  assert.ok(Math.abs(rb.minX - 70) < 1e-9 && Math.abs(rb.maxX - 90) < 1e-9);
  assert.ok(Math.abs(rb.minY) < 1e-9 && Math.abs(rb.maxY - 10) < 1e-9);
  assert.deepEqual([a.cx, a.startAngle, a.endAngle], [90, 90, 180]);
});

test('矩形の回転: entitySegments が回転した4隅を返す', () => {
  const r = { type: 'rect', x: 0, y: 0, width: 10, height: 4, rotation: 90 };
  const segs = entitySegments(r);
  const near = (p, x, y) => Math.abs(p.x - x) < 1e-9 && Math.abs(p.y - y) < 1e-9;
  assert.ok(near(segs[0][0], 0, 0));
  assert.ok(near(segs[0][1], 0, 10)); // (10,0)を90°回転
  assert.ok(near(segs[1][1], -4, 10));
});

test('回転楕円: ヒットテストとバウンディングが回転を考慮する', () => {
  const e = { type: 'ellipse', cx: 0, cy: 0, rx: 10, ry: 5, rotation: 90 };
  assert.ok(hitTestEntity(e, { x: 0, y: 10 }, 0.5));   // 長軸は縦向きに
  assert.ok(!hitTestEntity(e, { x: 10, y: 0 }, 0.5));
  const b = entityBounds(e);
  assert.ok(Math.abs(b.maxX - 5) < 1e-9 && Math.abs(b.maxY - 10) < 1e-9);
});

test('楕円弧: 範囲内のみヒットし、端点にスナップできる', () => {
  const e = { type: 'ellipse', cx: 0, cy: 0, rx: 10, ry: 5, rotation: 0, startAngle: 0, endAngle: 90 };
  assert.ok(hitTestEntity(e, { x: 10, y: 0 }, 0.5));    // 開始点
  assert.ok(!hitTestEntity(e, { x: -10, y: 0 }, 0.5));  // 範囲外(180°)
  const pts = entitySnapPoints(e);
  assert.ok(pts.some((p) => p.kind === 'end' && Math.abs(p.x - 10) < 1e-9));
  assert.ok(pts.some((p) => p.kind === 'end' && Math.abs(p.y - 5) < 1e-9)); // 90°端点(0,5)
  // ellipsePoint はパラメータ角から座標を返す
  const q = ellipsePoint(e, 90);
  assert.ok(Math.abs(q.x) < 1e-9 && Math.abs(q.y - 5) < 1e-9);
});

test('連続線のセグメント編集: 情報取得・最寄り判定・始点基準の更新', () => {
  const pl = { type: 'polyline', points: [[0, 0], [10, 0], [10, 10]], closed: false };
  assert.equal(polySegmentCount(pl), 2);
  const info = polySegmentInfo(pl, 1);
  assert.deepEqual([info.start.x, info.start.y, info.len, info.ang], [10, 0, 10, 90]);
  assert.equal(nearestPolySegment(pl, { x: 5, y: 1 }), 0);
  assert.equal(nearestPolySegment(pl, { x: 11, y: 5 }), 1);
  // セグメント1を 始点(10,0)のまま長さ20・角度45に → 終点頂点が動く
  setPolySegment(pl, 1, { x: 10, y: 0 }, 20, 45);
  assert.deepEqual(pl.points[1], [10, 0]);
  const [ex, ey] = pl.points[2];
  assert.ok(Math.abs(ex - (10 + 20 * Math.SQRT1_2)) < 1e-6);
  assert.ok(Math.abs(ey - 20 * Math.SQRT1_2) < 1e-6);
});

test('mirrorEntities: 上下反転で円弧の角度が -θ 入替になる', () => {
  const doc = createDocument();
  const a = addEntity(doc, { type: 'arc', cx: 0, cy: 10, r: 5, startAngle: 0, endAngle: 90 });
  mirrorEntities(doc, [a.id], 'y', { x: 0, y: 0 });
  assert.deepEqual([a.cy, a.startAngle, a.endAngle], [-10, -90, 0]);
});

test('entitySnapPoints: 線分は端点2+中点1、円は中心+四半点4', () => {
  const line = { type: 'line', x1: 0, y1: 0, x2: 10, y2: 0 };
  const pts = entitySnapPoints(line);
  assert.equal(pts.filter((p) => p.kind === 'end').length, 2);
  assert.deepEqual(pts.find((p) => p.kind === 'mid'), { x: 5, y: 0, kind: 'mid' });
  const circle = { type: 'circle', cx: 0, cy: 0, r: 5 };
  const cpts = entitySnapPoints(circle);
  assert.equal(cpts.filter((p) => p.kind === 'quad').length, 4);
  assert.equal(cpts.filter((p) => p.kind === 'center').length, 1);
});

test('entitySnapPoints: 開いた連続線は末尾の頂点も端点になる', () => {
  const pl = { type: 'polyline', points: [[0, 0], [10, 0], [10, 10]], closed: false };
  const pts = entitySnapPoints(pl);
  assert.ok(pts.some((p) => p.x === 10 && p.y === 10 && p.kind === 'end'));
});

test('entityBounds: 円はcx±r、文字は縮尺換算した概算ボックス', () => {
  assert.deepEqual(entityBounds({ type: 'circle', cx: 10, cy: 20, r: 5 }),
    { minX: 5, minY: 15, maxX: 15, maxY: 25 });
  // 縮尺1:2(k=0.5): 高さ3.5用紙mm → 実寸7mm
  const b = entityBounds({ type: 'text', x: 0, y: 0, content: 'ab', height: 3.5 }, 0.5);
  assert.equal(b.maxY, 7);
  assert.equal(b.maxX, 14);
});

test('hitTestEntity: 円は円周のみヒット、円弧は角度範囲内のみ', () => {
  const circle = { type: 'circle', cx: 0, cy: 0, r: 10 };
  assert.ok(hitTestEntity(circle, { x: 10.5, y: 0 }, 1));
  assert.ok(!hitTestEntity(circle, { x: 5, y: 0 }, 1)); // 内部はヒットしない
  const arc = { type: 'arc', cx: 0, cy: 0, r: 10, startAngle: 0, endAngle: 90 };
  assert.ok(hitTestEntity(arc, { x: 7.07, y: 7.07 }, 0.5));   // 45°
  assert.ok(!hitTestEntity(arc, { x: 7.07, y: -7.07 }, 0.5)); // -45°は範囲外
});

test('hitTestEntity: 楕円は輪郭近傍のみヒット', () => {
  const el = { type: 'ellipse', cx: 0, cy: 0, rx: 10, ry: 5 };
  assert.ok(hitTestEntity(el, { x: 10.2, y: 0 }, 1));
  assert.ok(!hitTestEntity(el, { x: 0, y: 0 }, 1));
});

test('LINE_STYLES と STYLE_PRESETS の整合', () => {
  assert.equal(LINE_STYLES.solid.widthMm, 0.5);
  assert.equal(LINE_STYLES.dashed.widthMm, 0.35);
  for (const preset of Object.values(STYLE_PRESETS)) {
    assert.ok(LINE_STYLES[preset.lineType], `lineType ${preset.lineType} が未定義`);
    assert.ok(DEFAULT_LAYERS.some((l) => l.id === preset.layer), `layer ${preset.layer} が未定義`);
  }
  assert.equal(STYLE_PRESETS.aux.layer, 'aux'); // 作図補助線は印刷OFFレイヤーへ
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
