import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findSnap } from '../src/snap.js';
import { createDocument, addEntity } from '../src/model.js';

function docWith(...entities) {
  const doc = createDocument();
  for (const e of entities) addEntity(doc, e);
  return doc;
}

test('端点にスナップする', () => {
  const doc = docWith({ type: 'line', x1: 0, y1: 0, x2: 100, y2: 0 });
  assert.deepEqual(findSnap(doc, { x: 99, y: 1 }, 3), { x: 100, y: 0, kind: 'end' });
});

test('中点にスナップする', () => {
  const doc = docWith({ type: 'line', x1: 0, y1: 0, x2: 100, y2: 0 });
  assert.deepEqual(findSnap(doc, { x: 51, y: 1 }, 3), { x: 50, y: 0, kind: 'mid' });
});

test('円の中心と四半点にスナップする', () => {
  const doc = docWith({ type: 'circle', cx: 50, cy: 50, r: 20 });
  assert.deepEqual(findSnap(doc, { x: 49, y: 51 }, 3), { x: 50, y: 50, kind: 'center' });
  assert.deepEqual(findSnap(doc, { x: 71, y: 50 }, 3), { x: 70, y: 50, kind: 'quad' });
});

test('線分同士の交点にスナップする', () => {
  // 交点(0,7)が端点・中点と重ならない配置にする
  const doc = docWith(
    { type: 'line', x1: 0, y1: -50, x2: 0, y2: 30 },
    { type: 'line', x1: -50, y1: 7, x2: 30, y2: 7 },
  );
  assert.deepEqual(findSnap(doc, { x: 1, y: 8 }, 3), { x: 0, y: 7, kind: 'intersection' });
});

test('線分と円の交点にスナップする', () => {
  // 交点(8,6)は四半点・中点と重ならない
  const doc = docWith(
    { type: 'circle', cx: 0, cy: 0, r: 10 },
    { type: 'line', x1: -20, y1: 6, x2: 20, y2: 6 },
  );
  assert.deepEqual(findSnap(doc, { x: 8.3, y: 6.3 }, 2), { x: 8, y: 6, kind: 'intersection' });
});

test('許容距離の外なら null', () => {
  const doc = docWith({ type: 'line', x1: 0, y1: 0, x2: 100, y2: 0 });
  assert.equal(findSnap(doc, { x: 30, y: 30 }, 3), null);
});

test('最も近い候補が勝つ', () => {
  const doc = docWith({ type: 'line', x1: 0, y1: 0, x2: 10, y2: 0 });
  // 端点(10,0)と中点(5,0)の間、端点寄り
  assert.equal(findSnap(doc, { x: 8, y: 0 }, 5).kind, 'end');
});

test('非表示レイヤーの図形にはスナップしない', () => {
  const doc = docWith({ type: 'line', x1: 0, y1: 0, x2: 100, y2: 0, layer: 'aux' });
  assert.deepEqual(findSnap(doc, { x: 99, y: 1 }, 3), { x: 100, y: 0, kind: 'end' });
  doc.layers.find((l) => l.id === 'aux').visible = false;
  assert.equal(findSnap(doc, { x: 99, y: 1 }, 3), null);
});

test('引出線用(perimeterStepDeg:45): 円周の斜め45°の点にも吸い付く', () => {
  const doc = docWith({ type: 'circle', cx: 50, cy: 50, r: 20 });
  const d = 20 / Math.SQRT2;
  const near45 = { x: 50 + d + 0.5, y: 50 + d - 0.4 };
  // ふだんは上下左右(90°ごと)だけなので、斜めの位置には吸い付かない
  assert.equal(findSnap(doc, near45, 2), null);
  const hit = findSnap(doc, near45, 2, 1, { perimeterStepDeg: 45 });
  assert.equal(hit.kind, 'quad');
  assert.ok(Math.abs(hit.x - (50 + d)) < 1e-6 && Math.abs(hit.y - (50 + d)) < 1e-6);
  // 225°(左下)も
  const sw = findSnap(doc, { x: 50 - d, y: 50 - d + 0.3 }, 2, 1, { perimeterStepDeg: 45 });
  assert.ok(Math.abs(sw.x - (50 - d)) < 1e-6 && Math.abs(sw.y - (50 - d)) < 1e-6);
});

test('引出線用(perimeterStepDeg:45): 円弧は弧の範囲内の45°ごとの点だけ', () => {
  const doc = docWith({ type: 'arc', cx: 0, cy: 0, r: 10, startAngle: 0, endAngle: 90 });
  const d = 10 / Math.SQRT2;
  const mid = findSnap(doc, { x: d + 0.3, y: d }, 2, 1, { perimeterStepDeg: 45 });
  assert.ok(Math.abs(mid.x - d) < 1e-6 && Math.abs(mid.y - d) < 1e-6);
  // 弧のない側(225°)には点を作らない
  assert.equal(findSnap(doc, { x: -d, y: -d }, 2, 1, { perimeterStepDeg: 45 }), null);
});
