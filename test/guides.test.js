import { test } from 'node:test';
import assert from 'node:assert/strict';
import { projectionGuides, guideSnapCandidates } from '../src/guides.js';

test('projectionGuides: 線分から端点・中点のX/Y座標を集める', () => {
  const g = projectionGuides([{ type: 'line', x1: 10, y1: 20, x2: 50, y2: 20 }]);
  assert.deepEqual(g.xs, [10, 30, 50]);
  assert.deepEqual(g.ys, [20]);
});

test('guideSnapCandidates: 垂直ガイドへの垂線の足にスナップ', () => {
  const g = { xs: [50], ys: [] };
  const cands = guideSnapCandidates(g, null, { x: 51, y: 200 }, 3);
  assert.deepEqual(cands, [{ x: 50, y: 200, kind: 'guide' }]);
});

test('guideSnapCandidates: ガイド同士の交点にスナップ', () => {
  const g = { xs: [50], ys: [80] };
  const cands = guideSnapCandidates(g, null, { x: 51, y: 81 }, 3);
  assert.ok(cands.some((c) => c.x === 50 && c.y === 80 && c.kind === 'guide-x'));
});

test('guideSnapCandidates: 45°線との交点(奥行き転写)', () => {
  // ミラー点(100,100) → y = x。垂直ガイドx=120との交点は(120,120)
  const g = { xs: [120], ys: [] };
  const cands = guideSnapCandidates(g, { x: 100, y: 100 }, { x: 119, y: 121 }, 3);
  assert.ok(cands.some((c) => c.x === 120 && c.y === 120 && c.kind === 'guide-45'));
  // 水平ガイドy=140との交点は(140,140)
  const g2 = { xs: [], ys: [140] };
  const cands2 = guideSnapCandidates(g2, { x: 100, y: 100 }, { x: 141, y: 139 }, 3);
  assert.ok(cands2.some((c) => c.x === 140 && c.y === 140 && c.kind === 'guide-45'));
});

test('guideSnapCandidates: 許容外は返さない', () => {
  const g = { xs: [50], ys: [80] };
  assert.deepEqual(guideSnapCandidates(g, null, { x: 200, y: 200 }, 3), []);
});
