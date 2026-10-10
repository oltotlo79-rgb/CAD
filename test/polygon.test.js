import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  POLYGON_SIZE_MODES, parseSides, regularPolygonPoints, polygonFromCursor,
} from '../src/polygon.js';

const near = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} !~ ${b}`);
const dist = ([x1, y1], [x2, y2]) => Math.hypot(x2 - x1, y2 - y1);
const sideLengths = (pts) => pts.map((p, i) => dist(p, pts[(i + 1) % pts.length]));

test('大きさの決め方は 二面幅・対角・一辺 の3つ', () => {
  assert.deepEqual(Object.keys(POLYGON_SIZE_MODES), ['side', 'corner', 'edge']);
  assert.equal(POLYGON_SIZE_MODES.side.label, '二面幅');
  assert.equal(POLYGON_SIZE_MODES.corner.label, '対角');
  assert.equal(POLYGON_SIZE_MODES.edge.label, '一辺');
});

test('parseSides: 3〜64の整数だけを角数として受け付ける(全角数字も可)', () => {
  assert.equal(parseSides('6'), 6);
  assert.equal(parseSides(' ８ '), 8);
  assert.equal(parseSides('3'), 3);
  assert.equal(parseSides('64'), 64);
  for (const bad of ['2', '65', '5.5', '', 'abc', '-6']) assert.equal(parseSides(bad), null, bad);
});

test('二面幅: 六角形の向かい合う辺の間が指定の大きさで、最初の辺の真ん中が指定の向きにくる', () => {
  const pts = regularPolygonPoints({ x: 100, y: 50 }, 6, 13, 90, 'side');
  assert.equal(pts.length, 6);
  for (const len of sideLengths(pts)) near(len, 13 / Math.sqrt(3)); // 一辺 = 二面幅/√3
  // 最初の辺(頂点0→1)の真ん中が中心の真上 6.5mm
  near((pts[0][0] + pts[1][0]) / 2, 100);
  near((pts[0][1] + pts[1][1]) / 2, 56.5);
  // 上の辺は水平(上下が平らな向き)
  near(pts[0][1], pts[1][1]);
});

test('対角: 角を通る円の直径が指定の大きさで、最初の角が指定の向きにくる', () => {
  const pts = regularPolygonPoints({ x: 0, y: 0 }, 4, 20, 0, 'corner');
  assert.deepEqual(pts[0], [10, 0]);
  for (const p of pts) near(Math.hypot(p[0], p[1]), 10);
  for (const len of sideLengths(pts)) near(len, 10 * Math.SQRT2);
});

test('一辺: すべての辺が指定の長さになる(正三角形)', () => {
  const pts = regularPolygonPoints({ x: 10, y: 10 }, 3, 30, 90, 'edge');
  assert.equal(pts.length, 3);
  for (const len of sideLengths(pts)) near(len, 30);
  near(pts[0][0], 10); // 最初の角が真上
  assert.ok(pts[0][1] > 10);
});

test('頂点は左回りに並び、-0 や丸め誤差のゴミを含まない', () => {
  const pts = regularPolygonPoints({ x: 0, y: 0 }, 4, 20, 90, 'side');
  assert.deepEqual(pts, [[10, 10], [-10, 10], [-10, -10], [10, -10]]);
  const diamond = regularPolygonPoints({ x: 0, y: 0 }, 4, 20, 90, 'corner');
  assert.deepEqual(diamond, [[0, 10], [-10, 0], [0, -10], [10, 0]]);
  for (const [x, y] of diamond) assert.ok(!Object.is(x, -0) && !Object.is(y, -0));
});

test('polygonFromCursor: 向きは15°刻みに丸め、大きさはその向きへの距離で測る', () => {
  // 真上から少し右にずれた点でも、向き90°・二面幅13(中心→辺6.5の2倍)になる
  const r = polygonFromCursor({ x: 0, y: 0 }, { x: 0.5, y: 6.5 }, 6, 'side');
  assert.deepEqual(r, { size: 13, angleDeg: 90 });
  // 対角は中心→角の2倍、一辺は六角形なら中心→角と同じ
  assert.deepEqual(polygonFromCursor({ x: 0, y: 0 }, { x: 10, y: 0 }, 6, 'corner'), { size: 20, angleDeg: 0 });
  assert.deepEqual(polygonFromCursor({ x: 0, y: 0 }, { x: 10, y: 0 }, 6, 'edge'), { size: 10, angleDeg: 0 });
});

test('polygonFromCursor: 吸着した点(exact)なら、その点にぴったり合わせる', () => {
  const r = polygonFromCursor({ x: 0, y: 0 }, { x: 3, y: 4 }, 4, 'corner', true);
  near(r.size, 10);
  near(r.angleDeg, Math.atan2(4, 3) * 180 / Math.PI);
  const pts = regularPolygonPoints({ x: 0, y: 0 }, 4, r.size, r.angleDeg, 'corner');
  assert.deepEqual(pts[0], [3, 4]);
});

test('polygonFromCursor: 左向きは180°(-180°にしない)、中心と同じ点なら null', () => {
  assert.equal(polygonFromCursor({ x: 0, y: 0 }, { x: -10, y: -0.1 }, 6, 'side').angleDeg, 180);
  assert.equal(polygonFromCursor({ x: 0, y: 0 }, { x: 0, y: -10 }, 6, 'side').angleDeg, -90);
  assert.equal(polygonFromCursor({ x: 5, y: 5 }, { x: 5, y: 5 }, 6, 'side'), null);
});
