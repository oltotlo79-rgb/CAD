import { test } from 'node:test';
import assert from 'node:assert/strict';
import { trimLine, extendLine, offsetEntity, filletLines } from '../src/editOps.js';

const hline = { type: 'line', layer: 'outline', lineType: 'solid', x1: 0, y1: 0, x2: 100, y2: 0 };
const cutterAt = (x) => ({ type: 'line', x1: x, y1: -10, x2: x, y2: 10 });

test('trimLine: 2つの交差線の間をクリック → 中央が消え2本になる', () => {
  const pieces = trimLine(hline, { x: 50, y: 0 }, [cutterAt(30), cutterAt(70)]);
  assert.equal(pieces.length, 2);
  assert.deepEqual([pieces[0].x1, pieces[0].x2], [0, 30]);
  assert.deepEqual([pieces[1].x1, pieces[1].x2], [70, 100]);
  assert.equal(pieces[0].layer, 'outline');
});

test('trimLine: 端の区間をクリック → 1本だけ残る', () => {
  const pieces = trimLine(hline, { x: 10, y: 0 }, [cutterAt(30)]);
  assert.equal(pieces.length, 1);
  assert.deepEqual([pieces[0].x1, pieces[0].x2], [30, 100]);
});

test('trimLine: 交点がなければ null(何もしない)', () => {
  assert.equal(trimLine(hline, { x: 50, y: 0 }, [cutterAt(200)]), null);
});

test('trimLine: 円との交点でも切れる', () => {
  const circle = { type: 'circle', cx: 50, cy: 0, r: 20 };
  const pieces = trimLine(hline, { x: 50, y: 0 }, [circle]);
  assert.equal(pieces.length, 2);
  assert.deepEqual([pieces[0].x2, pieces[1].x1], [30, 70]);
});

test('extendLine: クリックした側の端点が最寄りの要素まで伸びる', () => {
  const target = { ...hline, x2: 50, y2: 0 }; // 0→50 の線
  const wall = cutterAt(80);
  const ext = extendLine(target, { x: 45, y: 0 }, [wall]);
  assert.deepEqual(ext, { x1: 0, y1: 0, x2: 80, y2: 0 });
});

test('extendLine: 延長方向に何もなければ null', () => {
  const target = { ...hline, x2: 50, y2: 0 };
  assert.equal(extendLine(target, { x: 45, y: 0 }, [cutterAt(-30)]), null);
});

test('filletLines: 直角の角にR5の円弧が入り、両線が接点まで縮む', () => {
  const l1 = { x1: 0, y1: 0, x2: 20, y2: 0 };
  const l2 = { x1: 0, y1: 0, x2: 0, y2: 20 };
  const f = filletLines(l1, { x: 10, y: 0 }, l2, { x: 0, y: 10 }, 5);
  assert.deepEqual(f.l1, { x1: 5, y1: 0, x2: 20, y2: 0 });
  assert.deepEqual(f.l2, { x1: 0, y1: 5, x2: 0, y2: 20 });
  assert.deepEqual([f.arc.cx, f.arc.cy, f.arc.r], [5, 5, 5]);
  const sweep = f.arc.endAngle - f.arc.startAngle;
  assert.ok(Math.abs(sweep - 90) < 1e-6);
});

test('filletLines: 交差しない位置の線も延長してフィレットされる', () => {
  const l1 = { x1: 10, y1: 0, x2: 30, y2: 0 };   // 交点(0,0)に届かない
  const l2 = { x1: 0, y1: 10, x2: 0, y2: 30 };
  const f = filletLines(l1, { x: 20, y: 0 }, l2, { x: 0, y: 20 }, 5);
  assert.deepEqual([f.l1.x1, f.l1.y1], [5, 0]); // 接点まで延長
  assert.deepEqual([f.l2.x1, f.l2.y1], [0, 5]);
});

test('filletLines: 平行線は null', () => {
  const l1 = { x1: 0, y1: 0, x2: 10, y2: 0 };
  const l2 = { x1: 0, y1: 5, x2: 10, y2: 5 };
  assert.equal(filletLines(l1, { x: 5, y: 0 }, l2, { x: 5, y: 5 }, 2), null);
});

test('offsetEntity: 直線はクリック側へ平行移動した複製', () => {
  const off = offsetEntity(hline, 10, { x: 50, y: 5 });
  assert.deepEqual([off.y1, off.y2], [10, 10]);
  const off2 = offsetEntity(hline, 10, { x: 50, y: -5 });
  assert.deepEqual([off2.y1, off2.y2], [-10, -10]);
});

test('offsetEntity: 円は外側クリックで拡大、内側で縮小', () => {
  const c = { type: 'circle', layer: 'outline', lineType: 'solid', cx: 0, cy: 0, r: 20 };
  assert.equal(offsetEntity(c, 5, { x: 30, y: 0 }).r, 25);
  assert.equal(offsetEntity(c, 5, { x: 1, y: 0 }).r, 15);
  assert.equal(offsetEntity(c, 25, { x: 1, y: 0 }), null); // r<=0
});

test('offsetEntity: 矩形は内側クリックで縮み、外側で膨らむ', () => {
  const r = { type: 'rect', layer: 'outline', lineType: 'solid', x: 0, y: 0, width: 40, height: 20 };
  const grown = offsetEntity(r, 5, { x: 100, y: 100 });
  assert.deepEqual([grown.x, grown.y, grown.width, grown.height], [-5, -5, 50, 30]);
  const shrunk = offsetEntity(r, 5, { x: 20, y: 10 });
  assert.deepEqual([shrunk.x, shrunk.y, shrunk.width, shrunk.height], [5, 5, 30, 10]);
});
