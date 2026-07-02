import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  round6, distance, angleDegOf, lineEndPoint, snapToGrid, distancePointToSegment,
} from '../src/geometry.js';

const near = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} !~ ${b}`);

test('lineEndPoint: 長さ10・角度0°で x+10', () => {
  assert.deepEqual(lineEndPoint({ x: 5, y: 5 }, 10, 0), { x: 15, y: 5 });
});

test('lineEndPoint: 角度90°で y+10', () => {
  assert.deepEqual(lineEndPoint({ x: 0, y: 0 }, 10, 90), { x: 0, y: 10 });
});

test('distance と angleDegOf は lineEndPoint と整合する', () => {
  const start = { x: 3, y: 4 };
  const end = lineEndPoint(start, 25, 30);
  near(distance(start, end), 25, 1e-6);
  near(angleDegOf(start, end), 30, 1e-6);
});

test('snapToGrid: 0.1mm ステップでも浮動小数のゴミが出ない', () => {
  assert.deepEqual(snapToGrid({ x: 0.32, y: 0.27 }, 0.1), { x: 0.3, y: 0.3 });
  assert.deepEqual(snapToGrid({ x: 14.9, y: -6.2 }, 10), { x: 10, y: -10 });
});

test('round6 は6桁で丸める', () => {
  assert.equal(round6(0.1 + 0.2), 0.3);
});

test('distancePointToSegment: 中央上は垂線距離、端の外は端点距離', () => {
  const a = { x: 0, y: 0 }, b = { x: 10, y: 0 };
  near(distancePointToSegment({ x: 5, y: 3 }, a, b), 3);
  near(distancePointToSegment({ x: 14, y: 3 }, a, b), 5);
  near(distancePointToSegment({ x: 2, y: 0 }, a, a), 2); // 零長セグメント
});
