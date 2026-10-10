import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createDocument, addEntity, removeEntities, translateEntities,
  duplicateEntities, entitySegments, parseScale, formatScale, DEFAULT_LAYERS,
  rotate90Entities, rotateEntities, scaleEntities,
  mirrorEntities, entitySnapPoints, entityBounds, hitTestEntity,
  LINE_STYLES, STYLE_PRESETS,
  polySegmentCount, polySegmentInfo, setPolySegment, nearestPolySegment, ellipsePoint,
  isEntityVisible, parseNumber,
} from '../src/model.js';
import { dimText, dimLayout } from '../src/dims.js';
import { hatchSegments } from '../src/hatch.js';

const approx = (a, b, eps = 1e-5) => Math.abs(a - b) < eps;

test('createDocument: 仕様どおりの既定値', () => {
  const doc = createDocument();
  assert.equal(doc.format, 'seizu-tool');
  assert.equal(doc.version, 1);
  assert.deepEqual(doc.paper, { size: 'A4', orientation: 'landscape' });
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

test('rotateEntities: 任意角度で線・矩形・円弧・楕円・文字が回転する', () => {
  const doc = createDocument();
  const l = addEntity(doc, { type: 'line', x1: 10, y1: 0, x2: 20, y2: 0 });
  const r = addEntity(doc, { type: 'rect', x: 10, y: 0, width: 10, height: 4 });
  const a = addEntity(doc, { type: 'arc', cx: 10, cy: 0, r: 5, startAngle: 0, endAngle: 90 });
  const e = addEntity(doc, { type: 'ellipse', cx: 0, cy: 0, rx: 8, ry: 3, rotation: 350 });
  const t = addEntity(doc, { type: 'text', x: 10, y: 0, content: 'A', height: 3.5 });
  rotateEntities(doc, [l.id, r.id, a.id, e.id, t.id], { x: 0, y: 0 }, 45);
  const h = Math.SQRT1_2;
  assert.ok(approx(l.x1, 10 * h) && approx(l.y1, 10 * h) && approx(l.x2, 20 * h) && approx(l.y2, 20 * h));
  assert.ok(approx(r.x, 10 * h) && approx(r.y, 10 * h));
  assert.equal(r.rotation, 45);
  assert.deepEqual([a.startAngle, a.endAngle], [45, 135]);
  assert.equal(e.rotation, 35); // 350+45 は 0〜360 に正規化
  assert.equal(t.rotation, 45);
});

test('rotateEntities: 90°は誤差なく回り、-90°は時計回り', () => {
  const doc = createDocument();
  const l = addEntity(doc, { type: 'line', x1: 10, y1: 0, x2: 20, y2: 0 });
  rotateEntities(doc, [l.id], { x: 0, y: 0 }, -90);
  assert.deepEqual([l.x1, l.y1, l.x2, l.y2], [0, -10, 0, -20]);
});

test('rotateEntities: 寸法・引出線・バルーンも一緒に回り、寸法値は変わらない', () => {
  const doc = createDocument();
  const d = addEntity(doc, {
    type: 'dim', dimType: 'linear', orient: 'h', p1: [10, 0], p2: [60, 0], offset: 20, textShift: 10,
  });
  const dia = addEntity(doc, { type: 'dim', dimType: 'dia', cx: 10, cy: 0, r: 5, angleDeg: 30 });
  const ld = addEntity(doc, { type: 'leader', points: [[10, 0], [20, 10]], content: 'M6' });
  const b = addEntity(doc, { type: 'balloon', number: 1, at: [10, 0], pos: [20, 0] });
  rotateEntities(doc, [d.id, dia.id, ld.id, b.id], { x: 0, y: 0 }, 90);
  // 水平寸法 → 垂直寸法(寸法線の位置・値のずれも保つ)
  assert.equal(d.orient, 'v');
  assert.deepEqual([d.p1, d.p2, d.offset, d.textShift], [[0, 10], [0, 60], -20, 10]);
  assert.equal(dimText(d), '50');
  assert.deepEqual([dia.cx, dia.cy, dia.angleDeg], [0, 10, 120]);
  assert.deepEqual(ld.points, [[0, 10], [-10, 20]]);
  assert.deepEqual([b.at, b.pos], [[0, 10], [0, 20]]);
});

test('rotateEntities: 90°の倍数以外では水平寸法は平行寸法になり、位置と値を保つ', () => {
  const doc = createDocument();
  const d = addEntity(doc, {
    type: 'dim', dimType: 'linear', orient: 'h', p1: [10, 0], p2: [60, 0], offset: 20, textShift: 5,
  });
  const before = dimLayout(d, 1).texts[0];
  rotateEntities(doc, [d.id], { x: 0, y: 0 }, 30);
  assert.equal(d.orient, 'aligned');
  assert.equal(dimText(d), '50');
  // 文字位置は元の位置を30°回した所
  const after = dimLayout(d, 1).texts[0];
  const c = Math.cos(Math.PI / 6);
  const s = Math.sin(Math.PI / 6);
  assert.ok(approx(after.x, before.x * c - before.y * s) && approx(after.y, before.x * s + before.y * c));
  assert.ok(approx(after.angleDeg, 30));
});

test('rotateEntities: ハッチの矩形境界は斜めになると多角形に変わり、斜線も一緒に回る', () => {
  const doc = createDocument();
  const hatch = addEntity(doc, {
    type: 'hatch', boundary: { kind: 'rect', x: 0, y: 0, width: 20, height: 10 }, angleDeg: 45, spacingMm: 3,
  });
  rotateEntities(doc, [hatch.id], { x: 0, y: 0 }, 30);
  assert.equal(hatch.boundary.kind, 'polyline');
  assert.equal(hatch.boundary.points.length, 4);
  assert.equal(hatch.angleDeg, 75);
  assert.ok(hatchSegments(hatch.boundary, hatch.angleDeg, 3).length > 0);
});

test('scaleEntities: 基準点から倍率で拡大し、文字の大きさは変えない', () => {
  const doc = createDocument();
  const center = { x: 10, y: 10 };
  const l = addEntity(doc, { type: 'line', x1: 10, y1: 10, x2: 20, y2: 10 });
  const c = addEntity(doc, { type: 'circle', cx: 20, cy: 20, r: 5 });
  const r = addEntity(doc, { type: 'rect', x: 10, y: 10, width: 10, height: 4, rotation: 30 });
  const el = addEntity(doc, { type: 'ellipse', cx: 10, cy: 10, rx: 8, ry: 3 });
  const t = addEntity(doc, { type: 'text', x: 20, y: 10, content: 'A', height: 3.5 });
  const hatch = addEntity(doc, {
    type: 'hatch', boundary: { kind: 'circle', cx: 20, cy: 20, r: 5 }, angleDeg: 45, spacingMm: 3,
  });
  scaleEntities(doc, [l.id, c.id, r.id, el.id, t.id, hatch.id], center, 2);
  assert.deepEqual([l.x1, l.y1, l.x2, l.y2], [10, 10, 30, 10]);
  assert.deepEqual([c.cx, c.cy, c.r], [30, 30, 10]);
  assert.deepEqual([r.x, r.y, r.width, r.height, r.rotation], [10, 10, 20, 8, 30]);
  assert.deepEqual([el.rx, el.ry], [16, 6]);
  assert.deepEqual([t.x, t.y, t.height], [30, 10, 3.5]);
  assert.deepEqual([hatch.boundary.cx, hatch.boundary.r, hatch.spacingMm], [30, 10, 3]);
});

test('scaleEntities: 寸法は測る点・寸法線の位置・値のずれが拡大され、値も倍になる', () => {
  const doc = createDocument();
  const d = addEntity(doc, {
    type: 'dim', dimType: 'linear', orient: 'h', p1: [10, 0], p2: [60, 0], offset: 20, textShift: 5,
  });
  const ang = addEntity(doc, { type: 'dim', dimType: 'angle', vertex: [0, 0], p1: [10, 0], p2: [0, 10], radius: 8 });
  const ch = addEntity(doc, { type: 'dim', dimType: 'chamfer', p1: [0, 5], p2: [5, 0], tail: [10, 10], size: 5 });
  scaleEntities(doc, [d.id, ang.id, ch.id], { x: 0, y: 0 }, 0.5);
  assert.deepEqual([d.p1, d.p2, d.offset, d.textShift], [[5, 0], [30, 0], 10, 2.5]);
  assert.equal(dimText(d), '25');
  assert.equal(ang.radius, 4);
  assert.deepEqual([ch.tail, ch.size], [[5, 5], 2.5]);
});

test('mirrorEntities: 寸法の値のずれは向きに合わせて反転する', () => {
  const doc = createDocument();
  const d = addEntity(doc, {
    type: 'dim', dimType: 'linear', orient: 'h', p1: [10, 0], p2: [60, 0], offset: 20, textShift: 10,
  });
  mirrorEntities(doc, [d.id], 'x', { x: 50, y: 0 });
  assert.equal(d.textShift, -10); // 右寄りの値は左右反転で左寄りに
  mirrorEntities(doc, [d.id], 'y', { x: 0, y: 0 });
  assert.equal(d.textShift, -10); // 上下反転では左右の位置は変わらない
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

test('hitTestEntity: 寸法の文字を大きくすると文字の範囲もクリックで選べる', () => {
  // 寸法値 "100" は x=50 中央、y=21(寸法線+隙間1mm)から上に文字高さぶん
  const dim = { type: 'dim', dimType: 'linear', orient: 'h', p1: [0, 0], p2: [100, 0], offset: 20 };
  const p = { x: 50, y: 27 }; // 3.5mm文字の上端(24.5)より上、7mm文字(28)の内側
  assert.ok(!hitTestEntity(dim, p, 0.1, 1));
  assert.ok(hitTestEntity({ ...dim, textMm: 7 }, p, 0.1, 1));
});

test('entityBounds: バルーンは文字高さに比例した円の大きさで囲む', () => {
  const b = { type: 'balloon', number: 1, at: [0, 0], pos: [30, 0] };
  assert.equal(entityBounds(b, 1).maxX, 34);
  assert.equal(entityBounds({ ...b, textMm: 7 }, 1).maxX, 38);
  assert.equal(entityBounds({ ...b, textMm: 7 }, 1).minY, -8);
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

test('translateEntities: 角度寸法も頂点・2点が一緒に動く', () => {
  const doc = createDocument();
  const a = addEntity(doc, { type: 'dim', dimType: 'angle', vertex: [0, 0], p1: [10, 0], p2: [0, 10], radius: 8 });
  translateEntities(doc, [a.id], 5, -3);
  assert.deepEqual([a.vertex, a.p1, a.p2], [[5, -3], [15, -3], [5, 7]]);
});

test('mirrorEntities: 角度寸法は鏡映しても角度の値(開き)が変わらない', () => {
  const doc = createDocument();
  const a = addEntity(doc, { type: 'dim', dimType: 'angle', vertex: [10, 0], p1: [20, 0], p2: [10, 10], radius: 8 });
  assert.equal(dimText(a), '90°');
  mirrorEntities(doc, [a.id], 'x', { x: 0, y: 0 });
  assert.deepEqual(a.vertex, [-10, 0]);
  assert.equal(dimText(a), '90°'); // 270° にならない
  mirrorEntities(doc, [a.id], 'y', { x: 0, y: 0 });
  assert.equal(dimText(a), '90°');
});

test('回転した文字: 当たり判定と外接枠が回転を考慮する', () => {
  // 原点から上向き(90°)に書いた「ab」(高さ3.5)は x∈[-3.5,0], y∈[0,7] を占める
  const t = { type: 'text', x: 0, y: 0, content: 'ab', height: 3.5, rotation: 90 };
  assert.ok(hitTestEntity(t, { x: -1.5, y: 5 }, 0.1, 1));
  assert.ok(!hitTestEntity(t, { x: 5, y: 1 }, 0.1, 1)); // 回転前の位置にはいない
  const b = entityBounds(t, 1);
  assert.ok(approx(b.minX, -3.5) && approx(b.maxX, 0) && approx(b.minY, 0) && approx(b.maxY, 7));
});

test('isEntityVisible: 非表示レイヤーの図形は見えない扱い(未知のレイヤーは見える)', () => {
  const doc = createDocument();
  const line = addEntity(doc, { type: 'line', x1: 0, y1: 0, x2: 1, y2: 0, layer: 'aux' });
  assert.ok(isEntityVisible(doc, line));
  doc.layers.find((l) => l.id === 'aux').visible = false;
  assert.ok(!isEntityVisible(doc, line));
  assert.ok(isEntityVisible(doc, { type: 'line', layer: 'nope' }));
});

test('parseNumber: 全角の数字・記号も数値として読める(不正は NaN)', () => {
  assert.equal(parseNumber('１２.５'), 12.5);
  assert.equal(parseNumber('－３０'), -30);
  assert.equal(parseNumber('１２３'), 123);
  assert.equal(parseNumber(' 7 '), 7);
  assert.equal(parseNumber('0'), 0);
  assert.ok(Number.isNaN(parseNumber('')));
  assert.ok(Number.isNaN(parseNumber('abc')));
});

test('parseScale: 全角の数字でも縮尺を読める', () => {
  assert.deepEqual(parseScale('１：２'), [1, 2]);
});

test('hitTestEntity: 角度寸法は円弧の上をクリックしても当たる', () => {
  const e = {
    type: 'dim', dimType: 'angle', vertex: [0, 0], p1: [20, 0], p2: [0, 20], radius: 15,
    override: null, layer: 'dim', lineType: 'thin',
  };
  const c = 15 * Math.SQRT1_2; // 45°方向・半径15 の点
  assert.equal(hitTestEntity(e, { x: c, y: c }, 0.5), true, '円弧の真上');
  assert.equal(hitTestEntity(e, { x: -c, y: c }, 0.5), false, '円弧の範囲外(135°)');
  assert.equal(hitTestEntity(e, { x: c * 0.6, y: c * 0.6 }, 0.5), false, '円弧より内側');
  assert.equal(hitTestEntity(e, { x: 10, y: 0 }, 0.5), true, '頂点からの線の上');
});

test('duplicateEntities: グループごと複製すると、複製は元と別の新しいグループになる', () => {
  const doc = createDocument();
  const a = addEntity(doc, { type: 'circle', cx: 0, cy: 0, r: 2, group: 1 });
  const b = addEntity(doc, { type: 'line', x1: -3, y1: 0, x2: 3, y2: 0, group: 1 });
  const clones = duplicateEntities(doc, [a.id, b.id], 10, 0);
  assert.equal(clones[0].group, clones[1].group);
  assert.notEqual(clones[0].group, 1);
  assert.deepEqual([a.group, b.group], [1, 1]); // 元のグループはそのまま
});

test('entitySnapPoints: 閉じた連続線(正多角形)は図心も「中心」になる', () => {
  const hex = { type: 'polyline', closed: true, points: [[12, 0], [6, 10], [-6, 10], [-12, 0], [-6, -10], [6, -10]] };
  assert.deepEqual(entitySnapPoints(hex).filter((p) => p.kind === 'center'), [{ x: 0, y: 0, kind: 'center' }]);
  const open = { ...hex, closed: false };
  assert.equal(entitySnapPoints(open).filter((p) => p.kind === 'center').length, 0);
});
