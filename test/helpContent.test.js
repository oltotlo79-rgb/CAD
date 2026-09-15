import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HELP_CATEGORIES, HELP_TOPICS } from '../src/helpContent.js';

const TOOL_IDS = [
  'select', 'line', 'polyline', 'rect', 'circle', 'arc', 'ellipse', 'earc', 'spline', 'text', 'thread',
  'dim', 'dia', 'rad', 'angle', 'chamfer', 'leader', 'roughness', 'fcf', 'hatch', 'balloon', 'bom',
  'trim', 'extend', 'offset', 'fillet', 'chamferEdit', 'mirror45', 'origin',
];

const count = (s, re) => (s.match(re) || []).length;

test('トピックIDは重複しない', () => {
  const ids = HELP_TOPICS.map((t) => t.id);
  assert.equal(new Set(ids).size, ids.length);
});

test('カテゴリの対応: 全トピックのカテゴリが存在し、全カテゴリにトピックがある', () => {
  const catIds = new Set(HELP_CATEGORIES.map((c) => c.id));
  for (const t of HELP_TOPICS) assert.ok(catIds.has(t.category), `${t.id}: ${t.category}`);
  for (const c of HELP_CATEGORIES) {
    assert.ok(HELP_TOPICS.some((t) => t.category === c.id), `空のカテゴリ: ${c.id}`);
  }
});

test('全ツールIDがどれかのトピックの tools に含まれる', () => {
  const covered = new Set(HELP_TOPICS.flatMap((t) => t.tools));
  for (const id of TOOL_IDS) assert.ok(covered.has(id), `未説明のツール: ${id}`);
});

test('#help: リンクの行き先がすべて存在する', () => {
  const ids = new Set(HELP_TOPICS.map((t) => t.id));
  for (const t of HELP_TOPICS) {
    for (const m of t.html.matchAll(/#help:([\w-]+)/g)) {
      assert.ok(ids.has(m[1]), `${t.id} → ${m[1]}`);
    }
  }
});

test('HTMLに script やイベント属性を含まない', () => {
  for (const t of HELP_TOPICS) {
    assert.ok(!/<script/i.test(t.html), t.id);
    assert.ok(!/\son[a-z]+\s*=/i.test(t.html), t.id);
  }
});

test('各トピックに title / html / keywords / tools がある', () => {
  for (const t of HELP_TOPICS) {
    assert.ok(t.title && t.title.trim(), t.id);
    assert.ok(t.html && t.html.trim(), t.id);
    assert.ok(Array.isArray(t.keywords) && t.keywords.length > 0, t.id);
    assert.ok(Array.isArray(t.tools), t.id);
  }
});

test('8割以上のトピックに図があり、svg の開始と終了の数が合う', () => {
  const withSvg = HELP_TOPICS.filter((t) => t.html.includes('<svg'));
  assert.ok(withSvg.length / HELP_TOPICS.length >= 0.8, `${withSvg.length}/${HELP_TOPICS.length}`);
  for (const t of HELP_TOPICS) {
    assert.equal(count(t.html, /<svg/g), count(t.html, /<\/svg>/g), t.id);
    assert.equal(count(t.html, /<svg/g), count(t.html, /role="img"/g), t.id);
  }
});

test('SVG内の数値に NaN / undefined が混ざらない', () => {
  for (const t of HELP_TOPICS) {
    assert.ok(!/NaN|undefined/.test(t.html), t.id);
  }
});
