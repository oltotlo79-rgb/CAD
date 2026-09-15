import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  strokeWidthMm, widthSettingMm, textHeightMm, hasStroke, hasText,
  applyWidth, applyTextHeight, commonValue, strokeStyleOf,
  WIDTH_CHOICES_MM, TEXT_CHOICES_MM, hasLineType, presetOf, applyPreset,
} from '../src/entityStyle.js';

test('hasLineType: 線種を変えられるのは線・円などの図形だけ', () => {
  for (const type of ['line', 'polyline', 'spline', 'rect', 'circle', 'arc', 'ellipse']) {
    assert.ok(hasLineType({ type }), type);
  }
  for (const type of ['text', 'dim', 'leader', 'hatch', 'balloon', 'bom', 'roughness', 'fcf']) {
    assert.ok(!hasLineType({ type }), type);
  }
});

test('presetOf: 線種とレイヤーから線種メニューの項目を判定する', () => {
  assert.equal(presetOf({ type: 'line', lineType: 'solid', layer: 'outline' }), 'outline');
  assert.equal(presetOf({ type: 'line', lineType: 'dashed', layer: 'hidden' }), 'hidden');
  assert.equal(presetOf({ type: 'circle', lineType: 'thin', layer: 'outline' }), 'thinline');
  assert.equal(presetOf({ type: 'line', lineType: 'thin', layer: 'aux' }), 'aux');
  assert.equal(presetOf({ type: 'arc', lineType: 'chain2', layer: 'outline' }), 'phantom');
  // レイヤーが一致しないデータは線種だけで判定
  assert.equal(presetOf({ type: 'line', lineType: 'chain', layer: 'outline' }), 'center');
  assert.equal(presetOf({ type: 'dim', lineType: 'thin', layer: 'dim' }), null);
});

test('applyPreset: 線種とレイヤーを変え、太さの指定は残す。対象外は変えない', () => {
  const e = { type: 'line', lineType: 'solid', layer: 'outline', widthMm: 0.7 };
  assert.equal(applyPreset(e, 'hidden'), true);
  assert.deepEqual([e.lineType, e.layer, e.widthMm], ['dashed', 'hidden', 0.7]);
  const t = { type: 'text', layer: 'note', lineType: 'thin' };
  assert.equal(applyPreset(t, 'hidden'), false);
  assert.equal(t.layer, 'note');
});

test('strokeWidthMm: 未指定なら線種の既定太さ(外形線0.5/かくれ線0.35/細線0.25)', () => {
  assert.equal(strokeWidthMm({ type: 'line', lineType: 'solid' }), 0.5);
  assert.equal(strokeWidthMm({ type: 'circle', lineType: 'dashed' }), 0.35);
  assert.equal(strokeWidthMm({ type: 'arc', lineType: 'chain' }), 0.25);
  assert.equal(strokeWidthMm({ type: 'rect' }), 0.5); // lineType欠落は外形線扱い
});

test('strokeWidthMm: 寸法・記号・ハッチは0.25、部品表は0.35が既定(線種に依らない)', () => {
  assert.equal(strokeWidthMm({ type: 'dim', dimType: 'linear', lineType: 'thin' }), 0.25);
  assert.equal(strokeWidthMm({ type: 'hatch', lineType: 'thin' }), 0.25);
  assert.equal(strokeWidthMm({ type: 'balloon', lineType: 'solid' }), 0.25);
  assert.equal(strokeWidthMm({ type: 'bom', lineType: 'thin' }), 0.35);
});

test('strokeWidthMm: widthMm があればそれを優先し、不正値は無視する', () => {
  assert.equal(strokeWidthMm({ type: 'line', lineType: 'solid', widthMm: 0.7 }), 0.7);
  assert.equal(strokeWidthMm({ type: 'dim', lineType: 'thin', widthMm: 0.35 }), 0.35);
  assert.equal(strokeWidthMm({ type: 'line', lineType: 'solid', widthMm: 0 }), 0.5);
  assert.equal(strokeWidthMm({ type: 'line', lineType: 'solid', widthMm: null }), 0.5);
  assert.equal(strokeWidthMm({ type: 'line', lineType: 'solid', widthMm: 'abc' }), 0.5);
});

test('widthSettingMm: 要素に指定された太さ、未指定・不正値は null(=標準)', () => {
  assert.equal(widthSettingMm({ type: 'line', widthMm: 0.7 }), 0.7);
  assert.equal(widthSettingMm({ type: 'line', widthMm: '1' }), 1); // 手編集ファイルの文字列も数値に
  assert.equal(widthSettingMm({ type: 'line' }), null);
  assert.equal(widthSettingMm({ type: 'line', widthMm: -1 }), null);
});

