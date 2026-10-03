import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HELP_CATEGORIES, HELP_TOPICS } from '../src/helpContent.js';
import { HELP_DETAILS } from '../src/helpDetails.js';
import { HELP_SCREENSHOTS } from '../src/helpScreenshots.js';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

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

test('全項目に操作場所・具体例・結果・対処と2図以上の実画面がある', () => {
  for (const topic of HELP_TOPICS) {
    const detail=HELP_DETAILS[topic.id];
    for (const key of ['path','example','result','trouble']) assert.ok(detail[key]?.trim(),`${topic.id}: ${key}`);
    assert.ok(count(topic.html, /<figure/g)>=2,topic.id);
    assert.equal(count(topic.html, /<figure/g), count(topic.html, /<image href="help\/screenshots\//g),topic.id);
    assert.ok(!topic.html.includes('<!--help-figure'),topic.id);
  }
});

test('実画面画像の寸法と注釈位置がSVGの座標系に一致する', () => {
  for (const [key,shot] of Object.entries(HELP_SCREENSHOTS)) {
    const image=readFileSync(new URL(`../www/${shot.src}`,import.meta.url));
    assert.equal(image.subarray(1,4).toString(),'PNG',key);
    assert.equal(image.readUInt32BE(16),shot.width,key);
    assert.equal(image.readUInt32BE(20),shot.height,key);
    for (const mark of shot.marks) {
      assert.ok(mark.x>=0 && mark.x<=shot.width && mark.y>=0 && mark.y<=shot.height,key);
      assert.ok(mark.x+mark.dx-12>=0 && mark.x+mark.dx+12<=shot.width,key);
      assert.ok(mark.y+mark.dy-12>=0 && mark.y+mark.dy+12<=shot.height,key);
    }
  }
});

test('画面・描画のソースが変わったらヘルプの実画面を撮り直す', () => {
  const provenance=JSON.parse(readFileSync(new URL('../www/help/screenshots/provenance.json',import.meta.url),'utf8'));
  for (const [file,expected] of Object.entries(provenance.sourceHashes)) {
    const actual=createHash('sha256').update(readFileSync(new URL(`../${file}`,import.meta.url),'utf8').replace(/\r\n/g,'\n')).digest('hex');
    assert.equal(actual,expected,`${file}: npm run help:capture で図を更新してください`);
  }
});
