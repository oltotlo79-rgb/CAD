import { build } from 'esbuild';
import { readFile, writeFile, mkdir } from 'node:fs/promises';

const readable = process.argv.includes('--readable');
const outputPath = readable ? 'dist/seizu.readable.html' : 'dist/seizu.html';

const result = await build({
  entryPoints: ['src/app.js'],
  bundle: true,
  minify: !readable,
  charset: readable ? 'utf8' : 'ascii',
  format: 'iife',
  write: false,
});
const js = result.outputFiles[0].text;
const css = await readFile('www/styles.css', 'utf8');
let html = await readFile('www/index.html', 'utf8');

html = html
  .replace(/<link rel="stylesheet"[^>]*>/, () => `<style>\n${css}\n</style>`)
  .replace(/<script[^>]*src=[^>]*><\/script>/, () => `<script>\n${js}\n</script>`);

await mkdir('dist', { recursive: true });
await writeFile(outputPath, html);
console.log(`${outputPath} generated (${(html.length / 1024).toFixed(0)} KB)`);