test('textHeightMm: 文字はheight、寸法・記号・部品表はtextMm(既定3.5)、図形はnull', () => {
  assert.equal(textHeightMm({ type: 'text', content: 'a', height: 5 }), 5);
  assert.equal(textHeightMm({ type: 'dim', dimType: 'dia', r: 5 }), 3.5);
  assert.equal(textHeightMm({ type: 'leader', points: [], content: 'a', textMm: 2.5 }), 2.5);
  for (const type of ['balloon', 'roughness', 'fcf', 'bom']) {
    assert.equal(textHeightMm({ type, textMm: 7 }), 7, type);
  }
  assert.equal(textHeightMm({ type: 'rect', width: 10, height: 20 }), null);
  assert.equal(textHeightMm({ type: 'hatch' }), null);
});

test('hasStroke / hasText: 線を持つ要素・文字を持つ要素の判定', () => {
  assert.ok(hasStroke({ type: 'line' }));
  assert.ok(hasStroke({ type: 'dim' }));
  assert.ok(!hasStroke({ type: 'text' }));
  assert.ok(hasText({ type: 'text' }));
  assert.ok(hasText({ type: 'bom' }));
  assert.ok(!hasText({ type: 'circle' }));
});

test('applyWidth: 太さを設定し、null で標準(線種どおり)に戻す', () => {
  const line = { type: 'line', lineType: 'solid' };
  assert.equal(applyWidth(line, 0.7), true);
  assert.equal(line.widthMm, 0.7);
  applyWidth(line, null);
  assert.ok(!('widthMm' in line));
  assert.equal(strokeWidthMm(line), 0.5);
});

test('applyWidth: 線を持たない文字は変更しない', () => {
  const text = { type: 'text', content: 'a', height: 3.5 };
  assert.equal(applyWidth(text, 1), false);
  assert.ok(!('widthMm' in text));
});

test('applyTextHeight: 文字はheight、寸法はtextMmを変える(3.5は既定なので省略)', () => {
  const text = { type: 'text', content: 'a', height: 3.5 };
  assert.equal(applyTextHeight(text, 7), true);
  assert.equal(text.height, 7);
  const dim = { type: 'dim', dimType: 'rad', r: 5 };
  applyTextHeight(dim, 2.5);
  assert.equal(dim.textMm, 2.5);
  applyTextHeight(dim, 3.5);
  assert.ok(!('textMm' in dim));
});

test('applyTextHeight: 矩形などの図形の height(形状の高さ) は変えない', () => {
  const rect = { type: 'rect', x: 0, y: 0, width: 10, height: 20 };
  assert.equal(applyTextHeight(rect, 7), false);
  assert.equal(rect.height, 20);
  assert.ok(!('textMm' in rect));
});

test('commonValue: 全要素が同じ値ならその値、違えば混在、対象なしはnull', () => {
  const get = (e) => e.v;
  assert.deepEqual(commonValue([{ v: 1 }, { v: 1 }], get), { value: 1, mixed: false });
  assert.deepEqual(commonValue([{ v: null }, { v: null }], get), { value: null, mixed: false });
  assert.deepEqual(commonValue([{ v: 1 }, { v: 2 }], get), { value: null, mixed: true });
  assert.equal(commonValue([], get), null);
});

test('strokeStyleOf: 派生図形に引き継ぐ レイヤー・線種・太さ', () => {
  assert.deepEqual(
    strokeStyleOf({ type: 'line', layer: 'hidden', lineType: 'dashed', widthMm: 0.5, x1: 0 }),
    { layer: 'hidden', lineType: 'dashed', widthMm: 0.5 },
  );
  assert.deepEqual(
    strokeStyleOf({ type: 'line', layer: 'outline', lineType: 'solid' }),
    { layer: 'outline', lineType: 'solid' },
  );
});

test('選択肢: JISの系列で昇順、既定値(0.25/0.5・3.5)を含む', () => {
  assert.ok(WIDTH_CHOICES_MM.includes(0.25) && WIDTH_CHOICES_MM.includes(0.5));
  assert.ok(TEXT_CHOICES_MM.includes(3.5));
  const ascending = (a) => a.every((v, i) => i === 0 || a[i - 1] < v);
  assert.ok(ascending(WIDTH_CHOICES_MM) && ascending(TEXT_CHOICES_MM));
});
