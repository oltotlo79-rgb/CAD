import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  fmtMm, dimText, dimLayout, annoTextMm, balloonLayout, roughnessLayout, fcfLayout,
  annotationLayout, DIM_TEXT_MM, dimAxis, dimShiftAt, dimTextHit,
} from '../src/dims.js';

const near = (a, b, eps = 1e-6) => Math.abs(a - b) < eps;
const hdim = {
  type: 'dim', dimType: 'linear', orient: 'h', p1: [10, 0], p2: [60, 0], offset: 20,
};

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

test('角度寸法: 90°の値と円弧レイアウト', () => {
  const e = {
    type: 'dim', dimType: 'angle',
    vertex: [0, 0], p1: [10, 0], p2: [0, 10], radius: 8,
  };
  assert.equal(dimText(e), '90°');
  const l = dimLayout(e, 1);
  assert.equal(l.arcs.length, 1);
  assert.deepEqual([l.arcs[0].r, l.arcs[0].startDeg, l.arcs[0].endDeg], [8, 0, 90]);
  assert.equal(l.lines.length, 2);  // 頂点から両レイへの補助線
  assert.equal(l.arrows.length, 2); // 弧の両端
});

test('dimLayout 引出線: 矢印の先端は対象点', () => {
  const e = { type: 'leader', points: [[0, 0], [10, 10]], content: 'M6' };
  const { arrows, lines } = dimLayout(e, 1);
  assert.deepEqual(arrows[0].at, { x: 0, y: 0 });
  assert.ok(lines.length >= 2); // 引出線 + 水平尾
});

test('寸法の値の移動: 補助線の内側なら寸法線はそのまま、値だけ寸法線に沿ってずれる', () => {
  const l = dimLayout({ ...hdim, textShift: 10 }, 1);
  assert.deepEqual([l.texts[0].x, l.texts[0].y], [45, 21]); // 中央35 + 10
  assert.deepEqual([l.lines[2][0].x, l.lines[2][1].x], [10, 60]);
  // 矢印は内側から外向き
  assert.deepEqual(l.arrows.map((a) => [a.at.x, a.angleDeg]), [[10, 180], [60, 0]]);
});

test('寸法の値の移動: 補助線の外に出すと寸法線が値の先まで延び、矢印は外側から内向き', () => {
  const l = dimLayout({ ...hdim, textShift: 40 }, 1); // 中央35+40=75 > 補助線60
  assert.equal(l.texts[0].x, 75);
  const xs = [l.lines[2][0].x, l.lines[2][1].x].sort((a, b) => a - b);
  assert.equal(xs[0], 10 - 6);                // 反対側は矢印の軸ぶん(6mm)突き出す
  assert.ok(near(xs[1], 75 + 2 * 3.5 * 0.3)); // 値の側は文字(2文字)の外端まで
  assert.deepEqual(l.arrows.map((a) => [a.at.x, a.angleDeg]), [[10, 0], [60, 180]]);
  assert.equal(l.lines.length, 3);
});

test('寸法の値の移動: 左側に出した場合も同様に延長される', () => {
  const l = dimLayout({ ...hdim, textShift: -40 }, 1);
  const xs = [l.lines[2][0].x, l.lines[2][1].x].sort((a, b) => a - b);
  assert.ok(near(xs[0], -5 - 2.1));
  assert.equal(xs[1], 60 + 6);
  assert.deepEqual(l.arrows.map((a) => [a.at.x, a.angleDeg]), [[10, 0], [60, 180]]);
});

test('寸法の値の移動: 垂直寸法・平行寸法では寸法線の向きに沿ってずれる', () => {
  const v = dimLayout({
    type: 'dim', dimType: 'linear', orient: 'v', p1: [0, 10], p2: [0, 60], offset: 20, textShift: 5,
  }, 1);
  assert.deepEqual([v.texts[0].x, v.texts[0].y], [19, 40]);
  const al = dimLayout({
    type: 'dim', dimType: 'linear', orient: 'aligned', p1: [0, 0], p2: [30, 40], offset: 10, textShift: 10,
  }, 1);
  // 寸法線の中点(7,26)から向き(0.6,0.8)に10、さらに法線側へ隙間1mm
  assert.ok(near(al.texts[0].x, 12.2) && near(al.texts[0].y, 34.6));
});

test('dimAxis: 寸法線の向き(水平→+x、垂直→+y、平行→1点目から2点目)', () => {
  assert.deepEqual(dimAxis(hdim), { x: 1, y: 0 });
  assert.deepEqual(dimAxis({ ...hdim, orient: 'v' }), { x: 0, y: 1 });
  const u = dimAxis({ ...hdim, orient: 'aligned', p1: [0, 0], p2: [30, 40] });
  assert.ok(near(u.x, 0.6) && near(u.y, 0.8));
});

