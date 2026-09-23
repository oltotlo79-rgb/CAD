import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toSVG } from '../src/svgExport.js';
import { createDocument, addEntity } from '../src/model.js';

function makeDoc() {
  const doc = createDocument(); // A4横
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
  assert.match(svg, /width="297mm" height="210mm"/);
  assert.match(svg, /viewBox="0 0 297 210"/);
});

test('外形線は0.5mm、かくれ線は破線で出力される', () => {
  const svg = toSVG(makeDoc());
  assert.match(svg, /stroke-width="0.5"/);
  assert.match(svg, /stroke-dasharray="3 1.5"/);
});

test('印刷OFFレイヤー(aux)の要素は含まれない', () => {
  const svg = toSVG(makeDoc());
  // aux上の線は y=20 → SVG y = 210-20 = 190
  assert.ok(!svg.includes('y1="190"'), 'aux線が含まれている');
});

test('円・円弧・エスケープ済み文字が含まれる', () => {
  const svg = toSVG(makeDoc());
  assert.match(svg, /<circle cx="50" cy="160" r="20"/);
  assert.match(svg, /<path d="M 160 160 A 10 10 0 0 0 150 150"/);
  assert.match(svg, /注記&lt;&gt;&amp;/);
});

test('縮尺1:2では図形座標が半分・線幅は用紙mmのまま', () => {
  const doc = makeDoc();
  doc.scale.ratio = [1, 2];
  const svg = toSVG(doc);
  assert.match(svg, /<circle cx="25" cy="185" r="10"/);
  assert.match(svg, /stroke-width="0.5"/);
});

test('線の太さを変えた図形は stroke-width に反映される', () => {
  const doc = createDocument();
  addEntity(doc, { type: 'line', x1: 0, y1: 100, x2: 50, y2: 100, widthMm: 0.7 });
  addEntity(doc, { type: 'circle', cx: 50, cy: 50, r: 20, lineType: 'thin', widthMm: 1 });
  const svg = toSVG(doc);
  assert.match(svg, /<line x1="0" y1="110" x2="50" y2="110" stroke="black" stroke-width="0.7"/);
  assert.match(svg, /<circle cx="50" cy="160" r="20" stroke="black" stroke-width="1"/);
});

test('寸法: 既定は細線0.25・文字3.5、変更した太さ・文字高さを反映する', () => {
  const lineWidths = (svg) => [...new Set(
    [...svg.matchAll(/<line [^>]*stroke-width="([\d.]+)"/g)].map((m) => m[1]),
  )];
  const doc = createDocument();
  const dim = addEntity(doc, {
    type: 'dim', dimType: 'linear', orient: 'h', p1: [0, 0], p2: [100, 0], offset: 20,
    override: null, layer: 'dim', lineType: 'thin',
  });
  const plain = toSVG(doc);
  assert.deepEqual(lineWidths(plain), ['0.25']);
  assert.match(plain, /font-size="3.5"[^>]*>100</);
  dim.widthMm = 0.35;
  dim.textMm = 5;
  const styled = toSVG(doc);
  assert.deepEqual(lineWidths(styled), ['0.35']);
  assert.match(styled, /font-size="5"[^>]*>100</);
});

test('ハッチ・部品表・バルーンも太さと文字高さの変更が出力に反映される', () => {
  const doc = createDocument();
  addEntity(doc, {
    type: 'hatch', boundary: { kind: 'rect', x: 0, y: 0, width: 20, height: 20 },
    angleDeg: 45, spacingMm: 3, layer: 'outline', lineType: 'thin', widthMm: 0.13,
  });
  addEntity(doc, {
    type: 'bom', x: 200, y: 100, rows: [{ no: '1', name: 'ベース', qty: '1', material: 'SS400' }],
    layer: 'note', lineType: 'thin', textMm: 5,
  });
  addEntity(doc, {
    type: 'balloon', number: 7, at: [100, 100], pos: [120, 120], layer: 'note', lineType: 'thin', textMm: 7,
  });
  const svg = toSVG(doc);
  assert.match(svg, /<line [^>]*stroke-width="0.13"/);   // ハッチ線
  assert.match(svg, /<line [^>]*stroke-width="0.35"/);   // 部品表の罫線(既定)
  assert.match(svg, /font-size="5"[^>]*>ベース</);       // 部品表の文字
  assert.match(svg, /font-size="7"[^>]*>7</);            // バルーン番号
  assert.match(svg, /<circle [^>]*r="8"/);               // バルーン円も文字に比例
});

test('表題欄のラベルとbind値が出力される', () => {
  const svg = toSVG(makeDoc());
  assert.match(svg, />図番</);
  assert.match(svg, />1:1</);
});
