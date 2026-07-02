import { test } from 'node:test';
import assert from 'node:assert/strict';
import { titleBlockLayout, titleFieldText, DEFAULT_TITLE_FIELDS, TITLE_BLOCK_W, TITLE_ROW_H } from '../src/titleBlock.js';
import { createDocument } from '../src/model.js';

test('createDocument に既定の表題欄が入る', () => {
  const doc = createDocument();
  assert.ok(doc.titleBlock);
  assert.equal(doc.titleBlock.fields.length, DEFAULT_TITLE_FIELDS.length);
});

test('bind項目: 尺度・用紙は図面設定から自動反映', () => {
  const doc = createDocument({ paperSize: 'A4', orientation: 'portrait' });
  doc.scale.ratio = [1, 5];
  assert.equal(titleFieldText(doc, { label: '尺度', bind: 'scale' }), '1:5');
  assert.equal(titleFieldText(doc, { label: '用紙', bind: 'paper' }), 'A4 縦');
  assert.equal(titleFieldText(doc, { label: '図番', value: 'ABC-01' }), 'ABC-01');
});

test('レイアウト: 図面枠内側の右下に配置される', () => {
  const doc = createDocument(); // A3横: 420×297、枠は10mm内側
  const tb = titleBlockLayout(doc);
  assert.equal(tb.x, 410 - TITLE_BLOCK_W); // 枠右端410から左へ
  assert.equal(tb.y, 10);                  // 枠下端
  assert.equal(tb.height, TITLE_ROW_H * doc.titleBlock.fields.length);
  // 先頭フィールドが最上段の行になる
  assert.equal(tb.rows[0].rect.y, tb.y + tb.height - TITLE_ROW_H);
  assert.equal(tb.rows[tb.rows.length - 1].rect.y, tb.y);
});

test('titleBlock が無い図面では null', () => {
  const doc = createDocument();
  doc.titleBlock = null;
  assert.equal(titleBlockLayout(doc), null);
});
