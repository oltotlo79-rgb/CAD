import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  boundaryFromEntity, hatchSegments, pointInBoundary, boundaryBBox,
} from '../src/hatch.js';

test('boundaryFromEntity: 閉図形のみ境界になる', () => {
  assert.ok(boundaryFromEntity({ type: 'rect', x: 0, y: 0, width: 10, height: 10 }));
  assert.ok(boundaryFromEntity({ type: 'circle', cx: 0, cy: 0, r: 5 }));
  assert.ok(boundaryFromEntity({ type: 'polyline', points: [[0, 0], [10, 0], [5, 8]], closed: true }));
  assert.equal(boundaryFromEntity({ type: 'polyline', points: [[0, 0], [10, 0]], closed: false }), null);
  assert.equal(boundaryFromEntity({ type: 'line', x1: 0, y1: 0, x2: 1, y2: 1 }), null);
});

test('矩形の水平ハッチング: 本数と長さが正しい', () => {
  const b = boundaryFromEntity({ type: 'rect', x: 0, y: 0, width: 20, height: 10 });
  const segs = hatchSegments(b, 0, 2); // 2mm間隔の水平線
  // y=2,4,6,8 の4本(y=0,10は境界上)
  assert.equal(segs.length, 4);
  for (const [a, c] of segs) {
    assert.equal(Math.abs(c.x - a.x), 20);
    assert.equal(a.y, c.y);
  }
});

test('円のハッチング: 中心を通る線が最長(直径)', () => {
  const b = boundaryFromEntity({ type: 'circle', cx: 0, cy: 0, r: 10 });
  const segs = hatchSegments(b, 0, 5); // y=-10..10 → y=-5,0,5(端は接して交点なし)
  const lens = segs.map(([a, c]) => Math.hypot(c.x - a.x, c.y - a.y));
  assert.equal(segs.length, 3);
  assert.ok(Math.abs(Math.max(...lens) - 20) < 1e-6);
});

test('45°ハッチングも生成される', () => {
  const b = boundaryFromEntity({ type: 'rect', x: 0, y: 0, width: 10, height: 10 });
  const segs = hatchSegments(b, 45, 3);
  assert.ok(segs.length >= 3);
});

test('凹多角形(L字)では線分が分割される', () => {
  // L字: (0,0)-(20,0)-(20,5)-(5,5)-(5,15)-(0,15)
  const b = boundaryFromEntity({
    type: 'polyline', closed: true,
    points: [[0, 0], [20, 0], [20, 5], [5, 5], [5, 15], [0, 15]],
  });
  const segs = hatchSegments(b, 0, 2);
  // y=2,4 は幅20、y=6..14 は幅5
  const wide = segs.filter(([a, c]) => Math.abs(c.x - a.x) > 10);
  const narrow = segs.filter(([a, c]) => Math.abs(c.x - a.x) <= 10);
  assert.equal(wide.length, 2);
  assert.ok(narrow.length >= 4);
});

test('pointInBoundary: 円・多角形の内外判定', () => {
  const c = boundaryFromEntity({ type: 'circle', cx: 0, cy: 0, r: 5 });
  assert.ok(pointInBoundary(c, { x: 1, y: 1 }));
  assert.ok(!pointInBoundary(c, { x: 6, y: 0 }));
  const l = boundaryFromEntity({
    type: 'polyline', closed: true,
    points: [[0, 0], [20, 0], [20, 5], [5, 5], [5, 15], [0, 15]],
  });
  assert.ok(pointInBoundary(l, { x: 2, y: 10 }));
  assert.ok(!pointInBoundary(l, { x: 10, y: 10 })); // L字の欠け部分
});

test('boundaryBBox: 楕円は中心±半径', () => {
  const b = boundaryFromEntity({ type: 'ellipse', cx: 10, cy: 20, rx: 5, ry: 3 });
  assert.deepEqual(boundaryBBox(b), { minX: 5, minY: 17, maxX: 15, maxY: 23 });
});
