// 配布HTMLに埋め込む JavaScript の加工。build.mjs と、配布物の検査(テスト・check-html)で共用する。
import { transform } from 'esbuild';

// HTMLに直接書き込むので、スクリプトを途中で終わらせる `</script` と、
// 古い仕様でコメント開始とみなされる `<!--` を打ち消す(文字列・正規表現の意味は変わらない)
// (大文字・小文字はそのまま残す)
export function escapeInlineScript(js) {
  return js.replace(/<\/(script)/gi, '<\\/$1').replace(/<!--/g, '<\\!--');
}

// escapeInlineScript の逆(配布HTMLから取り出したスクリプトを元に戻す)
export function unescapeInlineScript(js) {
  return js.replace(/<\\\/(script)/gi, '</$1').replace(/<\\!--/g, '<!--');
}

// 圧縮版の JavaScript は、非圧縮版の JavaScript をそのまま圧縮して作る。
// こうすると2つの配布物は「圧縮したかどうか」だけが違い、機能・ヘルプ・画像の中身は必ず同じになる
export async function minifyBundle(js) {
  return (await transform(js, { minify: true, charset: 'utf8' })).code;
}

// 配布HTMLの <script> の中身(改行コードは LF にそろえて扱う)
export const INLINE_SCRIPT = /<script>\n([\s\S]*?)\n<\/script>/;
