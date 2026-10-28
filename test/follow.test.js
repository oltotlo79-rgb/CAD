import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createDocument, addEntity, translateEntities, removeEntities,
} from '../src/model.js';
import { dimText } from '../src/dims.js';
import { followEdits } from '../src/follow.js';

const near = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} !~ ${b}`);
const nearPt = ([x, y], [ex, ey]) => { near(x, ex); near(y, ey); };

// 編集の前の図形を覚え、編集し、追従させる
function edit(doc, mutate, options) {
  const before = structuredClone(doc.entities);
  mutate();
  return followEdits(before, doc, options);
}

function rectWithDim() {
  const doc = createDocument();
  const rect = addEntity(doc, { type: 'rect', x: 0, y: 0, width: 100, height: 50 });
  // 下辺の両端の角を測る水平寸法(寸法線は図形の15mm下)
  const dim = addEntity(doc, {
    type: 'dim', dimType: 'linear', orient: 'h', p1: [0, 0], p2: [100, 0], offset: -15,
    layer: 'dim', lineType: 'thin', override: null,
  });
  return { doc, rect, dim };
}

test('図形を動かすと、角に付いた寸法も一緒に動き、寸法線との間隔も保つ', () => {
  const { doc, rect, dim } = rectWithDim();
  const moved = edit(doc, () => translateEntities(doc, [rect.id], 10, 20));
  assert.equal(moved, 1);
  assert.deepEqual([dim.p1, dim.p2, dim.offset], [[10, 20], [110, 20], 5]);
});

test('図形の幅を変えると、寸法の端が付いていき、測った値も変わる', () => {
  const { doc, rect, dim } = rectWithDim();
  edit(doc, () => { rect.width = 120; });
  assert.deepEqual([dim.p1, dim.p2, dim.offset], [[0, 0], [120, 0], -15]);
  assert.equal(dimText(dim), '120');
});

test('図形に付いていない寸法は動かない', () => {
  const { doc, rect } = rectWithDim();
  const free = addEntity(doc, {
    type: 'dim', dimType: 'linear', orient: 'h', p1: [0, -5], p2: [100, -5], offset: -20, layer: 'dim',
  });
  edit(doc, () => translateEntities(doc, [rect.id], 10, 20));
  assert.deepEqual([free.p1, free.p2, free.offset], [[0, -5], [100, -5], -20]);
});

test('寸法と図形を一緒に動かしたときは、二重に動かさない', () => {
  const { doc, rect, dim } = rectWithDim();
  edit(doc, () => translateEntities(doc, [rect.id, dim.id], 10, 20));
  assert.deepEqual([dim.p1, dim.p2, dim.offset], [[10, 20], [110, 20], 5]);
});

test('図形を消しても、付いていた寸法はそのまま残る', () => {
  const { doc, rect, dim } = rectWithDim();
  edit(doc, () => removeEntities(doc, [rect.id]));
  assert.deepEqual([dim.p1, dim.p2, dim.offset], [[0, 0], [100, 0], -15]);
});

test('円の大きさと位置を変えると、φ寸法と円周上の引出線(同じ角度の点)が付いていく', () => {
  const doc = createDocument();
  const c = addEntity(doc, { type: 'circle', cx: 50, cy: 50, r: 10 });
  const dia = addEntity(doc, { type: 'dim', dimType: 'dia', cx: 50, cy: 50, r: 10, angleDeg: 30, layer: 'dim' });
  const d = 10 / Math.SQRT2;
  const tip = [Math.round((50 + d) * 1e6) / 1e6, Math.round((50 + d) * 1e6) / 1e6];
  const leader = addEntity(doc, { type: 'leader', points: [tip, [80, 80]], content: 'φ20', layer: 'dim' });
  edit(doc, () => { c.cx = 60; c.r = 15; });
  assert.deepEqual([dia.cx, dia.cy, dia.r, dia.angleDeg], [60, 50, 15, 30]);
  const e = 15 / Math.SQRT2;
  nearPt(leader.points[0], [60 + e, 50 + e]);
  // 文字の側(折れ点)も同じだけ動く
  nearPt(leader.points[1], [80 + (60 + e - tip[0]), 80 + (50 + e - tip[1])]);
});

test('円の中心を通る中心線は、円と一緒に動き、円の外へのはみ出しも保つ', () => {
  const doc = createDocument();
  const c = addEntity(doc, { type: 'circle', cx: 50, cy: 50, r: 10 });
  const cl = addEntity(doc, { type: 'line', x1: 35, y1: 50, x2: 65, y2: 50, lineType: 'chain', layer: 'center' });
  edit(doc, () => { c.cy = 60; c.r = 12; });
  assert.deepEqual([cl.x1, cl.y1, cl.x2, cl.y2], [33, 60, 67, 60]);
});

test('矩形の辺の真ん中を通る中心線は、それぞれの端が近い辺の真ん中に付いていく', () => {
  const doc = createDocument();
  const rect = addEntity(doc, { type: 'rect', x: 0, y: 0, width: 100, height: 50 });
  const cl = addEntity(doc, { type: 'line', x1: 50, y1: -5, x2: 50, y2: 55, lineType: 'chain', layer: 'center' });
  edit(doc, () => { rect.width = 120; rect.height = 70; });
  assert.deepEqual([cl.x1, cl.y1, cl.x2, cl.y2], [60, -5, 60, 75]);
});

test('ふつうの線(中心線でない)は図形に付いていかない', () => {
  const doc = createDocument();
  const c = addEntity(doc, { type: 'circle', cx: 50, cy: 50, r: 10 });
  const line = addEntity(doc, { type: 'line', x1: 35, y1: 50, x2: 65, y2: 50 });
  edit(doc, () => { c.cy = 60; });
  assert.deepEqual([line.x1, line.y1, line.x2, line.y2], [35, 50, 65, 50]);
});

test('ハッチは、もとの閉じた図形の形が変わると付いていく', () => {
  const doc = createDocument();
  const rect = addEntity(doc, { type: 'rect', x: 0, y: 0, width: 100, height: 50 });
  const hatch = addEntity(doc, {
    type: 'hatch', boundary: { kind: 'rect', x: 0, y: 0, width: 100, height: 50 }, angleDeg: 45, spacingMm: 3,
  });
  edit(doc, () => { rect.width = 120; });
  assert.deepEqual(hatch.boundary, { kind: 'rect', x: 0, y: 0, width: 120, height: 50 });
});

test('角度寸法は、頂点と2本の線の上の点が付いていく', () => {
  const doc = createDocument();
  const a = addEntity(doc, { type: 'line', x1: 0, y1: 0, x2: 50, y2: 0 });
  const b = addEntity(doc, { type: 'line', x1: 0, y1: 0, x2: 0, y2: 50 });
  const ang = addEntity(doc, { type: 'dim', dimType: 'angle', vertex: [0, 0], p1: [30, 0], p2: [0, 30], radius: 20 });
  edit(doc, () => translateEntities(doc, [a.id, b.id], 10, 10));
  assert.deepEqual([ang.vertex, ang.p1, ang.p2, ang.radius], [[10, 10], [40, 10], [10, 40], 20]);
});

test('バルーンと粗さ記号も、付いている線と一緒に動く', () => {
  const doc = createDocument();
  const line = addEntity(doc, { type: 'line', x1: 0, y1: 0, x2: 40, y2: 0 });
  const balloon = addEntity(doc, { type: 'balloon', number: 1, at: [20, 0], pos: [30, 20] });
  const rough = addEntity(doc, { type: 'roughness', x: 10, y: 0, value: 'Ra 6.3' });
  edit(doc, () => translateEntities(doc, [line.id], 5, -5));
  assert.deepEqual([balloon.at, balloon.pos], [[25, -5], [35, 15]]);
  assert.deepEqual([rough.x, rough.y], [15, -5]);
});

test('寸法だけを動かすと、図形に付いた点は残り、寸法線の位置だけが変わる', () => {
  const { doc, dim } = rectWithDim();
  edit(doc, () => translateEntities(doc, [dim.id], 5, -7), { ownMove: true });
  assert.deepEqual([dim.p1, dim.p2, dim.offset], [[0, 0], [100, 0], -22]);
});

test('平行寸法だけを動かすと、動かした分だけ寸法線が離れる', () => {
  const doc = createDocument();
  addEntity(doc, { type: 'line', x1: 0, y1: 0, x2: 30, y2: 40 });
  const dim = addEntity(doc, { type: 'dim', dimType: 'linear', orient: 'aligned', p1: [0, 0], p2: [30, 40], offset: 5 });
  // 寸法線の法線(-0.8, 0.6)の向きに5mm
  edit(doc, () => translateEntities(doc, [dim.id], -4, 3), { ownMove: true });
  assert.deepEqual([dim.p1, dim.p2], [[0, 0], [30, 40]]);
  near(dim.offset, 10);
});

test('引出線だけを動かすと、矢印の先は残り、文字の側だけが動く', () => {
  const doc = createDocument();
  addEntity(doc, { type: 'line', x1: 0, y1: 0, x2: 40, y2: 0 });
  const leader = addEntity(doc, { type: 'leader', points: [[40, 0], [50, 10]], content: 'C1' });
  edit(doc, () => translateEntities(doc, [leader.id], 5, 5), { ownMove: true });
  assert.deepEqual(leader.points, [[40, 0], [55, 15]]);
});

test('図形に付いていない寸法は、寸法だけを動かすと全体が動く', () => {
  const doc = createDocument();
  const dim = addEntity(doc, { type: 'dim', dimType: 'linear', orient: 'h', p1: [0, 0], p2: [10, 0], offset: 5 });
  edit(doc, () => translateEntities(doc, [dim.id], 3, 4), { ownMove: true });
  assert.deepEqual([dim.p1, dim.p2, dim.offset], [[3, 4], [13, 4], 9]);
});

test('正多角形を回すと、頂点に付いた寸法が付いていく', () => {
  const doc = createDocument();
  const sq = addEntity(doc, { type: 'polyline', closed: true, points: [[0, 0], [10, 0], [10, 10], [0, 10]] });
  const dim = addEntity(doc, { type: 'dim', dimType: 'linear', orient: 'aligned', p1: [10, 0], p2: [10, 10], offset: 5 });
  edit(doc, () => { sq.points = [[0, 0], [0, 10], [-10, 10], [-10, 0]]; });
  assert.deepEqual([dim.p1, dim.p2], [[0, 10], [-10, 10]]);
});
