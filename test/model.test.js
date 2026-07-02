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
