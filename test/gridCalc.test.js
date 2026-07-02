import { test } from 'node:test';
import assert from 'node:assert/strict';
import { autoGridStep, effectiveGridStep, GRID_STEPS_MM, MIN_GRID_PX } from '../src/gridCalc.js';

test('段階は 0.1/0.5/1/2/5/10 の6種、最小表示は8px', () => {
  assert.deepEqual(GRID_STEPS_MM, [0.1, 0.5, 1, 2, 5, 10]);
  assert.equal(MIN_GRID_PX, 8);
});

test('十分ズームインしていれば 0.1mm を選ぶ', () => {
  assert.equal(autoGridStep(100), 0.1); // 0.1mm = 10px ≥ 8px
});

test('中間ズームでは 8px 以上になる最小の段階を選ぶ', () => {
  assert.equal(autoGridStep(10), 1);   // 0.1→1px, 0.5→5px は不足、1→10px
  assert.equal(autoGridStep(5), 2);    // 2mm → 10px
  assert.equal(autoGridStep(1), 10);   // 10mm → 10px
});

test('ズームアウトしすぎたら null(グリッド非表示)', () => {
  assert.equal(autoGridStep(0.5), null); // 10mm でも 5px < 8px
});

test('effectiveGridStep: manual モードは固定値を返す', () => {
  assert.equal(effectiveGridStep({ mode: 'manual', manualMm: 5 }, 100), 5);
  assert.equal(effectiveGridStep({ mode: 'auto', manualMm: 5 }, 100), 0.1);
});
