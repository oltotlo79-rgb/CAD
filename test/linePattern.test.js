import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createDocument, addEntity, DEFAULT_DASH_PATTERNS, dashArrayMm, parseDashValue,
} from '../src/model.js';
import { serialize, deserialize } from '../src/serializer.js';
import { toSVG } from '../src/svgExport.js';

test('標準の間隔はこれまでの見た目と同じ', () => {
  assert.deepEqual(dashArrayMm('dashed'), [3, 1.5]);
  assert.deepEqual(dashArrayMm('chain'), [8, 1.5, 1.5, 1.5]);
  assert.deepEqual(dashArrayMm('chain2'), [8, 1.5, 1.5, 1.5, 1.5, 1.5]);
  assert.deepEqual(dashArrayMm('solid'), []);
  assert.deepEqual(dashArrayMm('thin'), []);
  assert.deepEqual(createDocument().dashPatterns, DEFAULT_DASH_PATTERNS);
  assert.notEqual(createDocument().dashPatterns, DEFAULT_DASH_PATTERNS); // 図面ごとに別のコピー
});

test('図面ごとに、線の長さ・隙間・短い線の長さを変えられる', () => {
  const patterns = {
    dashed: { dash: 4, gap: 1 },
    chain: { dash: 12, gap: 2, dot: 0.5 },
    chain2: { dash: 15, gap: 1, dot: 1 },
  };
  assert.deepEqual(dashArrayMm('dashed', patterns), [4, 1]);
  assert.deepEqual(dashArrayMm('chain', patterns), [12, 2, 0.5, 2]);
  assert.deepEqual(dashArrayMm('chain2', patterns), [15, 1, 1, 1, 1, 1]);
});

test('間隔の入力: 0より大きく50mm以下の数だけを受け付ける(全角も可)', () => {
  assert.equal(parseDashValue('2.5'), 2.5);
  assert.equal(parseDashValue('１２'), 12);
  for (const bad of ['0', '-1', '', 'abc', '51']) assert.equal(parseDashValue(bad), null, bad);
});

test('間隔は図面と一緒に保存され、古いファイルは標準の間隔で開く', () => {
  const doc = createDocument();
  doc.dashPatterns.chain.dash = 12;
  const loaded = deserialize(serialize(doc));
  assert.equal(loaded.dashPatterns.chain.dash, 12);
  const old = JSON.parse(serialize(createDocument()));
  delete old.dashPatterns;
  assert.deepEqual(deserialize(JSON.stringify(old)).dashPatterns, DEFAULT_DASH_PATTERNS);
  // 一部だけ書かれていても足りない所は標準で補う
  old.dashPatterns = { dashed: { dash: 5 } };
  const partial = deserialize(JSON.stringify(old)).dashPatterns;
  assert.deepEqual(partial.dashed, { dash: 5, gap: 1.5 });
  assert.deepEqual(partial.chain, DEFAULT_DASH_PATTERNS.chain);
});

test('SVG出力(印刷)も図面の間隔で破線を書く', () => {
  const doc = createDocument();
  doc.dashPatterns.dashed = { dash: 4, gap: 1 };
  addEntity(doc, { type: 'line', x1: 10, y1: 10, x2: 50, y2: 10, lineType: 'dashed', layer: 'hidden' });
  assert.match(toSVG(doc), /stroke-dasharray="4 1"/);
});
