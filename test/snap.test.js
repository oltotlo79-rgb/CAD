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
