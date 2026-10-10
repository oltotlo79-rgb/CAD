import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildContextMenu } from '../src/menuModel.js';

const ids = (items) => items.filter((i) => !i.separator).map((i) => i.id);
const find = (items, id) => items.find((i) => i.id === id);

test('何もない所の右クリック: 貼り付け・元に戻す・すべて選択・全体表示・ヘルプ', () => {
  const items = buildContextMenu({ entities: [], hasClipboard: false, tool: 'select' });
  assert.deepEqual(ids(items), ['paste', 'undo', 'redo', 'selectAll', 'fit', 'help']);
  assert.equal(find(items, 'paste').disabled, true); // コピーしていなければ押せない
  const inTool = buildContextMenu({ entities: [], hasClipboard: true, tool: 'line' });
  assert.ok(ids(inTool).includes('toSelect'));
  assert.equal(find(inTool, 'paste').disabled, false);
});

test('直線の右クリック: 編集項目と線種・太さ(文字の大きさは出ない)', () => {
  const items = buildContextMenu({
    entities: [{ type: 'line', lineType: 'solid', layer: 'outline' }], hasClipboard: false, tool: 'select',
  });
  const list = ids(items);
  for (const id of ['copy', 'paste', 'duplicate', 'delete', 'rotateLeft', 'rotateRight', 'rotateBy',
    'scaleBy', 'mirrorX', 'mirrorY', 'lineType', 'width', 'help']) {
    assert.ok(list.includes(id), id);
  }
  assert.ok(!list.includes('textSize') && !list.includes('explode') && !list.includes('editText'));
  const lineType = find(items, 'lineType');
  assert.equal(lineType.children.length, 6);
  assert.equal(lineType.children.find((c) => c.id === 'lineType:outline').checked, true);
  const width = find(items, 'width');
  assert.equal(width.children[0].id, 'width:');       // 標準
  assert.equal(width.children[0].checked, true);
});

test('矩形は「分解」、文字は「文字の大きさ」と「書き換え」が出る', () => {
  const rect = buildContextMenu({ entities: [{ type: 'rect', lineType: 'solid', layer: 'outline' }], tool: 'select' });
  assert.ok(ids(rect).includes('explode'));
  const text = buildContextMenu({ entities: [{ type: 'text', height: 5, content: 'a' }], tool: 'select' });
  assert.ok(ids(text).includes('textSize') && ids(text).includes('editText'));
  assert.ok(!ids(text).includes('lineType') && !ids(text).includes('width'));
  assert.equal(find(text, 'textSize').children.find((c) => c.id === 'textSize:5').checked, true);
});

test('値を動かした長さ寸法は「寸法の値を中央に戻す」が出る', () => {
  const dim = { type: 'dim', dimType: 'linear', orient: 'h', p1: [0, 0], p2: [10, 0], offset: 5 };
  assert.ok(!ids(buildContextMenu({ entities: [dim], tool: 'select' })).includes('resetDimText'));
  assert.ok(ids(buildContextMenu({ entities: [{ ...dim, textShift: 3 }], tool: 'select' })).includes('resetDimText'));
});

test('複数選択では「書き換え」は出さず、値が違えばチェックも付けない', () => {
  const items = buildContextMenu({
    entities: [
      { type: 'text', height: 5, content: 'a' },
      { type: 'text', height: 7, content: 'b' },
    ],
    tool: 'select',
  });
  assert.ok(!ids(items).includes('editText'));
  assert.ok(find(items, 'textSize').children.every((c) => !c.checked));
});

test('連続線を描いている途中は「作図を終える」「作図をやめる」が先頭に出る', () => {
  const items = buildContextMenu({ entities: [], tool: 'polyline', drafting: 'polyline' });
  assert.deepEqual(ids(items).slice(0, 2), ['finishDraft', 'cancelDraft']);
  const line = buildContextMenu({ entities: [], tool: 'line', drafting: 'line' });
  assert.deepEqual(ids(line).slice(0, 1), ['cancelDraft']);
});

test('ねじ穴などのグループ・正多角形(閉じた連続線)を選ぶと「分解」が出る', () => {
  const group = [
    { type: 'circle', group: 1, lineType: 'solid', layer: 'outline' },
    { type: 'line', group: 1, lineType: 'chain', layer: 'center' },
  ];
  assert.ok(ids(buildContextMenu({ entities: group, tool: 'select' })).includes('explode'));
  const poly = { type: 'polyline', closed: true, points: [[0, 0], [1, 0], [0, 1]], lineType: 'solid', layer: 'outline' };
  assert.ok(ids(buildContextMenu({ entities: [poly], tool: 'select' })).includes('explode'));
  const circle = { type: 'circle', lineType: 'solid', layer: 'outline' };
  assert.ok(!ids(buildContextMenu({ entities: [circle], tool: 'select' })).includes('explode'));
});
