import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toSVG } from '../src/svgExport.js';
import { createDocument, addEntity } from '../src/model.js';

function makeDoc() {
  const doc = createDocument(); // A3横
  addEntity(doc, { type: 'line', x1: 0, y1: 0, x2: 100, y2: 0 });
  addEntity(doc, { type: 'line', layer: 'hidden', lineType: 'dashed', x1: 0, y1: 10, x2: 100, y2: 10 });
  addEntity(doc, { type: 'line', layer: 'aux', lineType: 'thin', x1: 0, y1: 20, x2: 100, y2: 20 });
  addEntity(doc, { type: 'circle', cx: 50, cy: 50, r: 20 });
  addEntity(doc, { type: 'arc', cx: 150, cy: 50, r: 10, startAngle: 0, endAngle: 90 });
  addEntity(doc, { type: 'text', x: 10, y: 60, content: '注記<>&', height: 3.5, layer: 'note', lineType: 'thin' });
  return doc;
}

test('用紙実寸mmのSVGヘッダが出る', () => {
  const svg = toSVG(makeDoc());
  assert.match(svg, /width="420mm" height="297mm"/);
  assert.match(svg, /viewBox="0 0 420 297"/);
});

test('外形線は0.5mm、かくれ線は破線で出力される', () => {
  const svg = toSVG(makeDoc());
  assert.match(svg, /stroke-width="0.5"/);
  assert.match(svg, /stroke-dasharray="3 1.5"/);
});

test('印刷OFFレイヤー(aux)の要素は含まれない', () => {
  const svg = toSVG(makeDoc());
  // aux上の線は y=20 → SVG y = 297-20 = 277
  assert.ok(!svg.includes('y1="277"'), 'aux線が含まれている');
});

test('円・円弧・エスケープ済み文字が含まれる', () => {
  const svg = toSVG(makeDoc());
  assert.match(svg, /<circle cx="50" cy="247" r="20"/);
  assert.match(svg, /<path d="M 160 247 A 10 10 0 0 0 150 237"/);
  assert.match(svg, /注記&lt;&gt;&amp;/);
});

test('縮尺1:2では図形座標が半分・線幅は用紙mmのまま', () => {
  const doc = makeDoc();
  doc.scale.ratio = [1, 2];
  const svg = toSVG(doc);
  assert.match(svg, /<circle cx="25" cy="272" r="10"/);
  assert.match(svg, /stroke-width="0.5"/);
});

test('表題欄のラベルとbind値が出力される', () => {
  const svg = toSVG(makeDoc());
  assert.match(svg, />図番</);
  assert.match(svg, />1:1</);
});
