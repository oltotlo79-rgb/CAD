import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  TOOL_INFO, toolForKey, tooltipText, guideFor, toolAccepts,
} from '../src/toolInfo.js';

const ALL_TOOLS = [
  'select', 'line', 'polyline', 'rect', 'circle', 'arc', 'ellipse', 'earc', 'spline', 'text',
  'thread', 'dim', 'dia', 'rad', 'angle', 'chamfer', 'leader', 'roughness', 'fcf', 'hatch',
  'balloon', 'bom', 'trim', 'extend', 'offset', 'fillet', 'chamferEdit', 'mirror45', 'origin',
];

test('TOOL_INFO: 全ツールに名前と説明がある', () => {
  for (const tool of ALL_TOOLS) {
    assert.ok(TOOL_INFO[tool]?.label, `${tool} の名前`);
    assert.ok(TOOL_INFO[tool]?.tip, `${tool} の説明`);
  }
});

test('ショートカットキー: 1文字キーは重複せず、大文字小文字どちらでも効く', () => {
  const keys = Object.values(TOOL_INFO).map((i) => i.key).filter((k) => k && k.length === 1);
  assert.equal(new Set(keys).size, keys.length);
  assert.equal(toolForKey('l'), 'line');
  assert.equal(toolForKey('L'), 'line');
  assert.equal(toolForKey('d'), 'dim');
  assert.equal(toolForKey('x'), 'trim');
  assert.equal(toolForKey('q'), null);
  assert.equal(toolForKey('Enter'), null);
});

test('tooltipText: 名前・キー・説明をまとめる', () => {
  const t = tooltipText('line');
  assert.match(t, /直線/);
  assert.match(t, /\(L\)/);
  assert.match(t, /クリック/);
  assert.equal(tooltipText('nope'), '');
});

test('guideFor: 作図の段階ごとに次に何をするかを返す', () => {
  for (const tool of ALL_TOOLS.filter((t) => t !== 'select')) {
    assert.ok(guideFor(tool, 0), `${tool} の案内`);
  }
  assert.match(guideFor('line', 0), /始点/);
  assert.match(guideFor('line', 1), /終点/);
  assert.match(guideFor('arc', 2), /終わり/);
  assert.equal(guideFor('arc', 9), guideFor('arc', 2)); // 段階が進みすぎたら最後の案内
  assert.equal(guideFor('select', 0), null);
});

test('toolAccepts: そのツールでクリックできる図形だけを対象にする(マウスを乗せた時の強調用)', () => {
  const line = { type: 'line' };
  const circle = { type: 'circle', cx: 0, cy: 0, r: 5 };
  const arc = { type: 'arc' };
  const openPoly = { type: 'polyline', points: [[0, 0], [1, 0], [1, 1]], closed: false };
  const closedPoly = { ...openPoly, closed: true };
  assert.ok(toolAccepts('select', { type: 'dim' }));
  assert.ok(toolAccepts('trim', line) && !toolAccepts('trim', circle));
  assert.ok(toolAccepts('offset', circle) && !toolAccepts('offset', { type: 'text' }));
  assert.ok(toolAccepts('dia', arc) && !toolAccepts('dia', line));
  assert.ok(toolAccepts('hatch', closedPoly) && !toolAccepts('hatch', openPoly));
  assert.ok(!toolAccepts('line', line)); // 作図ツールでは強調しない
});