test('dimShiftAt: マウス位置を寸法線の向きに投影した中央からのずれ', () => {
  assert.equal(dimShiftAt(hdim, { x: 50, y: 99 }), 15); // 中央35から+15(上下位置は無関係)
  assert.equal(dimShiftAt(hdim, { x: 0, y: 0 }), -35);
});

test('dimTextHit: 寸法値の文字の範囲だけを判定(垂直寸法は回転した文字枠)', () => {
  // 水平: 文字"50"は x=35 中央、y=21〜24.5
  assert.ok(dimTextHit(hdim, { x: 35, y: 22.5 }, 0.1, 1));
  assert.ok(!dimTextHit(hdim, { x: 35, y: 20 }, 0.1, 1)); // 寸法線上は文字ではない
  assert.ok(dimTextHit({ ...hdim, textShift: 40 }, { x: 75, y: 22 }, 0.1, 1));
  // 垂直: 文字は x=19 から左へ文字高さぶん、y=35 中央
  const v = { type: 'dim', dimType: 'linear', orient: 'v', p1: [0, 10], p2: [0, 60], offset: 20 };
  assert.ok(dimTextHit(v, { x: 17.5, y: 35 }, 0.1, 1));
  assert.ok(!dimTextHit(v, { x: 17.5, y: 45 }, 0.1, 1));
  // 直径寸法など平行移動できない寸法は対象外
  assert.ok(!dimTextHit({ type: 'dim', dimType: 'dia', cx: 0, cy: 0, r: 10, angleDeg: 0 }, { x: 18, y: 1 }, 5, 1));
});

test('annoTextMm: 注記の文字高さは textMm、未指定・不正値は既定3.5', () => {
  assert.equal(annoTextMm({ type: 'dim' }), DIM_TEXT_MM);
  assert.equal(annoTextMm({ type: 'dim', textMm: 5 }), 5);
  assert.equal(annoTextMm({ type: 'dim', textMm: 0 }), DIM_TEXT_MM);
  assert.equal(annoTextMm({ type: 'dim', textMm: 'x' }), DIM_TEXT_MM);
});

test('注記レイアウトは文字高さ textMm を返す(描画・SVGのフォントサイズ用)', () => {
  const dim = { type: 'dim', dimType: 'rad', cx: 0, cy: 0, r: 10, angleDeg: 0, textMm: 5 };
  assert.equal(dimLayout(dim, 1).textMm, 5);
  assert.equal(annotationLayout({ type: 'roughness', x: 0, y: 0, value: 'Ra 6.3' }, 1).textMm, 3.5);
  assert.equal(annotationLayout({ type: 'fcf', x: 0, y: 0, cells: ['//'], textMm: 7 }, 1).textMm, 7);
  assert.equal(balloonLayout({ type: 'balloon', number: 1, at: [0, 0], pos: [30, 0], textMm: 2.5 }, 1).textMm, 2.5);
});

test('dimLayout: 文字を大きくすると φ/R の引出し部も文字に合わせて伸びる', () => {
  const base = { type: 'dim', dimType: 'dia', cx: 0, cy: 0, r: 10, angleDeg: 0 };
  // 引出し部の長さ = 文字高さ×2(既定3.5→7mm、文字7mm→14mm)
  assert.equal(dimLayout(base, 1).lines[0][1].x, 10 + 7);
  assert.equal(dimLayout({ ...base, textMm: 7 }, 1).lines[0][1].x, 10 + 14);
});

test('balloonLayout: 文字高さに比例して円が大きくなる(3.5mmで半径4)', () => {
  const e = { type: 'balloon', number: 5, at: [0, 0], pos: [30, 0] };
  assert.equal(balloonLayout(e, 1).circle.r, 4);
  assert.equal(balloonLayout({ ...e, textMm: 7 }, 1).circle.r, 8);
});

test('粗さ記号・公差枠: 文字高さに比例して記号も大きくなる', () => {
  const rough = { type: 'roughness', x: 0, y: 0, value: 'Ra 6.3' };
  const r1 = roughnessLayout(rough, 1).lines[1][1]; // 右の長い脚の先端(長さ10)
  const r2 = roughnessLayout({ ...rough, textMm: 7 }, 1).lines[1][1];
  assert.ok(Math.abs(r2.y - r1.y * 2) < 1e-9);
  const fcf = { type: 'fcf', x: 0, y: 0, cells: ['//', '0.05', 'A'] };
  const rowH = (l) => l.lines[0][1].y - l.lines[0][0].y; // 左端の縦線の長さ = 行高さ
  assert.equal(rowH(fcfLayout(fcf, 1)), 7);
  assert.equal(rowH(fcfLayout({ ...fcf, textMm: 7 }, 1)), 14);
});
