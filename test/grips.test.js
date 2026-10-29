import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gripPoints, moveGrip, gripAnchor } from '../src/grips.js';

const keys = (e) => gripPoints(e).map((g) => g.key);
const at = (e, key) => gripPoints(e).find((g) => g.key === key);
const near = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} !~ ${b}`);

test('直線: 両端をつまむと、その端だけが動く', () => {
  const l = { type: 'line', x1: 0, y1: 0, x2: 10, y2: 0 };
  assert.deepEqual(keys(l), ['p1', 'p2']);
  assert.ok(moveGrip(l, 'p2', { x: 20, y: 5 }));
  assert.deepEqual([l.x1, l.y1, l.x2, l.y2], [0, 0, 20, 5]);
  // Shift で向きをそろえる基準は、反対側の端
  assert.deepEqual(gripAnchor(l, 'p2'), { x: 0, y: 0 });
});

test('矩形: 角をつまむと反対の角は動かず、辺の真ん中をつまむとその辺だけが動く', () => {
  const r = { type: 'rect', x: 0, y: 0, width: 100, height: 50 };
  assert.deepEqual(keys(r), ['c0', 'c1', 'c2', 'c3', 'e0', 'e1', 'e2', 'e3']);
  assert.deepEqual(at(r, 'c2'), { key: 'c2', x: 100, y: 50 });
  moveGrip(r, 'c2', { x: 120, y: 70 });
  assert.deepEqual([r.x, r.y, r.width, r.height], [0, 0, 120, 70]);
  // 左下の角を右上へ越えて引っぱっても、正しい向きの四角になる
  moveGrip(r, 'c0', { x: 130, y: 80 });
  assert.deepEqual([r.x, r.y, r.width, r.height], [120, 70, 10, 10]);
  const s = { type: 'rect', x: 0, y: 0, width: 100, height: 50 };
  moveGrip(s, 'e1', { x: 80, y: 999 }); // 右の辺: 幅だけ変わる
  assert.deepEqual([s.x, s.y, s.width, s.height], [0, 0, 80, 50]);
  moveGrip(s, 'e2', { x: -999, y: 30 }); // 上の辺: 高さだけ
  assert.deepEqual([s.x, s.y, s.width, s.height], [0, 0, 80, 30]);
  // 幅が0になる動かし方はしない
  assert.equal(moveGrip(s, 'e1', { x: 0, y: 0 }), false);
  assert.equal(s.width, 80);
});

test('回転した矩形も、回転の向きのまま角を動かせる', () => {
  const r = { type: 'rect', x: 0, y: 0, width: 10, height: 10, rotation: 90 };
  // 90°回した矩形の向かいの角(局所(10,10))は (-10,10)
  near(at(r, 'c2').x, -10); near(at(r, 'c2').y, 10);
  moveGrip(r, 'c2', { x: -20, y: 30 });
  near(r.width, 30); near(r.height, 20); assert.equal(r.rotation, 90);
  near(r.x, 0); near(r.y, 0);
});

test('連続線・スプライン・引出線: 各点をつまんで動かせる', () => {
  const p = { type: 'polyline', points: [[0, 0], [10, 0], [10, 10]], closed: false };
  assert.deepEqual(keys(p), ['v0', 'v1', 'v2']);
  moveGrip(p, 'v1', { x: 15, y: -5 });
  assert.deepEqual(p.points, [[0, 0], [15, -5], [10, 10]]);
  assert.deepEqual(gripAnchor(p, 'v1'), { x: 0, y: 0 }); // 1つ前の点
  const leader = { type: 'leader', points: [[0, 0], [5, 5]] };
  moveGrip(leader, 'v0', { x: 1, y: 2 });
  assert.deepEqual(leader.points[0], [1, 2]);
});

test('円: 上下左右の点で半径、円弧: 両端で角度・真ん中で半径を変える', () => {
  const c = { type: 'circle', cx: 0, cy: 0, r: 10 };
  assert.deepEqual(keys(c), ['q0', 'q1', 'q2', 'q3']);
  moveGrip(c, 'q1', { x: 3, y: 4 });
  assert.equal(c.r, 5);
  const a = { type: 'arc', cx: 0, cy: 0, r: 10, startAngle: 0, endAngle: 90 };
  assert.deepEqual(keys(a), ['start', 'end', 'mid']);
  moveGrip(a, 'end', { x: -5, y: 0 });
  assert.deepEqual([a.r, a.startAngle, a.endAngle], [10, 0, 180]);
  moveGrip(a, 'start', { x: 0, y: -3 }); // -90° から 180° まで
  assert.deepEqual([a.startAngle, a.endAngle], [-90, 180]);
  moveGrip(a, 'mid', { x: 0, y: 20 });
  assert.equal(a.r, 20);
});

test('楕円: 軸の端で横・縦の半径を変える(楕円弧にはつまみを出さない)', () => {
  const e = { type: 'ellipse', cx: 0, cy: 0, rx: 10, ry: 5 };
  moveGrip(e, 'q0', { x: 20, y: 3 });
  moveGrip(e, 'q1', { x: 2, y: 8 });
  assert.deepEqual([e.rx, e.ry], [20, 8]);
  assert.deepEqual(keys({ ...e, startAngle: 0, endAngle: 90 }), []);
});

test('長さ寸法: 補助線の根元(測る2点)と寸法線の両端をつまめる', () => {
  const d = { type: 'dim', dimType: 'linear', orient: 'h', p1: [0, 0], p2: [50, 0], offset: -10 };
  assert.deepEqual(keys(d), ['p1', 'p2', 'line1', 'line2']);
  assert.deepEqual(at(d, 'line2'), { key: 'line2', x: 50, y: -10 });
  // 根元を動かす → 測る点が変わる(補助線が動く)
  moveGrip(d, 'p2', { x: 60, y: 5 });
  assert.deepEqual(d.p2, [60, 5]);
  // 寸法線をつまんで上下に動かす
  moveGrip(d, 'line1', { x: 999, y: -20 });
  assert.equal(d.offset, -20);
  const v = { type: 'dim', dimType: 'linear', orient: 'v', p1: [0, 0], p2: [0, 30], offset: 10 };
  moveGrip(v, 'line2', { x: 15, y: 999 }); // 縦の寸法は左右に
  assert.equal(v.offset, 15);
  const al = { type: 'dim', dimType: 'linear', orient: 'aligned', p1: [0, 0], p2: [30, 40], offset: 5 };
  moveGrip(al, 'line1', { x: -8, y: 6 }); // 法線(-0.8,0.6)の向きに10
  near(al.offset, 10);
});

test('φ・R寸法は円周の点で向きを、角度寸法は弧で大きさを、バルーンは2点を動かせる', () => {
  const dia = { type: 'dim', dimType: 'dia', cx: 0, cy: 0, r: 10, angleDeg: 0 };
  moveGrip(dia, 'edge', { x: 0, y: 20 });
  assert.equal(dia.angleDeg, 90);
  const ang = { type: 'dim', dimType: 'angle', vertex: [0, 0], p1: [10, 0], p2: [0, 10], radius: 5 };
  moveGrip(ang, 'arc', { x: 6, y: 8 });
  assert.equal(ang.radius, 10);
  const b = { type: 'balloon', number: 1, at: [0, 0], pos: [10, 10] };
  assert.deepEqual(keys(b), ['at', 'pos']);
  moveGrip(b, 'pos', { x: 20, y: 5 });
  assert.deepEqual(b.pos, [20, 5]);
});

test('文字・記号・ハッチにはつまみを出さない(全体をドラッグで動かす)', () => {
  assert.deepEqual(keys({ type: 'text', x: 0, y: 0, content: 'a', height: 3.5 }), []);
  assert.deepEqual(keys({ type: 'roughness', x: 0, y: 0 }), []);
  assert.deepEqual(keys({ type: 'hatch', boundary: { kind: 'rect', x: 0, y: 0, width: 1, height: 1 } }), []);
});
