import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  scaleK, realToPaper, paperToReal,
  paperToScreen, screenToPaper, zoomAt, fitPaperView,
} from '../src/viewTransform.js';

const near = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} !~ ${b}`);

test('scaleK: 1:5 は 0.2、2:1 は 2', () => {
  near(scaleK({ ratio: [1, 5] }), 0.2);
  near(scaleK({ ratio: [2, 1] }), 2);
});

test('realToPaper: 1:5 では実寸500mmが紙上100mm', () => {
  const p = realToPaper({ x: 500, y: 250 }, { ratio: [1, 5] });
  near(p.x, 100); near(p.y, 50);
});

test('paperToReal は realToPaper の逆変換', () => {
  const scale = { ratio: [1, 2] };
  const p = paperToReal(realToPaper({ x: 33.3, y: -7 }, scale), scale);
  near(p.x, 33.3); near(p.y, -7);
});

test('y軸: 紙のyが増えると画面yは減る(上向き)', () => {
  const view = { panX: 0, panY: 0, pxPerMm: 2, canvasWidth: 800, canvasHeight: 600 };
  const low = paperToScreen({ x: 0, y: 10 }, view);
  const high = paperToScreen({ x: 0, y: 20 }, view);
  assert.ok(high.y < low.y);
  near(low.y, 600 - 20);
});

test('screenToPaper は paperToScreen の逆変換', () => {
  const view = { panX: -5, panY: 12, pxPerMm: 3.7, canvasWidth: 800, canvasHeight: 600 };
  const p = screenToPaper(paperToScreen({ x: 42, y: 99 }, view), view);
  near(p.x, 42); near(p.y, 99);
});

test('zoomAt はカーソル位置の紙座標を固定する', () => {
  const view = { panX: 0, panY: 0, pxPerMm: 2, canvasWidth: 800, canvasHeight: 600 };
  const cursor = { x: 300, y: 200 };
  const before = screenToPaper(cursor, view);
  const zoomed = zoomAt(view, cursor, 1.5);
  const after = screenToPaper(cursor, zoomed);
  near(zoomed.pxPerMm, 3);
  near(after.x, before.x); near(after.y, before.y);
});

test('fitPaperView で用紙中心が画面中心に来る', () => {
  const view = fitPaperView(420, 297, 1000, 700);
  const c = paperToScreen({ x: 210, y: 148.5 }, view);
  near(c.x, 500); near(c.y, 350);
});
