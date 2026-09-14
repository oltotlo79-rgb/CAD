import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bomLayout, bomRowsFromBalloons, BOM_COLS, BOM_ROW_H_MM } from '../src/bom.js';
import { balloonLayout } from '../src/dims.js';

test('bomLayout: ヘッダ+行数分の高さ、列幅合計の幅', () => {
  const e = { type: 'bom', x: 100, y: 50, rows: [{ no: '1' }, { no: '2' }] };
  const l = bomLayout(e, 1);
  assert.equal(l.rect.height, BOM_ROW_H_MM * 3);
  assert.equal(l.rect.width, BOM_COLS.reduce((a, c) => a + c.widthMm, 0));
  assert.equal(l.headers[0].text, '品番');
  // 1行目(品番1)はヘッダのすぐ下
  const c0 = l.cells.find((c) => c.rowIndex === 0 && c.field === 'no');
  assert.equal(c0.text, '1');
  assert.equal(c0.rect.y, 50 + BOM_ROW_H_MM);
});

test('bomLayout: 縮尺1:2では表が実寸で2倍(用紙上は同じ大きさ)', () => {
  const e = { type: 'bom', x: 0, y: 0, rows: [{}] };
  assert.equal(bomLayout(e, 0.5).rect.height, BOM_ROW_H_MM * 2 * 2);
});

test('bomLayout: 文字高さ textMm に比例して表全体が大きくなる', () => {
  const e = { type: 'bom', x: 0, y: 0, rows: [{}] };
  const base = bomLayout(e, 1);
  const big = bomLayout({ ...e, textMm: 7 }, 1); // 既定3.5の2倍
  assert.equal(base.textMm, 3.5);
  assert.equal(big.textMm, 7);
  assert.equal(big.rect.height, base.rect.height * 2);
  assert.equal(big.rect.width, base.rect.width * 2);
});

test('bomLayout: texts はヘッダ・セルの文字をセル内の左詰め(余白も文字に比例)で並べる', () => {
  const e = { type: 'bom', x: 0, y: 0, rows: [{ no: '1', name: '軸' }], textMm: 7 };
  const l = bomLayout(e, 1);
  assert.equal(l.texts.length, l.headers.length + l.cells.length);
  const name = l.cells.find((c) => c.field === 'name');
  const t = l.texts.find((tx) => tx.content === '軸');
  assert.equal(t.x, name.rect.x + 3); // 余白1.5mm×2
  assert.ok(Math.abs(t.y - (name.rect.y + name.rect.height / 2 - 7 * 0.35)) < 1e-9);
  assert.equal(t.align, 'left');
});

test('bomRowsFromBalloons: バルーン番号から行を生成(重複なし昇順)', () => {
  const rows = bomRowsFromBalloons([
    { type: 'balloon', number: 3 }, { type: 'balloon', number: 1 },
    { type: 'balloon', number: 3 }, { type: 'line' },
  ]);
  assert.deepEqual(rows.map((r) => r.no), ['1', '3']);
});

test('bomRowsFromBalloons: バルーンが無ければ空の3行', () => {
  assert.equal(bomRowsFromBalloons([]).length, 3);
});

test('balloonLayout: 円・番号・対象への矢印', () => {
  const e = { type: 'balloon', number: 5, at: [0, 0], pos: [30, 0] };
  const l = balloonLayout(e, 1);
  assert.deepEqual(l.circle.c, { x: 30, y: 0 });
  assert.equal(l.circle.r, 4);
  assert.deepEqual(l.lines[0][0], { x: 26, y: 0 }); // 円の縁から
  assert.deepEqual(l.arrows[0].at, { x: 0, y: 0 });
  assert.equal(l.texts[0].content, '5');
});
