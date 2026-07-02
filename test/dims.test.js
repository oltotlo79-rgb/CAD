import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fmtMm, dimText, dimLayout } from '../src/dims.js';

test('fmtMm: 整数はそのまま、小数は2桁で丸めゼロを付けない', () => {
  assert.equal(fmtMm(50), '50');
  assert.equal(fmtMm(12.345), '12.35');
  assert.equal(fmtMm(0.1 + 0.2), '0.3');
});

test('dimText: 水平寸法はX距離、垂直はY距離、平行は直線距離', () => {
  const base = { type: 'dim', dimType: 'linear', p1: [0, 0], p2: [30, 40], offset: 60 };
  assert.equal(dimText({ ...base, orient: 'h' }), '30');
  assert.equal(dimText({ ...base, orient: 'v' }), '40');
  assert.equal(dimText({ ...base, orient: 'aligned' }), '50');
});

test('dimText: φ・R・C・引出線・上書き', () => {
  assert.equal(dimText({ type: 'dim', dimType: 'dia', r: 25 }), 'φ50');
  assert.equal(dimText({ type: 'dim', dimType: 'rad', r: 25 }), 'R25');
  assert.equal(dimText({ type: 'dim', dimType: 'chamfer', size: 5 }), 'C5');
  assert.equal(dimText({ type: 'leader', content: '4×M6' }), '4×M6');
  assert.equal(dimText({ type: 'dim', dimType: 'dia', r: 25, override: 'φ50±0.1' }), 'φ50±0.1');
});

test('dimLayout 水平寸法: 寸法線は offset のy、矢印は両端で外向き', () => {
  const e = {
    type: 'dim', dimType: 'linear', orient: 'h',
    p1: [10, 0], p2: [60, 0], offset: 20,
  };
  const { lines, arrows, texts } = dimLayout(e, 1);
  assert.equal(lines.length, 3); // 補助線2 + 寸法線1
  const dimLine = lines[2];
  assert.deepEqual([dimLine[0].y, dimLine[1].y], [20, 20]);
  assert.deepEqual(arrows.map((a) => a.angleDeg).sort((a, b) => a - b), [0, 180]);
  assert.equal(texts[0].content, '50');
  assert.equal(texts[0].x, 35); // 中央
});

test('dimLayout: 縮尺1:2では突き出し・文字位置が実寸換算(2倍)される', () => {
  const e = {
    type: 'dim', dimType: 'linear', orient: 'h',
    p1: [10, 0], p2: [60, 0], offset: 20,
  };
  const l1 = dimLayout(e, 1);
  const l2 = dimLayout(e, 0.5);
  // 補助線の突き出し: k=1で2mm、k=0.5で4mm
  assert.equal(l1.lines[0][1].y, 22);
  assert.equal(l2.lines[0][1].y, 24);
});

test('dimLayout 引出線: 矢印の先端は対象点', () => {
  const e = { type: 'leader', points: [[0, 0], [10, 10]], content: 'M6' };
  const { arrows, lines } = dimLayout(e, 1);
  assert.deepEqual(arrows[0].at, { x: 0, y: 0 });
  assert.ok(lines.length >= 2); // 引出線 + 水平尾
});
