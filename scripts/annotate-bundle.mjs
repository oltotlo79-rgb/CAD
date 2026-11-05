// 非圧縮版(dist/seizu.readable.html)の JavaScript に、元のソース(src/*.js)の説明コメントを戻す。
// esbuild は束ねるときにコメントを消すので、束ねた後に、ソースのコメントを同じコードの行の前へ差し込む。
// 差し込むのはコメントだけ。コメントを除いて圧縮した結果が元と同じであることを確かめ、
// 万一コードの中身(文字列など)に入り込んだ差し込みがあれば、その差し込みだけを取りやめる。
import { readFileSync } from 'node:fs';
import { transform } from 'esbuild';

const MARKER = /^ {2}\/\/ src\/([\w-]+)\.js$/; // esbuild が各ファイルの始まりに付ける印

// 比べるために、行を「書き方の違い」をならした形にする(空白・引用符・宣言の種類・export の有無)。
// 束ねると、ほかのファイルと名前がぶつかる変数に番号が付く(ctx → ctx2)ので、名前の末尾の数字も無視する
function norm(code) {
  return code.trim()
    .replace(/^export\s+(default\s+)?/, '')
    .replace(/^(const|let|var)\s/, 'var ')
    .replace(/'/g, '"')
    .replace(/\b([A-Za-z_$][A-Za-z_$]*)\d+\b/g, '$1')
    .replace(/\s+/g, '')
    .replace(/[;,]+$/, '');
}

// 行の後ろに付いた「// 説明」を取り出す。文字列の中の // は説明ではないので、引用符の数で見分ける
function splitTrailing(line) {
  const i = line.indexOf(' // ');
  if (i < 0) return null;
  const code = line.slice(0, i);
  const quotes = (ch) => (code.split(ch).length - 1) % 2 === 0;
  if (!code.trim() || !quotes("'") || !quotes('"') || !quotes('`') || /https?:$/.test(code)) return null;
  return { code: code.trimEnd(), text: line.slice(i + 4).trim() };
}

// ソースの説明コメントを集める。header=ファイル先頭の説明、blocks=[{lines, code}](code の行の前に置く)、
// trailing=[{text, code}](code の行の後ろに付ける)
function sourceComments(source) {
  // 「import * as geo」のような読み込みは、束ねると geo.distance → distance になるので、比べる前に外す
  const spaces = [...source.matchAll(/import\s+\*\s+as\s+(\w+)/g)].map((m) => m[1]);
  const plain = (code) => spaces.reduce((c, n) => c.replace(new RegExp(`\\b${n}\\.`, 'g'), ''), code);
  const lines = source.replace(/\r\n/g, '\n').split('\n').map((l) => {
    const t = l.trim();
    return t.startsWith('//') ? l : plain(l);
  });
  const header = [];
  let i = 0;
  while (i < lines.length && lines[i].trim().startsWith('//')) header.push(lines[i++].trim().replace(/^\/\/\s?/, ''));
  const blocks = [];
  const trailing = [];
  for (; i < lines.length; i++) {
    const t = lines[i].trim();
    if (t.startsWith('//')) {
      const block = [];
      while (i < lines.length && lines[i].trim().startsWith('//')) block.push(lines[i++].trim().replace(/^\/\/\s?/, ''));
      while (i < lines.length && lines[i].trim() === '') i++;
      if (i < lines.length && !/^\s*(import|\})/.test(lines[i])) blocks.push({ lines: block, code: lines[i].trim() });
      i--;
      continue;
    }
    const tr = t && splitTrailing(lines[i]);
    if (tr) trailing.push({ text: tr.text, code: tr.code.trim() });
  }
  return { header, blocks, trailing };
}

