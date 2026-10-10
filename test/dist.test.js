import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  escapeInlineScript, unescapeInlineScript, minifyBundle, INLINE_SCRIPT,
} from '../scripts/dist-js.mjs';

// 取り出した側のPCの改行コード(CRLF)に左右されないよう LF にそろえて比べる
const read = (name) => readFileSync(new URL(`../dist/${name}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');

test('埋め込み用の打ち消しは元に戻せる', () => {
  const js = 'const a = "</script>"; const b = `<!--x-->`; // </SCRIPT';
  const escaped = escapeInlineScript(js);
  assert.ok(!/<\/script/i.test(escaped) && !escaped.includes('<!--'));
  assert.equal(unescapeInlineScript(escaped), js);
});

test('配布HTML: 圧縮版と非圧縮版は JavaScript の圧縮の有無だけが違い、中身は同じ', async () => {
  const minified = read('seizu.html');
  const readable = read('seizu.readable.html');
  // JavaScript 以外(HTML・CSS)は1文字も違わない
  const blank = (html) => html.replace(INLINE_SCRIPT, '<script></script>');
  assert.equal(blank(minified), blank(readable));
  // 圧縮版の JavaScript(機能・ヘルプの本文・画像を含む)は、非圧縮版をそのまま圧縮したもの
  const readableJs = unescapeInlineScript(readable.match(INLINE_SCRIPT)[1]);
  const expected = escapeInlineScript(await minifyBundle(readableJs));
  assert.equal(minified.match(INLINE_SCRIPT)[1].trimEnd(), expected.trimEnd());
  assert.ok(minified.length < readable.length);
});
