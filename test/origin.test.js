import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createDocument } from '../src/model.js';
import { frameCornerReal, movedOrigin, originFromFrame, isOriginAtFrame } from '../src/origin.js';

test('枠の左下は、縮尺1:1なら実寸で(10,10)', () => {
  const doc = createDocument();
  assert.deepEqual(frameCornerReal(doc), { x: 10, y: 10 });
});

test('枠の左下は、縮尺1:2なら実寸で(20,20)、2:1なら(5,5)', () => {
  const doc = createDocument();
  doc.scale.ratio = [1, 2];
  assert.deepEqual(frameCornerReal(doc), { x: 20, y: 20 });
  doc.scale.ratio = [2, 1];
  assert.deepEqual(frameCornerReal(doc), { x: 5, y: 5 });
});

test('新しい図面の原点は枠の左下にある', () => {
  const doc = createDocument();
  assert.equal(isOriginAtFrame(doc), true);
  assert.deepEqual(originFromFrame(doc), { x: 0, y: 0 });
});

test('原点を右へ・上へ動かす(マイナスなら左・下)', () => {
  assert.deepEqual(movedOrigin({ x: 10, y: 10 }, 25, -5), { x: 35, y: 5 });
  assert.deepEqual(movedOrigin({ x: 10, y: 10 }, -10, -10), { x: 0, y: 0 });
});

test('小数で動かしても、計算の誤差(0.30000000000000004など)を残さない', () => {
  assert.deepEqual(movedOrigin({ x: 0.1, y: 0.2 }, 0.2, 0.1), { x: 0.3, y: 0.3 });
});

test('動かした原点の、枠の左下からの位置', () => {
  const doc = createDocument();
  doc.userOrigin = movedOrigin(doc.userOrigin, 40, 15.5);
  assert.equal(isOriginAtFrame(doc), false);
  assert.deepEqual(originFromFrame(doc), { x: 40, y: 15.5 });
});

test('縮尺を変えると、枠の左下は実寸では別の位置になる(原点は図形と一緒に残る)', () => {
  const doc = createDocument();
  doc.scale.ratio = [1, 2];
  assert.equal(isOriginAtFrame(doc), false);
  assert.deepEqual(originFromFrame(doc), { x: -10, y: -10 });
});