// 束ねたコード(section の行)の中から、ソースの行 code と同じ行を cursor から先で探す
function findLine(section, code, cursor) {
  const key = norm(code);
  if (key.length < 4) return -1;
  const head = key.slice(0, 60);
  for (let j = cursor; j < section.length; j++) {
    const n = norm(section[j]);
    if (n.length < 4) continue;
    if (n === key || (head.length >= 15 && (n.startsWith(head) || (n.length >= 15 && head.startsWith(n))))) return j;
  }
  // 宣言なら、書き方が変わっていても名前で探す(var NAME = … / function NAME(…)
  const decl = code.match(/^(?:export\s+)?(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=|^(?:export\s+)?(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(/);
  if (decl) {
    const name = (decl[1] ?? decl[2]).replace(/\d+$/, '');
    const re = new RegExp(`^\\s*(?:var|let|const|async function|function)\\s+${name.replace(/\$/g, '\\$')}\\d*\\s*[=(]`);
    for (let j = cursor; j < section.length; j++) if (re.test(section[j])) return j;
  }
  return -1;
}

// 差し込み案を作る: [{ at: 行番号, kind: 'before'|'after-marker'|'trailing', lines }]
function plan(bundleLines, srcDir) {
  const edits = [];
  const sections = [];
  bundleLines.forEach((line, i) => {
    const m = line.match(MARKER);
    if (m) sections.push({ file: m[1], start: i });
  });
  sections.forEach((s, k) => { s.end = k + 1 < sections.length ? sections[k + 1].start : bundleLines.length; });
  const headers = [];
  for (const s of sections) {
    let source;
    try { source = readFileSync(`${srcDir}/${s.file}.js`, 'utf8'); } catch { continue; }
    const { header, blocks, trailing } = sourceComments(source);
    headers.push({ file: s.file, header });
    if (header.length) edits.push({ at: s.start, kind: 'after-marker', lines: header });
    const section = bundleLines.slice(s.start + 1, s.end);
    let cursor = 0;
    for (const b of blocks) {
      const j = findLine(section, b.code, cursor);
      if (j < 0) continue;
      edits.push({ at: s.start + 1 + j, kind: 'before', lines: b.lines });
      cursor = j;
    }
    cursor = 0;
    for (const t of trailing) {
      const j = findLine(section, t.code, cursor);
      if (j < 0) continue;
      edits.push({ at: s.start + 1 + j, kind: 'trailing', lines: [t.text] });
      cursor = j + 1;
    }
  }
  return { edits, headers };
}

// esbuild が残したコメント(オブジェクトの中の説明など)と同じものは、近くにあれば足さない
function alreadyThere(bundleLines, at, text) {
  for (let j = Math.max(0, at - 3); j <= Math.min(bundleLines.length - 1, at + 3); j++) {
    if (bundleLines[j].includes(`// ${text}`)) return true;
  }
  return false;
}

function apply(bundleLines, edits) {
  const before = new Map();
  const after = new Map();
  const tail = new Map();
  for (const e of edits) {
    if (e.kind !== 'after-marker' && e.lines.every((t) => alreadyThere(bundleLines, e.at, t))) continue;
    const map = e.kind === 'before' ? before : e.kind === 'after-marker' ? after : tail;
    if (!map.has(e.at)) map.set(e.at, []);
    map.get(e.at).push(...e.lines);
  }
  const out = [];
  bundleLines.forEach((line, i) => {
    const indent = line.match(/^\s*/)[0];
    for (const t of before.get(i) ?? []) out.push(`${indent}// ${t}`.trimEnd());
    out.push(tail.has(i) ? `${line} // ${tail.get(i).join(' / ')}` : line);
    for (const t of after.get(i) ?? []) out.push(`${indent}// ${t}`.trimEnd());
  });
  return out.join('\n');
}

const stripped = async (js) => (await transform(js, { minify: true, charset: 'utf8', legalComments: 'none' })).code;

// ファイル全体の見出し(圧縮版にも残る「/*! */」の説明)
function overview(headers) {
  // 各ファイルの先頭の説明(複数行は1つの文につなぐ)
  const list = headers.map(({ file, header }) => ` *   ${file}.js — ${header.join('').replace(/\*\//g, '* /')}`);
  return [
    '/*!',
    ' * 製図ツール(seizu-tool) — Excel感覚で使える2Dの製図ツール。このHTMLファイル1つで動きます。',
    ' *',
    ' * このファイルの中身',
    ' *   - 画面の部品(ボタン・タブ・入力欄・キャンバス)… HTML の部分(<body> の中)',
    ' *   - 見た目(色・並べ方)… <style> の部分',
    ' *   - 動き(作図・編集・寸法・保存・印刷・ヘルプ)… この JavaScript の部分',
    ' *   - ヘルプの図(実際の画面の写真)… JavaScript の中に画像データとして埋め込み済み',
    ' *',
    ' * dist/seizu.html(圧縮版)と dist/seizu.readable.html(非圧縮版)は、同じ JavaScript から作り、',
    ' * 違いは「圧縮したかどうか」だけです(圧縮版は名前を短くし、改行と説明のコメントを除いています)。',
    ' * 元のソースは src/*.js、画面は www/index.html、見た目は www/styles.css。npm run build で作り直します。',
    ' *',
    ' * JavaScript の部品(ファイル)と役割。下の「// src/○○.js」の印から各ファイルの中身が始まります',
    ...list,
    ' */',
  ].join('\n');
}

export async function annotateBundle(bundle, srcDir) {
  const lines = bundle.split('\n');
  const { edits, headers } = plan(lines, srcDir);
  const want = await stripped(bundle);
  let kept = edits;
  if (await stripped(apply(lines, kept)) !== want) {
    // コードの中(複数行の文字列など)に入った差し込みを、半分ずつ試して見つけ、取り除く
    const bad = [];
    const search = async (list) => {
      if (list.length === 0) return;
      if (await stripped(apply(lines, list)) === want) return; // この差し込みだけならコードは変わらない
      if (list.length === 1) { bad.push(list[0]); return; }
      const mid = Math.ceil(list.length / 2);
      await search(list.slice(0, mid));
      await search(list.slice(mid));
    };
    await search(kept);
    kept = kept.filter((e) => !bad.includes(e));
    if (await stripped(apply(lines, kept)) !== want) throw new Error('コメントの差し込みでコードが変わってしまう');
  }
  return `${overview(headers)}\n${apply(lines, kept)}`;
}
