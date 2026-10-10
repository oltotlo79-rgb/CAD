import { build } from 'esbuild';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { HELP_SCREENSHOTS } from './src/helpScreenshots.js';
import { escapeInlineScript, minifyBundle } from './scripts/dist-js.mjs';

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
// 1回だけ束ねた(bundle)JavaScriptを非圧縮版にそのまま使い、圧縮版はそれを圧縮して作る。
// 2つの配布物は必ず同時に作り直すので、片方だけ古くなることもない。
const result = await build({
  entryPoints: ['src/app.js'], bundle: true, minify: false, charset: 'utf8',
  format: 'iife', write: false, plugins: [screenshotPlugin],
});
const readableJs = result.outputFiles[0].text;
const outputs = [
  ['dist/seizu.html', await minifyBundle(readableJs)],
  ['dist/seizu.readable.html', readableJs],
];
for (const [outputPath, js] of outputs) {
  const html = template.replace(/<script[^>]*src=[^>]*><\/script>/,
    () => `<script>\n${escapeInlineScript(js)}\n</script>`);
  await writeFile(outputPath, html);
  console.log(`${outputPath} generated (${(Buffer.byteLength(html) / 1024).toFixed(0)} KB)`);
}
