import { build } from 'esbuild';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { HELP_SCREENSHOTS } from './src/helpScreenshots.js';

const readable = process.argv.includes('--readable');
const css = await readFile('www/styles.css', 'utf8');
const template = (await readFile('www/index.html', 'utf8'))
  .replace(/<link rel="stylesheet"[^>]*>/, () => `<style>\n${css}\n</style>`);
const inlineShots = {};
for (const [key, shot] of Object.entries(HELP_SCREENSHOTS)) {
  const png = await readFile(`www/${shot.src}`);
  inlineShots[key] = { ...shot, src: `data:image/png;base64,${png.toString('base64')}` };
}
const screenshotPlugin = {
  name: 'inline-help-screenshots',
  setup(builder) {
    builder.onLoad({ filter: /[\\/]helpScreenshots\.js$/ }, () => ({
      contents: `export const HELP_SCREENSHOTS = ${JSON.stringify(inlineShots)};`, loader: 'js',
    }));
  },
};

await mkdir('dist', { recursive: true });
// 同じ入力・文字コード・プラグインを使い、JavaScriptのminifyだけを切り替える。
// 通常のbuildでは両方を更新して、配布物の片方が古くなるのを防ぐ。
for (const minify of readable ? [false] : [true, false]) {
  const result = await build({
    entryPoints: ['src/app.js'], bundle: true, minify, charset: 'utf8',
    format: 'iife', write: false, plugins: [screenshotPlugin],
  });
  // HTMLに直接書き込むので、スクリプトを途中で終わらせる `</script` と、
  // 古い仕様でコメント開始とみなされる `<!--` を打ち消す(文字列・正規表現の意味は変わらない)。
  const js = result.outputFiles[0].text
    .replace(/<\/script/gi, '<\\/script')
    .replace(/<!--/g, '<\\!--');
  const html = template.replace(/<script[^>]*src=[^>]*><\/script>/, () => `<script>\n${js}\n</script>`);
  const outputPath = minify ? 'dist/seizu.html' : 'dist/seizu.readable.html';
  await writeFile(outputPath, html);
  console.log(`${outputPath} generated (${(Buffer.byteLength(html) / 1024).toFixed(0)} KB)`);
}
