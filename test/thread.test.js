import { test } from 'node:test';
import assert from 'node:assert/strict';
import { threadHoleEntities, THREAD_SIZES } from '../src/thread.js';

test('THREAD_SIZES: JIS並目の下穴径(代表値)', () => {
  assert.equal(THREAD_SIZES.M3.drill, 2.5);
  assert.equal(THREAD_SIZES.M6.drill, 5.0);
  assert.equal(THREAD_SIZES.M10.drill, 8.5);
});

test('threadHoleEntities: 下穴円(太実線)+谷3/4円弧(細実線)+中心線十字', () => {
  const parts = threadHoleEntities({ x: 100, y: 50 }, 'M6', 3);
  assert.equal(parts.length, 4);
  const [hole, crest, h, v] = parts;
  assert.deepEqual([hole.type, hole.cx, hole.cy, hole.r, hole.lineType], ['circle', 100, 50, 2.5, 'solid']);
  assert.deepEqual([crest.type, crest.r, crest.startAngle, crest.endAngle, crest.lineType],
    ['arc', 3, 0, 270, 'thin']);
  assert.equal(crest.layer, 'outline'); // 印刷される細実線
  // 中心線は呼び半径+3mm はみ出す
  assert.deepEqual([h.x1, h.x2, h.lineType, h.layer], [94, 106, 'chain', 'center']);
  assert.deepEqual([v.y1, v.y2], [44, 56]);
});

test('threadHoleEntities: 未知のサイズは null', () => {
  assert.equal(threadHoleEntities({ x: 0, y: 0 }, 'M99'), null);
});
