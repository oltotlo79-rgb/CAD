import { test } from 'node:test';
import assert from 'node:assert/strict';
import { paperDimensions, frameRect, FRAME_MARGIN_MM } from '../src/papers.js';

test('A4縦は210×297mm', () => {
  assert.deepEqual(paperDimensions('A4', 'portrait'), { width: 210, height: 297 });
});

test('A3横は420×297mm', () => {
  assert.deepEqual(paperDimensions('A3', 'landscape'), { width: 420, height: 297 });
});

test('B4縦は257×364mm (JIS B列)', () => {
  assert.deepEqual(paperDimensions('B4', 'portrait'), { width: 257, height: 364 });
});

test('未知の用紙サイズは例外', () => {
  assert.throws(() => paperDimensions('A9', 'portrait'), /unknown paper size/);
});

test('図面枠は全周10mm内側', () => {
  assert.equal(FRAME_MARGIN_MM, 10);
  assert.deepEqual(frameRect('A4', 'portrait'),
    { x: 10, y: 10, width: 190, height: 277 });
});
