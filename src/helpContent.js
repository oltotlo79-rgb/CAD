// アプリ内ヘルプの内容(日本語)。専門用語を避け、図(SVG)付きで全操作を解説する。
// HELP_TOPICS[].tools は F1 キーで「今のツールの説明」を開くときに使う。

// 図の色(ヘルプ画面は白背景)
const C = {
  shape: '#222', mark: '#e8590c', guide: '#0b6bcb', hi: '#5aa9ff',
  grid: '#e3e8ef', label: '#444', sel: '#1c7ed6', btn: '#f6f7f9', btnLine: '#9aa5b1',
};

// ---- SVG 部品 ----
function svg(w, h, label, body) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" role="img" aria-label="${label}" font-family="sans-serif">${body}</svg>`;
}

// 図(figure)1つ分
function fig(w, h, label, body, caption) {
  return `<figure class="help-figure">${svg(w, h, label, body)}<figcaption>${caption}</figcaption></figure>`;
}

// 方眼紙の背景
function grid(x, y, w, h, step = 20) {
  let s = `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#fff"/>`;
  for (let gx = x; gx <= x + w; gx += step) s += `<line x1="${gx}" y1="${y}" x2="${gx}" y2="${y + h}" stroke="${C.grid}" stroke-width="1"/>`;
  for (let gy = y; gy <= y + h; gy += step) s += `<line x1="${x}" y1="${gy}" x2="${x + w}" y2="${gy}" stroke="${C.grid}" stroke-width="1"/>`;
  return s;
}

function strokeAttr(o) {
  return `stroke="${o.c || C.shape}" stroke-width="${o.w || 2}"${o.dash ? ` stroke-dasharray="${o.dash}"` : ''}`;
}
function ln(x1, y1, x2, y2, o = {}) {
  return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" ${strokeAttr(o)} stroke-linecap="round"/>`;
}
function circ(cx, cy, r, o = {}) {
  return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${o.fill || 'none'}" ${strokeAttr(o)}/>`;
}
function rc(x, y, w, h, o = {}) {
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${o.rx || 0}" fill="${o.fill || 'none'}" ${strokeAttr(o)}/>`;
}
function path(d, o = {}) {
  return `<path d="${d}" fill="${o.fill || 'none'}" ${strokeAttr(o)} stroke-linecap="round" stroke-linejoin="round"/>`;
}
function txt(x, y, s, o = {}) {
  return `<text x="${x}" y="${y}" font-size="${o.size || 12}" fill="${o.c || C.label}" text-anchor="${o.anchor || 'middle'}"${o.bold ? ' font-weight="bold"' : ''}>${s}</text>`;
}

// 矢じり(先端 x,y、向き ang ラジアン)
function arrowHead(x, y, ang, size = 9, color = C.guide) {
  const bx = x - size * Math.cos(ang), by = y - size * Math.sin(ang);
  const px = -Math.sin(ang) * size * 0.38, py = Math.cos(ang) * size * 0.38;
  const f = (v) => Math.round(v * 10) / 10;
  return `<polygon points="${f(x)},${f(y)} ${f(bx + px)},${f(by + py)} ${f(bx - px)},${f(by - py)}" fill="${color}"/>`;
}

// マウスの動きなどを表す矢印(既定は青の点線)
function arrow(x1, y1, x2, y2, o = {}) {
  const c = o.c || C.guide;
  const ang = Math.atan2(y2 - y1, x2 - x1);
  return ln(x1, y1, x2, y2, { c, w: o.w || 1.8, dash: o.solid ? '' : (o.dash || '5 4') }) + arrowHead(x2, y2, ang, o.size || 9, c);
}

// クリック位置の印(オレンジの点+番号の丸)
function mark(x, y, n, dx = 13, dy = -13) {
  return `<circle cx="${x}" cy="${y}" r="3.5" fill="${C.mark}"/>`
    + `<circle cx="${x + dx}" cy="${y + dy}" r="8.5" fill="${C.mark}"/>`
    + `<text x="${x + dx}" y="${y + dy + 4}" font-size="11" fill="#fff" text-anchor="middle" font-weight="bold">${n}</text>`;
}

// 図中の番号札(画面の見方などで使う)
function badge(x, y, n) {
  return `<circle cx="${x}" cy="${y}" r="8.5" fill="${C.mark}"/><text x="${x}" y="${y + 4}" font-size="11" fill="#fff" text-anchor="middle" font-weight="bold">${n}</text>`;
}

// ツールバーのボタンの絵
function btnW(label, size = 12) {
  return label.length * size + 12;
}
function btn(x, y, label, o = {}) {
  const size = o.size || 12;
  const w = o.width || btnW(label, size);
  const h = o.h || size + 10;
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="4" fill="${o.on ? '#dbeafe' : C.btn}" stroke="${o.on ? C.guide : C.btnLine}" stroke-width="1"/>`
    + `<text x="${x + w / 2}" y="${y + h / 2 + size * 0.36}" font-size="${size}" fill="#222" text-anchor="middle">${label}</text>`;
}
// ボタンを横に並べる。戻り値 {s, x}(x は右端)
function btnRow(x, y, labels, o = {}) {
  let s = '';
  labels.forEach((l, i) => {
    s += btn(x, y, l, { ...o, on: o.active === i });
    x += btnW(l, o.size || 12) + (o.gap || 4);
  });
  return { s, x };
}

// 入力欄の絵
function box(x, y, w, value, o = {}) {
  const h = o.h || 20;
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="2" fill="#fff" stroke="${o.on ? C.guide : C.btnLine}" stroke-width="${o.on ? 1.6 : 1}"/>`
    + `<text x="${x + 5}" y="${y + h / 2 + 4}" font-size="${o.size || 12}" fill="#222">${value}</text>`;
}

// マウスカーソル(矢印ポインタ)
function cursor(x, y) {
  return `<path d="M${x} ${y} l0 16 l4 -4 l3 7 l3 -1.5 l-3 -7 l6 0 z" fill="#fff" stroke="#222" stroke-width="1.2" stroke-linejoin="round"/>`;
}

// 操作ガイド(マウスに付いてくる小さな案内)
function guideBox(x, y, lines) {
  // 半角文字は全角の約6割の幅で見積もる
  const textW = (l) => [...l].reduce((sum, ch) => sum + (ch.charCodeAt(0) < 0x100 ? 6.6 : 11), 0);
  const w = Math.max(...lines.map(textW)) + 14;
  const h = lines.length * 15 + 8;
  // 実際の画面と同じく、黒っぽい箱に白い案内・水色の数字
  let s = `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="4" fill="#1e232b" stroke="#0b6bcb" stroke-width="1"/>`;
  lines.forEach((l, i) => { s += txt(x + 7, y + 17 + i * 15, l, { size: 11, anchor: 'start', c: i === 0 ? '#fff' : '#9fd0ff' }); });
  return s;
}

// 水平寸法(矢印は内側・値は中央)
function dimH(x1, x2, yPt, yLine, value, o = {}) {
  const c = o.c || C.shape;
  const up = yLine < yPt ? -1 : 1;
  return ln(x1, yPt + up * 3, x1, yLine + up * 5, { c, w: 1 })
    + ln(x2, yPt + up * 3, x2, yLine + up * 5, { c, w: 1 })
    + ln(x1, yLine, x2, yLine, { c, w: 1 })
    + arrowHead(x1, yLine, Math.PI, 8, c) + arrowHead(x2, yLine, 0, 8, c)
    + txt((x1 + x2) / 2, yLine - 4, value, { c, size: 12 });
}
// 垂直寸法
function dimV(y1, y2, xPt, xLine, value, o = {}) {
  const c = o.c || C.shape;
  const side = xLine < xPt ? -1 : 1;
  const ym = (y1 + y2) / 2;
  return ln(xPt + side * 3, y1, xLine + side * 5, y1, { c, w: 1 })
    + ln(xPt + side * 3, y2, xLine + side * 5, y2, { c, w: 1 })
    + ln(xLine, y1, xLine, y2, { c, w: 1 })
    + arrowHead(xLine, y1, -Math.PI / 2, 8, c) + arrowHead(xLine, y2, Math.PI / 2, 8, c)
    + `<text x="${xLine - 5}" y="${ym}" font-size="12" fill="${c}" text-anchor="middle" transform="rotate(-90 ${xLine - 5} ${ym})">${value}</text>`;
}

// 原点の印(オレンジの十字)
function originMark(x, y) {
  return ln(x - 9, y, x + 9, y, { c: C.mark, w: 2 }) + ln(x, y - 9, x, y + 9, { c: C.mark, w: 2 });
}

// 「操作前」「操作後」を左右に並べる(各パネル幅 pw)
function beforeAfter(pw, h, left, right, labels = ['操作前', '操作後']) {
  const gap = 40;
  return txt(pw / 2, 14, labels[0], { size: 12, bold: true, c: '#222' })
    + `<g transform="translate(0 20)">${left}</g>`
    + arrow(pw + 6, h / 2 + 10, pw + gap - 6, h / 2 + 10, { solid: true, w: 3, size: 11, c: C.guide })
    + txt(pw + gap + pw / 2, 14, labels[1], { size: 12, bold: true, c: '#222' })
    + `<g transform="translate(${pw + gap} 20)">${right}</g>`;
}

// マウスの絵(pressed: 'left' | 'right' | 'wheel')
function mouse(x, y, pressed) {
  const fillL = pressed === 'left' ? C.mark : '#fff';
  const fillR = pressed === 'right' ? C.mark : '#fff';
  return `<path d="M${x} ${y + 26} L${x} ${y + 14} Q${x} ${y} ${x + 17} ${y} L${x + 17} ${y + 26} Z" fill="${fillL}" stroke="#222" stroke-width="1.5"/>`
    + `<path d="M${x + 17} ${y + 26} L${x + 17} ${y} Q${x + 34} ${y} ${x + 34} ${y + 14} L${x + 34} ${y + 26} Z" fill="${fillR}" stroke="#222" stroke-width="1.5"/>`
    + `<path d="M${x} ${y + 26} L${x} ${y + 42} Q${x} ${y + 58} ${x + 17} ${y + 58} Q${x + 34} ${y + 58} ${x + 34} ${y + 42} L${x + 34} ${y + 26} Z" fill="#fff" stroke="#222" stroke-width="1.5"/>`
    + `<rect x="${x + 14}" y="${y + 6}" width="6" height="13" rx="3" fill="${pressed === 'wheel' ? C.mark : '#ccc'}" stroke="#222" stroke-width="1"/>`;
}

// ---- カテゴリ ----
export const HELP_CATEGORIES = [
  { id: 'start', title: 'はじめに' },
  { id: 'view', title: '画面の動かし方' },
  { id: 'draw', title: '図形を描く' },
  { id: 'select', title: '選ぶ・動かす・消す' },
  { id: 'edit', title: '形を変える' },
  { id: 'dim', title: '寸法を入れる' },
  { id: 'symbol', title: '記号・表・斜線' },
  { id: 'style', title: '線の種類・太さ・文字の大きさ' },
  { id: 'assist', title: '正確に描くための機能' },
  { id: 'paper', title: '用紙・図面の設定' },
  { id: 'file', title: '保存・印刷' },
  { id: 'keys', title: 'キー操作の一覧' },
];

// ---- 画面の見方の図 ----
function screenLayoutSvg() {
  // 番号札は部品に重ならないよう、ボタンの段の上下にある余白の帯に置く
  let s = rc(1, 1, 498, 288, { c: '#9aa5b1', w: 1, fill: '#fafbfc' });
  // 1段目: タブ(左)と、いつも使うボタン(右)
  const tabs = btnRow(8, 20, ['ファイル', '作図', '寸法・記号', '編集', '表示・設定'], { size: 9, active: 1 });
  s += tabs.s;
  s += btnRow(265, 20, ['元に戻す', 'やり直し', '＋', '－', '全体', '？ヘルプ'], { size: 9, gap: 3 }).s;
  s += badge(127, 10, 1) + badge(380, 10, 2);
  // 2段目: 選択(左)・タブの中のボタン(中)・線種など(右)
  s += btn(8, 44, '選択', { size: 10 });
  s += btnRow(50, 44, ['直線', '連続線', '矩形', '円', '円弧', '楕円', '文字'], { size: 10, gap: 3 }).s;
  s += btnRow(360, 44, ['線種▾', '太さ▾', '文字▾'], { size: 10, gap: 3 }).s;
  s += badge(24, 75, 3) + badge(181, 75, 4) + badge(426, 75, 5);
  // 描く場所
  s += rc(4, 86, 492, 146, { c: '#ccd', w: 1, fill: '#eef0f3' });
  s += rc(60, 92, 380, 134, { c: '#bbb', w: 1, fill: '#fff' });
  s += rc(68, 98, 364, 122, { c: '#222', w: 1.5 });
  s += rc(332, 188, 100, 32, { c: '#222', w: 1 }) + ln(332, 204, 432, 204, { w: 0.8 }) + ln(372, 188, 372, 220, { w: 0.8 });
  s += txt(382, 184, '表題欄', { size: 10 });
  s += originMark(82, 208) + txt(98, 204, '原点', { size: 10, anchor: 'start', c: C.mark });
  s += rc(150, 125, 110, 60, { w: 2 }) + circ(205, 155, 16, { w: 2 });
  s += badge(468, 104, 6);
  // 数値入力
  s += rc(4, 236, 492, 24, { c: '#ccd', w: 1, fill: '#fff' });
  s += txt(12, 252, '始点X', { size: 10, anchor: 'start' }) + box(44, 240, 36, '0', { h: 16, size: 10 });
  s += txt(86, 252, 'Y', { size: 10, anchor: 'start' }) + box(96, 240, 36, '0', { h: 16, size: 10 });
  s += txt(138, 252, '長さ', { size: 10, anchor: 'start' }) + box(162, 240, 36, '50', { h: 16, size: 10 });
  s += txt(204, 252, '角度', { size: 10, anchor: 'start' }) + box(228, 240, 36, '0', { h: 16, size: 10 });
  s += btn(272, 239, '作図', { size: 10, h: 18 });
  s += badge(330, 248, 7);
  // 状態表示
  s += rc(4, 264, 492, 20, { c: '#ccd', w: 1, fill: '#f1f3f5' });
  s += txt(12, 278, 'X 35.00  Y 20.00 ｜ グリッド 10 ｜ 1:1 ｜ 図形 3', { size: 10, anchor: 'start' });
  s += badge(484, 274, 8);
  return s;
}

// ---- はじめに ----
const T_START = [
  {
    id: 'intro',
    category: 'start',
    title: 'この道具でできること・画面の見方',
    keywords: ['はじめに', '画面', '見方', '使い方', 'ボタン', 'タブ', 'ツールバー', 'できること'],
    tools: [],
    html: `
<p>この「製図ツール」は、機械の部品などの図面を、パソコンの画面で描くための道具です。線や円を描き、寸法（長さの数字）を入れて、紙に印刷したり、ファイルに保存したりできます。</p>
<p>長さの単位はすべて <b>mm（ミリ）</b> です。図面は画面の中の「用紙」（はじめは A3 の横向き）の上に描きます。</p>
${fig(500, 290, '画面の各部分の名前', screenLayoutSvg(), '画面の各部分。番号は下の説明と対応しています。')}
<ol class="help-steps">
<li><b>タブ</b>：「ファイル」「作図」「寸法・記号」「編集」「表示・設定」の見出しです。押すと、2段目に並ぶボタンが切り替わります。</li>
<li><b>いつも使うボタン</b>：「元に戻す」「やり直し」「＋」（大きく表示）「－」（小さく表示）「全体」（用紙全体を表示）「？ヘルプ」（この説明）。</li>
<li><span class="help-btn">選択</span>：図形を選んだり動かしたりするときのボタンです。いつも左端にあります。</li>
<li><b>タブの中のボタン</b>：①で選んだタブの道具が並びます。</li>
<li><span class="help-btn">線種</span><span class="help-btn">太さ</span><span class="help-btn">文字</span>：線の見た目（実線・点線など）、線の太さ、文字の大きさを決めるメニューです。いつも右端にあります。</li>
<li><b>用紙</b>：ここに図面を描きます。枠の右下は「表題欄」（図面の名前などを書く欄）です。オレンジの十字は「原点」＝座標（位置の数字）の0の場所です。</li>
<li><b>数値入力</b>：長さや角度を数字で入れて、正確に描いたり直したりする欄です。</li>
<li><b>状態表示</b>：マウスの位置（X＝横、Y＝縦。原点から右と上がプラス）、方眼の間隔、縮尺、表示の大きさ、図形の数が出ます。道具がうまく使えないときは、その理由と次にすることが【　】で出ます。</li>
</ol>
<div class="help-tip">ヒント: ボタンの上にマウスを置いて少し待つと、ボタンの名前・キーボードの近道・ひとことの説明が出ます。</div>
<p>次は <a href="#help:mouse">マウスの基本操作</a>、そして <a href="#help:tutorial">最初の図面を描いてみる</a> をご覧ください。</p>`,
  },
  {
    id: 'mouse',
    category: 'start',
    title: 'マウスの基本操作（クリック・ドラッグなど）',
    keywords: ['マウス', 'クリック', 'ダブルクリック', '右クリック', 'ドラッグ', 'ホイール', '基本'],
    tools: [],
    html: `
<p>この道具は、ほとんどの操作をマウスで行います。ここで使う言葉の意味を説明します。</p>
${fig(480, 130, 'マウスの操作4種類', [
    mouse(30, 20, 'left') + txt(47, 100, 'クリック', { bold: true, c: '#222' }) + txt(47, 116, '左を1回カチッ', { size: 11 }),
    mouse(150, 20, 'left') + txt(167, 100, 'ダブルクリック', { bold: true, c: '#222' }) + txt(167, 116, '左を素早く2回', { size: 11 }),
    mouse(270, 20, 'right') + txt(287, 100, '右クリック', { bold: true, c: '#222' }) + txt(287, 116, '右を1回カチッ', { size: 11 }),
    mouse(380, 20, 'left') + arrow(420, 50, 470, 30) + txt(410, 100, 'ドラッグ', { bold: true, c: '#222' }) + txt(410, 116, '押したまま動かす', { size: 11 }),
  ].join(''), 'オレンジ色の部分が押すボタンです。')}
<ul>
<li><b>クリック</b>：マウスの左ボタンを1回押してすぐ離します。線を描くときは「始まりの点でクリック → 終わりの点でクリック」のように、<b>ボタンを押したまま動かす必要はありません</b>。</li>
<li><b>ダブルクリック</b>：左ボタンを素早く2回押します。寸法の数字や文字を書き換えるときに使います。</li>
<li><b>右クリック</b>：右ボタンを1回押します。その場所で使える操作の一覧（メニュー）が出ます。→ <a href="#help:contextMenu">右クリックメニュー</a></li>
<li><b>ドラッグ</b>：<b>マウスのボタンを押したまま動かし、目的の場所で離す</b>操作です。図形を動かす、範囲を囲んで選ぶ、などに使います。</li>
<li><b>ホイール</b>：マウスの真ん中にある回る部分です。回すと画面が上下に動きます。→ <a href="#help:view">画面の動かし方</a></li>
</ul>
<div class="help-tip">ヒント: 間違えたら、あわてずに <kbd>Esc</kbd> キー（描きかけをやめる）か <kbd>Ctrl</kbd>+<kbd>Z</kbd>（ひとつ前に戻す）を押してください。</div>`,
  },
  {
    id: 'tutorial',
    category: 'start',
    title: '最初の図面を描いてみる（練習）',
    keywords: ['練習', 'チュートリアル', '入門', '最初', '手順', 'はじめて'],
    tools: [],
    html: `
<p>横100mm・縦50mmの板の図面を例に、用紙の準備から印刷までをひと通りやってみましょう。</p>
<h3>1. 用紙を決める</h3>
<ol class="help-steps">
<li>上の「表示・設定」タブをクリックします。</li>
<li>「用紙」のメニューで <b>A4</b>、向きで <b>横</b> を選びます。</li>
</ol>
<h3>2. 四角を描く</h3>
<ol class="help-steps">
<li>「作図」タブをクリックし、<span class="help-btn">矩形</span>（くけい＝四角形）を押します。</li>
<li>用紙の上で、四角の一つの角にしたい所をクリックします（図の①）。</li>
<li>マウスを斜めに動かし、反対側の角でもう一度クリックします（図の②）。</li>
</ol>
${fig(420, 170, '四角を描いて寸法を入れる例', grid(0, 0, 420, 170) + rc(80, 40, 200, 100, { w: 2.5 }) + mark(80, 140, '1', -13, 13) + mark(280, 40, '2')
    + dimH(80, 280, 140, 160, '100', { c: C.guide }) + txt(350, 95, '寸法(青)は手順4', { size: 11, c: C.guide }),
    '① → ② の順にクリックすると四角が描けます。寸法は下の2つの角と、線を置く場所をクリックします。')}
<h3>3. 大きさを数字でぴったりにする</h3>
<ol class="help-steps">
<li>左端の <span class="help-btn">選択</span> を押し、描いた四角の線をクリックします（青くなります）。</li>
<li>画面下の数値入力に四角の値が出ます。「幅」に <b>100</b>、「高さ」に <b>50</b> と入れて <kbd>Enter</kbd> を押します。</li>
</ol>
<h3>4. 寸法を入れる</h3>
<ol class="help-steps">
<li>「寸法・記号」タブの <span class="help-btn">寸法</span> を押します。</li>
<li>四角の左下の角をクリック（③）、右下の角をクリック（④）します。角にマウスを近づけると吸い付くので、ぴったり合わせられます。</li>
<li>四角の少し下をクリック（⑤）すると、「100」の寸法が入ります。</li>
</ol>
<h3>5. 保存と印刷</h3>
<ol class="help-steps">
<li>「ファイル」タブの <span class="help-btn">保存</span> を押し、名前を付けて保存します（<kbd>Ctrl</kbd>+<kbd>S</kbd> でも同じ）。</li>
<li><span class="help-btn">印刷</span> を押し、倍率を「100%」または「実際のサイズ」にして印刷します。</li>
</ol>
<p>詳しくは <a href="#help:rect">矩形</a>、<a href="#help:numericEdit">数字で形を直す</a>、<a href="#help:dimLinear">長さの寸法</a>、<a href="#help:saveOpen">保存</a>、<a href="#help:svgPrint">印刷</a> をご覧ください。</p>`,
  },
  {
    id: 'guideHelp',
    category: 'start',
    title: '操作ガイドとヘルプの使い方',
    keywords: ['操作ガイド', 'ガイド', 'ヘルプ', 'F1', '？', '説明', '案内', 'ツールチップ', '水色'],
    tools: [],
    html: `
<h3>操作ガイド（マウスに付いてくる案内）</h3>
<p>描く道具を使っている間、マウスの矢印の右下に小さな黒い箱が出ます。ここには「次にどこをクリックすればよいか」と、今の長さや角度などの数字が表示されます。</p>
${fig(400, 150, '操作ガイドの表示例', grid(0, 0, 400, 150) + ln(60, 110, 230, 60, { w: 2.5 }) + mark(60, 110, '1', -13, 13) + cursor(230, 60)
    + guideBox(215, 80, ['直線: 終点をクリック', '長さ 88.6  角度 16.4°']),
    '直線を描いている途中の例。次の操作と今の長さ・角度が出ています。')}
<p>表示がじゃまなときは、「表示・設定」タブの「操作ガイド」のチェックを外すと消えます。</p>
<h3>水色の表示（クリックできる図形の目印）</h3>
<p>マウスを図形の上に置くと、今の道具でクリックできる図形が<b>水色</b>に変わります。クリックする前に「どの図形が選ばれるか」を確かめられます。</p>
${fig(400, 110, '水色で示される図形', grid(0, 0, 400, 110) + rc(40, 25, 120, 60, { w: 2 }) + circ(270, 55, 32, { c: C.hi, w: 4 }) + cursor(292, 60) + txt(270, 104, 'マウスが乗っている円が水色に', { size: 11 }), '円の上にマウスがあるので、円が水色になっています。')}
<h3>ヘルプ（この説明）の開き方</h3>
<ul>
<li>右上の <span class="help-btn">？ヘルプ</span> を押します。</li>
<li><kbd>F1</kbd> キーまたは <kbd>?</kbd> キーを押すと、<b>今使っている道具の説明</b>が直接開きます。</li>
<li>図形を右クリックして「この図形の説明」を選ぶと、その図形の説明が開きます。</li>
<li>上の検索欄に「丸」「消す」など思いついた言葉を入れると、関係する説明を探せます。</li>
</ul>
<div class="help-tip">ヒント: 道具がうまく使えないときは、画面の一番下（状態表示）に理由と次にすることが表示されます。</div>`,
  },
];

// ---- 画面の動かし方 ----
const T_VIEW = [
  {
    id: 'view',
    category: 'view',
    title: '画面を動かす・拡大縮小する',
    keywords: ['スクロール', '拡大', '縮小', 'ズーム', '移動', 'パン', '全体', 'ホイール', 'スクロールバー', 'スペース', '矢印キー'],
    tools: [],
    html: `
<p>図面を描いた内容は変えずに、<b>見る場所や見る大きさだけ</b>を変える方法です。</p>
<h3>上下左右に動かす</h3>
<ul>
<li><b>ホイールを回す</b>：画面が上下に動きます。</li>
<li><b>スクロールバー</b>：画面の右端と下端にある細長い棒です。中のつまみをドラッグするか、棒の空いている所をクリックするとその位置へ移ります。</li>
<li><b>矢印キー</b>（<kbd>↑</kbd><kbd>↓</kbd><kbd>←</kbd><kbd>→</kbd>）：その方向へ動きます。</li>
<li><b>自由に動かす</b>：ホイールを押し込んだままマウスを動かすか、<kbd>Space</kbd>（スペースキー）を押したまま左ボタンでドラッグします。紙をつかんでずらす感覚です。</li>
</ul>
${fig(420, 140, 'スペースキーを押しながらドラッグして画面を動かす', grid(0, 0, 200, 120) + rc(40, 30, 90, 50, { w: 2 }) + cursor(85, 55)
    + arrow(210, 60, 240, 60, { solid: true, w: 3 }) + `<g transform="translate(250 0)">${grid(0, 0, 170, 120)}${rc(80, 50, 90, 50, { w: 2 })}${cursor(125, 75)}</g>`
    + arrow(85, 55, 125, 80) + txt(210, 134, '<tspan font-weight="bold">Space</tspan> を押したまま ドラッグ → 図面ごと動く', { size: 11 }),
    '紙をつかんで引っぱるように、図面全体が動きます。')}
<h3>大きく・小さく表示する</h3>
<ul>
<li><kbd>Shift</kbd> または <kbd>Ctrl</kbd> を押しながらホイールを回す：<b>マウスのある場所を中心に</b>拡大・縮小します。ノートパソコンのタッチパッドでは、2本指を広げる・つまむ操作でもできます。</li>
<li><span class="help-btn">＋</span><span class="help-btn">－</span>：画面の真ん中を中心に拡大・縮小します。</li>
<li><span class="help-btn">全体</span>：用紙全体がちょうど画面に入る大きさに戻します。どこを見ているか分からなくなったら押してください。</li>
</ul>
<div class="help-note">注意: 拡大縮小しても、図形の実際の大きさ（mm）は変わりません。見え方だけが変わります。</div>
<p>今の表示の大きさは、画面下の状態表示に「表示 ○px/mm」（用紙の1mmが画面の何ドットか）で出ます。</p>`,
  },
];

// ---- 図形を描く ----
const T_DRAW = [
  {
    id: 'line',
    category: 'draw',
    title: 'まっすぐな線を引く（直線）',
    keywords: ['直線', '線', 'ライン', 'せん', 'ちょくせん', 'L', '長さ', '角度'],
    tools: ['line'],
    html: `
<ol class="help-steps">
<li>「作図」タブの <span class="help-btn">直線</span> を押します（キーボードの <kbd>L</kbd> でも同じ）。</li>
<li>線の始まりにしたい所をクリックします（①）。</li>
<li>マウスを動かすと線が付いてきます。線の終わりにしたい所でクリックします（②）。これで1本できあがりです。</li>
<li>続けて別の線を描けます。やめるときは <kbd>Esc</kbd> を押します。</li>
</ol>
${fig(420, 170, '直線の描き方', grid(0, 0, 420, 170) + ln(60, 130, 260, 60, { w: 2.5 }) + mark(60, 130, 1, -13, 13) + mark(260, 60, 2)
    + ln(60, 130, 150, 130, { c: C.guide, w: 1, dash: '4 3' }) + path('M110 130 A50 50 0 0 0 107.2 113.5', { c: C.guide, w: 1.2 }) + txt(128, 122, '角度', { size: 11, c: C.guide, anchor: 'start' })
    + cursor(260, 60) + guideBox(278, 72, ['直線: 終点をクリック', '長さ 105.9', '角度 19.3°']),
    '①でクリック、②でクリック。途中は長さと角度が表示されます。')}
<h3>長さと角度を数字で決める</h3>
<p>①をクリックしたあと、キーボードで数字を打つと、画面下の数値入力の「長さ」の欄に入ります。「角度」の欄にも数字を入れ、<kbd>Enter</kbd> を押すと、その長さと角度の線ができます。</p>
<p>角度は <b>右向きが 0°</b>、<b>上向きが 90°</b>、左向きが 180°、下向きが 270°（または −90°）です。時計の針と<b>反対回り</b>に数えます。</p>
${fig(260, 170, '角度の向き', ln(130, 85, 220, 85, { w: 1 }) + ln(130, 85, 40, 85, { w: 1 }) + ln(130, 85, 130, 15, { w: 1 }) + ln(130, 85, 130, 155, { w: 1 })
    + arrowHead(220, 85, 0, 9, C.shape) + arrowHead(40, 85, Math.PI, 9, C.shape) + arrowHead(130, 15, -Math.PI / 2, 9, C.shape) + arrowHead(130, 155, Math.PI / 2, 9, C.shape)
    + txt(236, 89, '0°', { anchor: 'start' }) + txt(130, 11, '90°') + txt(22, 89, '180°', { anchor: 'middle' }) + txt(160, 160, '270°')
    + path('M170 85 A40 40 0 0 0 130 45', { c: C.mark, w: 1.8 }) + arrowHead(130, 45, Math.PI, 8, C.mark),
    '0°は右、そこから反対回りに増えます。')}
<h3>マウスを使わずに描く</h3>
<ol class="help-steps">
<li><span class="help-btn">直線</span> を押した状態で、画面下の数値入力に「始点X」「Y」（始まりの位置）、「長さ」「角度」を入れます。</li>
<li><span class="help-btn">作図</span> ボタンを押すと、その線が描かれます。</li>
</ol>
<div class="help-tip">ヒント: 位置の数字は、オレンジの十字「原点」からの距離です。右と上がプラスです。→ <a href="#help:origin">原点設定</a></div>`,
  },
  {
    id: 'polyline',
    category: 'draw',
    title: '線をつなげて描く（連続線）',
    keywords: ['連続線', 'れんぞくせん', 'ポリライン', '折れ線', 'つながった線', 'P'],
    tools: ['polyline'],
    html: `
<p>「連続線」は、折れ曲がりながらつながった線を一度に描く道具です。</p>
<ol class="help-steps">
<li>「作図」タブの <span class="help-btn">連続線</span> を押します（<kbd>P</kbd>）。</li>
<li>始まりの点をクリックし（①）、曲がり角ごとに順番にクリックします（②③…）。</li>
<li>最後の点で <b>ダブルクリック</b> するか、<kbd>Enter</kbd> を押すと終わります。</li>
</ol>
${fig(420, 160, '連続線の描き方', grid(0, 0, 420, 160) + path('M50 120 L130 40 L250 40 L330 120', { w: 2.5 }) + mark(50, 120, 1, -13, 13) + mark(130, 40, 2) + mark(250, 40, 3) + mark(330, 120, 4)
    + txt(210, 150, '④でダブルクリック か Enter で終わり', { size: 11 }),
    '①②③と順にクリックし、④で終えます。')}
<ul>
<li><kbd>Esc</kbd> を押すと、描きかけの連続線をやめます。</li>
<li>描いている途中に右クリックすると「作図を終える（Enter）」「作図をやめる（Esc）」が選べます。</li>
<li>始まりの点に最後の点を重ねても、「閉じた形」にはなりません。斜線（ハッチ）を入れたい形は、なるべく <a href="#help:rect">矩形</a> や <a href="#help:circle">円</a> で描いてください。</li>
</ul>
<div class="help-tip">ヒント: 連続線はひとまとまりの図形です。角を丸めたり一部を切ったりしたいときは、先に <a href="#help:explode">分解</a> してバラバラの直線にします。</div>`,
  },
  {
    id: 'rect',
    category: 'draw',
    title: '四角を描く（矩形）',
    keywords: ['矩形', 'くけい', '四角', '四角形', '長方形', '正方形', 'レクタングル', 'R'],
    tools: ['rect'],
    html: `
<p>「矩形（くけい）」は四角形のことです。</p>
<ol class="help-steps">
<li>「作図」タブの <span class="help-btn">矩形</span> を押します（<kbd>R</kbd>）。</li>
<li>四角の1つの角をクリックします（①）。</li>
<li>マウスを斜めに動かし、反対側の角をクリックします（②）。ボタンは押したままにしなくて大丈夫です。</li>
</ol>
${fig(420, 170, '矩形の描き方', grid(0, 0, 420, 170) + rc(80, 50, 180, 90, { w: 2.5 }) + mark(80, 140, 1, -13, 13) + mark(260, 50, 2) + arrow(92, 132, 250, 58)
    + cursor(260, 50) + guideBox(275, 62, ['矩形: 対角をクリック', '幅 90  高さ 45']),
    '①をクリックしてから、点線のようにマウスを動かして②をクリックします。')}
<div class="help-tip">ヒント: 正確な大きさにするには、描いたあと <span class="help-btn">選択</span> で四角をクリックし、数値入力の「幅」「高さ」を書き換えます。→ <a href="#help:numericEdit">数字で形を直す</a></div>`,
  },
  {
    id: 'circle',
    category: 'draw',
    title: '円を描く',
    keywords: ['円', 'えん', '丸', 'まる', 'サークル', '穴', 'C', '直径', '半径'],
    tools: ['circle'],
    html: `
<ol class="help-steps">
<li>「作図」タブの <span class="help-btn">円</span> を押します（<kbd>C</kbd>）。</li>
<li>円の中心をクリックします（①）。</li>
<li>円の周りにしたい所をクリックします（②）。中心から②までの距離が「半径」（直径の半分）になります。</li>
</ol>
${fig(400, 170, '円の描き方', grid(0, 0, 400, 170) + circ(170, 85, 65, { w: 2.5 }) + ln(170, 85, 235, 85, { c: C.guide, w: 1.2, dash: '4 3' }) + mark(170, 85, 1, -13, -13) + mark(235, 85, 2)
    + txt(202, 100, '半径', { size: 11, c: C.guide }) + guideBox(260, 100, ['円: 周上をクリック', '直径 65']),
    '①が中心、②が円の周り。')}
<div class="help-tip">ヒント: 穴の大きさは、選択してから数値入力の「直径」で正確に直せます。ねじ穴なら <a href="#help:thread">ねじ穴</a> の道具が便利です。</div>`,
  },
  {
    id: 'arc',
    category: 'draw',
    title: '円の一部を描く（円弧）',
    keywords: ['円弧', 'えんこ', '弧', 'アーク', 'カーブ', '丸み', 'A'],
    tools: ['arc'],
    html: `
<p>「円弧（えんこ）」は、円の一部分だけの曲線です。</p>
<ol class="help-steps">
<li>「作図」タブの <span class="help-btn">円弧</span> を押します（<kbd>A</kbd>）。</li>
<li>円の中心をクリックします（①）。</li>
<li>弧の始まりの点をクリックします（②）。ここで大きさ（半径）が決まります。</li>
<li>弧の終わりの点をクリックします（③）。</li>
</ol>
${fig(400, 170, '円弧の描き方', grid(0, 0, 400, 170) + circ(170, 110, 80, { c: '#ccc', w: 1, dash: '3 3' }) + path('M250 110 A80 80 0 0 0 130 40.7', { w: 3 })
    + ln(170, 110, 250, 110, { c: C.guide, w: 1, dash: '4 3' }) + ln(170, 110, 130, 40.7, { c: C.guide, w: 1, dash: '4 3' })
    + mark(170, 110, 1, 0, 20) + mark(250, 110, 2) + mark(130, 40.7, 3, -14, -8)
    + path('M215 110 A45 45 0 0 0 147.5 71', { c: C.mark, w: 1.4 }) + arrowHead(147.5, 71, Math.PI * 0.83, 8, C.mark) + txt(300, 60, '②から③へ', { size: 11 }) + txt(300, 76, '時計と反対回り', { size: 11 }),
    '②から③へ、時計の針と反対の向きに弧が描かれます。')}
<div class="help-note">注意: 弧はいつも<b>時計と反対回り</b>に②から③へ描かれます。思った側と逆にできたら、②と③の順番を入れ替えて描き直してください。</div>`,
  },
  {
    id: 'ellipse',
    category: 'draw',
    title: '楕円・楕円の一部を描く（楕円・楕円弧）',
    keywords: ['楕円', 'だえん', '楕円弧', 'だえんこ', 'オーバル', '長円', 'E'],
    tools: ['ellipse', 'earc'],
    html: `
<p>「楕円（だえん）」は、横か縦につぶれた円です。</p>
<h3>楕円</h3>
<ol class="help-steps">
<li>「作図」タブの <span class="help-btn">楕円</span> を押します（<kbd>E</kbd>）。</li>
<li>中心をクリックします（①）。</li>
<li>楕円をぴったり囲む四角の角にあたる所をクリックします（②）。①からの横の距離が横の半径、縦の距離が縦の半径になります。</li>
</ol>
${fig(400, 160, '楕円の描き方', grid(0, 0, 400, 160) + rc(90, 30, 220, 100, { c: C.guide, w: 1, dash: '4 3' }) + `<ellipse cx="200" cy="80" rx="110" ry="50" fill="none" stroke="${C.shape}" stroke-width="2.5"/>`
    + mark(200, 80, 1, -13, -13) + mark(310, 30, 2) + ln(200, 80, 310, 80, { c: C.guide, w: 1 }) + ln(310, 80, 310, 30, { c: C.guide, w: 1 })
    + txt(255, 95, '横の半径', { size: 11, c: C.guide }) + txt(318, 60, '縦の半径', { size: 11, c: C.guide, anchor: 'start' }),
    '①中心、②囲む四角の角。')}
<h3>楕円弧（楕円の一部分）</h3>
<ol class="help-steps">
<li>「作図」タブの <span class="help-btn">楕円弧</span> を押します。</li>
<li>中心（①）と囲む四角の角（②）を、楕円と同じようにクリックします。</li>
<li>弧の始まりの点（③）、終わりの点（④）をクリックします。弧は時計と反対回りに③から④へ描かれます。</li>
</ol>
${fig(400, 160, '楕円弧の描き方', grid(0, 0, 400, 160) + `<ellipse cx="200" cy="90" rx="110" ry="55" fill="none" stroke="#ccc" stroke-width="1" stroke-dasharray="3 3"/>`
    + path('M303.4 71.2 A110 55 0 0 0 104.7 62.5', { w: 3 }) + mark(200, 90, 1, -13, 13) + mark(310, 35, 2) + mark(303.4, 71.2, 3, 14, 4) + mark(104.7, 62.5, 4, -14, -6)
    + ln(200, 90, 303.4, 71.2, { c: C.guide, w: 1, dash: '4 3' }) + ln(200, 90, 104.7, 62.5, { c: C.guide, w: 1, dash: '4 3' }),
    '①②で楕円の大きさ、③④で使う部分を決めます。')}`,
  },
  {
    id: 'spline',
    category: 'draw',
    title: 'なめらかな曲線を描く（スプライン）',
    keywords: ['スプライン', '曲線', 'カーブ', '自由曲線', 'なめらか', 'S'],
    tools: ['spline'],
    html: `
<p>「スプライン」は、クリックした点を<b>なめらかにつなぐ曲線</b>です。部品の破断線（途中を省いた切れ目の線）や、自由な形に使います。</p>
<ol class="help-steps">
<li>「作図」タブの <span class="help-btn">スプライン</span> を押します（<kbd>S</kbd>）。</li>
<li>曲線が通る点を、順番にクリックします（①②③④…）。</li>
<li>最後の点で <b>ダブルクリック</b> するか <kbd>Enter</kbd> で終わります。<kbd>Esc</kbd> でやめます。</li>
</ol>
${fig(400, 160, 'スプラインの描き方', grid(0, 0, 400, 160) + path('M50 120 C80 70 105 50 140 50 C180 50 200 120 240 120 C280 120 305 70 340 60', { w: 2.5 })
    + mark(50, 120, 1, -13, 13) + mark(140, 50, 2) + mark(240, 120, 3, 0, 20) + mark(340, 60, 4),
    'クリックした点を通るなめらかな曲線になります。')}`,
  },
  {
    id: 'text',
    category: 'draw',
    title: '文字を書く',
    keywords: ['文字', 'もじ', 'テキスト', '注記', 'メモ', '書く', 'T'],
    tools: ['text'],
    html: `
<ol class="help-steps">
<li>「作図」タブの <span class="help-btn">文字</span> を押します（<kbd>T</kbd>）。</li>
<li>文字を置きたい所をクリックします（①）。</li>
<li>小さな入力欄が出るので、文字を打ちます。</li>
<li><kbd>Enter</kbd> を押すと確定します。</li>
</ol>
${fig(420, 120, '文字の書き方', beforeAfter(190, 100, grid(0, 0, 190, 100) + box(40, 40, 110, '部品A 材質SS400', { on: true, size: 10 }) + mark(40, 60, 1, -12, 12),
    grid(0, 0, 190, 100) + txt(40, 64, '部品A 材質SS400', { anchor: 'start', c: '#222', size: 13 })),
    '①でクリックして文字を打ち、Enter で確定。')}
<ul>
<li>文字の大きさは、右上の「文字」メニューで決めます。→ <a href="#help:widthText">太さと文字の大きさ</a></li>
<li>書いた文字を直すには、<span class="help-btn">選択</span> でその文字を <b>ダブルクリック</b> します。</li>
<li>文字を斜めにするには、選択して数値入力の「回転」に角度を入れます。</li>
</ul>`,
  },
  {
    id: 'thread',
    category: 'draw',
    title: 'ねじ穴をワンクリックで描く',
    keywords: ['ねじ穴', 'ねじ', 'ネジ', 'タップ', 'めねじ', 'M3', 'M4', 'M5', 'M6', 'M8', 'M10', 'M12', '下穴'],
    tools: ['thread'],
    html: `
<p>上から見たねじ穴（ねじを切った穴）を、決まった書き方で一度に描きます。</p>
<ol class="help-steps">
<li>「作図」タブの <span class="help-btn">ねじ穴</span> を押します。</li>
<li>となりのメニューで、ねじの太さ（<b>M3〜M12</b>）を選びます。</li>
<li>穴の中心にしたい所をクリックします（①）。</li>
</ol>
${fig(420, 170, 'ねじ穴の描き方', btn(10, 10, 'ねじ穴', { on: true }) + btn(76, 10, 'M6 ▾') + grid(0, 40, 420, 130)
    + circ(150, 105, 40, { w: 2.8 }) + path('M198 105 A48 48 0 1 0 150 153', { w: 1 })
    + ln(88, 105, 212, 105, { w: 1, dash: '14 3 3 3' }) + ln(150, 43, 150, 167, { w: 1, dash: '14 3 3 3' }) + mark(150, 105, 1, -16, -14)
    + txt(250, 70, '太い円＝下穴（M6なら直径5）', { size: 11, anchor: 'start' }) + txt(250, 95, '細い3/4の円＝ねじの山の外側', { size: 11, anchor: 'start' }) + txt(250, 120, '一点鎖線の十字＝中心線', { size: 11, anchor: 'start' }),
    'クリック1回で、3種類の線がまとめて描かれます。')}
<ul>
<li><b>太い円</b>：ドリルで最初にあける穴（下穴）です。大きさはJIS（日本の規格）の並目ねじに合わせて自動で決まります（例：M6 → 直径5mm、M8 → 6.8mm）。</li>
<li><b>細い 3/4 の円</b>：ねじの外側の大きさ（M6なら直径6mm）を示します。規格どおり、右下の1/4を空けて描きます。</li>
<li><b>十字の線</b>：穴の中心を示す線（中心線）です。</li>
</ul>
<div class="help-tip">ヒント: 描いたあとは普通の円や線と同じなので、選んで動かしたり消したりできます。穴の寸法は <a href="#help:dimDiaRad">φ</a> や <a href="#help:leader">引出線</a> で「M6」と書き入れます。</div>`,
  },
];

// ---- 選ぶ・動かす・消す ----
const T_SELECT = [
  {
    id: 'select',
    category: 'select',
    title: '図形を選ぶ（選択）',
    keywords: ['選択', 'せんたく', '選ぶ', '範囲選択', '囲む', 'すべて選択', 'Shift', 'Ctrl+A', 'Esc'],
    tools: ['select'],
    html: `
<p>図形を動かす・消す・色々な変更をするには、まず「どの図形に対してするか」を選びます。</p>
<ol class="help-steps">
<li>左端の <span class="help-btn">選択</span> を押します（<kbd>Esc</kbd> キーでもこの状態に戻れます）。</li>
<li>選びたい図形の線の上をクリックします。選ばれた図形は<b>青色</b>になります。</li>
</ol>
<h3>いくつも選ぶ</h3>
<ul>
<li><kbd>Shift</kbd> を押しながらクリックすると、選んだものに<b>追加</b>できます。選ばれている図形を <kbd>Shift</kbd>+クリックすると、選択から外れます。</li>
<li><b>囲んで選ぶ</b>：図形のない所からドラッグすると四角い枠が出ます。枠の中に<b>すっぽり入った</b>図形がまとめて選ばれます。</li>
<li><kbd>Ctrl</kbd>+<kbd>A</kbd>：すべての図形を選びます。</li>
</ul>
${fig(420, 160, '囲んで選ぶ', beforeAfter(190, 140,
    grid(0, 0, 190, 120) + rc(30, 30, 50, 40, { w: 2 }) + circ(115, 55, 20, { w: 2 }) + ln(150, 20, 180, 100, { w: 2 })
    + rc(15, 15, 135, 80, { c: C.guide, w: 1.2, dash: '5 3', fill: 'rgba(11,107,203,0.06)' }) + mark(15, 15, 1, 0, 0) + mark(150, 95, 2, 10, 12),
    grid(0, 0, 190, 120) + rc(30, 30, 50, 40, { w: 2.5, c: C.sel }) + circ(115, 55, 20, { w: 2.5, c: C.sel }) + ln(150, 20, 180, 100, { w: 2 })
    + txt(95, 114, '斜めの線は枠からはみ出たので選ばれない', { size: 10 })),
    '①でボタンを押し、押したまま②まで動かして離します。')}
<h3>選ぶのをやめる</h3>
<p>図形のない所をクリックするか、<kbd>Esc</kbd> を押すと、選択が解除されます。</p>
<div class="help-tip">ヒント: <kbd>Esc</kbd> は「描きかけをやめる → 選択の道具に戻る → 選択を解除する」の順に働きます。困ったら何回か押してください。</div>`,
  },
  {
    id: 'move',
    category: 'select',
    title: '図形を動かす',
    keywords: ['移動', '動かす', 'いどう', 'ずらす', 'ドラッグ', 'ムーブ'],
    tools: ['select'],
    html: `
<ol class="help-steps">
<li><span class="help-btn">選択</span> で動かしたい図形を選びます（青くなります）。</li>
<li>青い図形の線の上でボタンを押し、押したまま動かします（ドラッグ）。</li>
<li>置きたい所でボタンを離します。</li>
</ol>
${fig(420, 150, '図形をドラッグして動かす', grid(0, 0, 420, 150) + rc(40, 40, 110, 70, { c: '#bbb', w: 1.5, dash: '4 3' }) + rc(240, 50, 110, 70, { c: C.sel, w: 2.5 })
    + mark(150, 75, 1, 13, -13) + arrow(155, 80, 345, 90) + cursor(350, 85) + txt(95, 130, '元の位置', { size: 11 }) + txt(295, 138, '離した位置', { size: 11 }),
    '選んだ図形の線をつかんで、動かしたい所で離します。')}
<ul>
<li>いくつも選んでいれば、まとめて動きます。</li>
<li>「スナップ」がオンのときは、方眼（グリッド）の間隔ずつ動くので、位置をそろえやすくなっています。→ <a href="#help:gridSnap">グリッドとスナップ</a></li>
<li>正確な位置に動かすには、数値入力で位置の数字を書き換えます。→ <a href="#help:numericEdit">数字で形を直す</a></li>
</ul>`,
  },
  {
    id: 'copyPaste',
    category: 'select',
    title: 'コピー・貼り付け・複製',
    keywords: ['コピー', '貼り付け', 'ペースト', '複製', '右ドラッグ', 'Ctrl+C', 'Ctrl+V', 'Ctrl+D', '同じ図形'],
    tools: ['select'],
    html: `
<p>同じ図形をもう一つ作る方法は3つあります。どれも、先に <span class="help-btn">選択</span> で図形を選んでおきます。</p>
<h3>1. コピーして貼り付ける</h3>
<ol class="help-steps">
<li><kbd>Ctrl</kbd>+<kbd>C</kbd> を押します（見た目は変わりませんが、覚えています）。</li>
<li>貼り付けたい所にマウスを置き、<kbd>Ctrl</kbd>+<kbd>V</kbd> を押します。マウスの位置に同じ図形ができます。</li>
</ol>
<h3>2. 複製</h3>
<p><kbd>Ctrl</kbd>+<kbd>D</kbd> を押すと、右上に 10mm ずれた所に同じ図形がすぐにできます。</p>
<h3>3. 右ボタンでドラッグ</h3>
<ol class="help-steps">
<li>図形の上で<b>マウスの右ボタン</b>を押し、押したまま動かします。</li>
<li>行き先が点線の枠で表示されます。</li>
<li>置きたい所でボタンを離すと、そこにコピーができます。元の図形はそのまま残ります。</li>
</ol>
${fig(420, 150, '右ドラッグでコピー', grid(0, 0, 420, 150) + circ(100, 75, 35, { w: 2.5 }) + rc(245, 35, 80, 80, { c: C.guide, w: 1.2, dash: '5 3' })
    + mouse(20, 85, 'right') + arrow(135, 75, 280, 75) + txt(100, 135, '元の円（残る）', { size: 11 }) + txt(285, 132, '離した所にコピー', { size: 11 }),
    '右ボタンを押したまま動かすと、点線の枠が行き先を示します。')}`,
  },
  {
    id: 'contextMenu',
    category: 'select',
    title: '右クリックメニュー',
    keywords: ['右クリック', 'メニュー', 'コンテキストメニュー', '回転', '反転', '書き換え'],
    tools: [],
    html: `
<p>マウスを動かさずに<b>右クリック</b>すると、その場所で使える操作の一覧が出ます。項目をクリックするとその操作をします。</p>
${fig(420, 210, '右クリックメニューの例', grid(0, 0, 420, 210) + rc(30, 60, 100, 60, { w: 2.5, c: C.sel }) + cursor(120, 90)
    + rc(140, 8, 170, 196, { c: '#9aa5b1', w: 1, fill: '#fff' })
    + ['コピー', '貼り付け', '複製', '削除', '左に90°回転', '右に90°回転', '角度を指定して回転…', '拡大縮小…', '左右反転', '上下反転', '線種 ▸', 'この図形の説明']
      .map((l, i) => txt(152, 24 + i * 15.5, l, { size: 11, anchor: 'start', c: '#222' })).join('')
    + rc(141, 55, 168, 15, { c: 'none', w: 0, fill: 'rgba(90,169,255,0.25)' }),
    '図形の上で右クリックしたときのメニュー（一部）。')}
<h3>図形の上で右クリックしたとき</h3>
<ul>
<li><b>コピー／貼り付け／複製／削除</b>：→ <a href="#help:copyPaste">コピー</a>、<a href="#help:deleteUndo">削除</a></li>
<li><b>左に90°回転／右に90°回転</b>：その場で90°回します。</li>
<li><b>角度を指定して回転…</b>：「編集」タブが開き、角度の欄に文字が打てる状態になります。→ <a href="#help:rotate">回転</a></li>
<li><b>拡大縮小…</b>：「編集」タブが開き、倍率の欄に打てる状態になります。→ <a href="#help:scale">拡大縮小</a></li>
<li><b>左右反転／上下反転</b>：鏡に映したように裏返します。→ <a href="#help:mirror">反転</a></li>
<li><b>分解</b>（矩形・連続線のとき）：バラバラの直線にします。→ <a href="#help:explode">分解</a></li>
<li><b>線種 ▸／太さ ▸／文字の大きさ ▸</b>：線の種類・太さ・文字の大きさをその場で変えます。</li>
<li><b>値・文字を書き換える</b>（寸法・文字・バルーン・記号のとき）：ダブルクリックと同じく書き換えます。→ <a href="#help:dimEdit">寸法の値の書き換え</a></li>
<li><b>寸法の値を中央に戻す</b>（数字を動かした寸法のとき）：→ <a href="#help:dimValueMove">寸法の数字を動かす</a></li>
<li><b>この図形の説明</b>：その図形のヘルプを開きます。</li>
</ul>
<h3>何もない所で右クリックしたとき</h3>
<p>「貼り付け」「元に戻す」「やり直し」「すべて選択」「用紙全体を表示」「選択ツールに戻る」「ヘルプを開く」が出ます。</p>
<h3>連続線・スプラインを描いている途中</h3>
<p>「作図を終える（Enter）」と「作図をやめる（Esc）」も出ます。</p>
<div class="help-note">注意: 右ボタンを押したままマウスを動かすと、メニューではなく「右ドラッグでコピー」になります。</div>`,
  },
  {
    id: 'numericInput',
    category: 'select',
    title: '数字を入れて正確に描く（数値入力）',
    keywords: ['数値入力', '数字', '寸法どおり', '正確', '座標', '長さ', '角度', '作図ボタン', 'Enter'],
    tools: ['line'],
    html: `
<p>画面の下にある「数値入力」の欄を使うと、マウスの位置に頼らず、数字どおりの線を描けます。</p>
${fig(440, 70, '数値入力の欄', rc(2, 10, 436, 40, { c: '#ccd', w: 1, fill: '#fff' })
    + txt(12, 35, '始点X', { anchor: 'start' }) + box(50, 20, 50, '20') + txt(108, 35, 'Y', { anchor: 'start' }) + box(120, 20, 50, '30')
    + txt(180, 35, '長さ', { anchor: 'start' }) + box(210, 20, 50, '80', { on: true }) + txt(268, 35, '角度', { anchor: 'start' }) + box(298, 20, 50, '0')
    + btn(362, 19, '作図', { on: true }),
    '直線を選んでいるときの数値入力。')}
<h3>マウスで描きながら長さを決める</h3>
<ol class="help-steps">
<li><span class="help-btn">直線</span> で始まりの点をクリックします。</li>
<li>そのままキーボードで数字（例：80）を打ちます。自動で「長さ」の欄に入ります。</li>
<li>必要なら <kbd>Tab</kbd> キーで「角度」の欄に移って角度を入れます。</li>
<li><kbd>Enter</kbd> で確定すると、その長さ・角度の線ができます。</li>
</ol>
<h3>マウスを使わずに描く</h3>
<ol class="help-steps">
<li><span class="help-btn">直線</span> を押します。</li>
<li>「始点X」「Y」に始まりの位置、「長さ」「角度」を入れます。</li>
<li><span class="help-btn">作図</span> を押します。</li>
</ol>
<div class="help-tip">ヒント: X・Yは原点（オレンジの十字）からの距離です。角度は右が0°、上が90°です。欄に文字を打っている間は、<kbd>L</kbd> などの1文字の近道キーは働きません。</div>`,
  },
  {
    id: 'numericEdit',
    category: 'select',
    title: '数字で形を直す（数値編集・線分の編集）',
    keywords: ['数値編集', '更新', '直す', '修正', '大きさ変更', '直径', '幅', '高さ', '線分', '回転角', '位置'],
    tools: ['select'],
    html: `
<p>描いた図形を<b>1つだけ</b>選ぶと、数値入力の欄にその図形の数字が入り、ボタンが <span class="help-btn">更新</span> に変わります。</p>
<ol class="help-steps">
<li><span class="help-btn">選択</span> で図形を1つクリックします。</li>
<li>数値入力の欄の数字を書き換えます。</li>
<li><kbd>Enter</kbd> を押すか、別の欄をクリックすると、すぐに図形に反映されます。</li>
</ol>
${fig(440, 150, '円の直径を数字で直す', beforeAfter(200, 110,
    grid(0, 0, 200, 110) + circ(100, 55, 25, { w: 2.5, c: C.sel }) + txt(100, 104, '直径 50', { size: 11 }),
    grid(0, 0, 200, 110) + circ(100, 55, 40, { w: 2.5, c: C.sel }) + txt(100, 108, '「直径」を 80 にして Enter', { size: 11 })),
    '中心の位置はそのままで、大きさだけ変わります。')}
<h3>図形ごとに出る数字</h3>
<ul>
<li><b>直線</b>：始点X・Y、長さ、角度。始まりの点はそのままで、終わりの点が動きます。</li>
<li><b>円</b>：中心X・Y、直径。</li>
<li><b>円弧</b>：中心X・Y、半径、始まりの角度・終わりの角度。</li>
<li><b>矩形</b>：左下の角のX・Y、幅、高さ、回転（傾き）。</li>
<li><b>楕円・楕円弧</b>：中心X・Y、横と縦の半径、回転（楕円弧は始まり・終わりの角度も）。</li>
<li><b>文字</b>：位置X・Y、回転。</li>
<li><b>連続線・スプライン</b>：始点X・Y。変えると形はそのままで全体が動きます。</li>
</ul>
<h3>連続線の1本だけを直す</h3>
<ol class="help-steps">
<li>連続線をクリックして選びます（青くなります）。</li>
<li>直したい部分を<b>もう一度クリック</b>します。その1本だけが<b>オレンジ色</b>になります。</li>
<li>数値入力に、その1本の始点・長さ・角度が出るので、書き換えて <kbd>Enter</kbd> を押します。</li>
</ol>
${fig(400, 130, '連続線の一部分を選ぶ', grid(0, 0, 400, 130) + path('M50 100 L130 40', { w: 2.5, c: C.sel }) + path('M130 40 L260 40', { w: 3.5, c: C.mark }) + path('M260 40 L340 100', { w: 2.5, c: C.sel })
    + cursor(200, 42) + txt(195, 70, 'もう一度クリックした部分だけオレンジ色', { size: 11 }),
    '選んだ連続線の、真ん中の1本だけを選んだところ。')}`,
  },
  {
    id: 'deleteUndo',
    category: 'select',
    title: '消す・元に戻す・やり直す',
    keywords: ['削除', '消す', 'けす', 'Delete', 'Backspace', '元に戻す', 'やり直し', 'アンドゥ', 'Ctrl+Z', 'Ctrl+Y', '取り消し'],
    tools: ['select'],
    html: `
<h3>消す（削除）</h3>
<ol class="help-steps">
<li><span class="help-btn">選択</span> で消したい図形を選びます。</li>
<li><kbd>Delete</kbd> キー（または <kbd>Backspace</kbd>）を押します。右クリックメニューの「削除」でも消せます。</li>
</ol>
<h3>元に戻す・やり直す</h3>
<ul>
<li><span class="help-btn">元に戻す</span>（<kbd>Ctrl</kbd>+<kbd>Z</kbd>）：ひとつ前の状態に戻します。何回も押すと、さらに前に戻ります（100回分まで）。</li>
<li><span class="help-btn">やり直し</span>（<kbd>Ctrl</kbd>+<kbd>Y</kbd> または <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>Z</kbd>）：戻しすぎたときに、戻す前に進めます。</li>
</ul>
${fig(420, 110, '元に戻す・やり直し', grid(0, 0, 120, 90) + rc(20, 25, 80, 45, { w: 2 }) + circ(60, 47, 14, { w: 2 })
    + `<g transform="translate(150 0)">${grid(0, 0, 120, 90)}${rc(20, 25, 80, 45, { w: 2 })}</g>`
    + `<g transform="translate(300 0)">${grid(0, 0, 120, 90)}${rc(20, 25, 80, 45, { w: 2 })}${circ(60, 47, 14, { w: 2 })}</g>`
    + arrow(122, 40, 148, 40, { solid: true }) + arrow(272, 40, 298, 40, { solid: true })
    + txt(135, 32, '', {}) + txt(210, 104, '元に戻す（円が消える）', { size: 11 }) + txt(360, 104, 'やり直し（円が戻る）', { size: 11 }),
    '円を描いたあとに「元に戻す」、続けて「やり直し」。')}
<div class="help-note">注意: 元に戻したあとで新しく何かを描くと、「やり直し」はできなくなります。</div>`,
  },
];

// ---- 形を変える ----
const T_EDIT = [
  {
    id: 'rotate',
    category: 'edit',
    title: '回す（回転）',
    keywords: ['回転', 'かいてん', '回す', '傾ける', '角度', '90度', '左回り', '右回り'],
    tools: [],
    html: `
<ol class="help-steps">
<li><span class="help-btn">選択</span> で回したい図形を選びます。</li>
<li>「編集」タブを開き、<span class="help-btn">回転</span> の横の角度の欄に数字を入れます（はじめは 90）。</li>
<li><span class="help-btn">回転</span> を押します。選んだ図形全体の真ん中を中心に回ります。</li>
</ol>
${fig(440, 170, '回転の前と後', btn(0, 0, '回転', { size: 11 }) + box(48, 0, 40, '30', { h: 21, size: 11 }) + `<g transform="translate(0 20)">${beforeAfter(200, 130,
    grid(0, 0, 200, 130) + rc(50, 45, 100, 40, { w: 2.5, c: C.sel }) + circ(100, 65, 3, { c: C.mark, fill: C.mark, w: 1 }),
    grid(0, 0, 200, 130) + rc(50, 45, 100, 40, { c: '#ccc', w: 1, dash: '3 3' }) + `<g transform="rotate(-30 100 65)">${rc(50, 45, 100, 40, { w: 2.5, c: C.sel })}</g>`
    + path('M150 65 A50 50 0 0 0 143.3 40', { c: C.mark, w: 1.5 }) + arrowHead(143.3, 40, -Math.PI * 0.62, 8, C.mark))}</g>`,
    '角度 30 で回転。プラスは時計の針と反対回り（左回り）です。オレンジの点が回る中心です。')}
<ul>
<li><b>プラスの数字</b>（例：30）は時計と反対回り（左回り）、<b>マイナスの数字</b>（例：−30）は時計回り（右回り）です。</li>
<li>どんな角度でも回せます（例：15、45、−120）。</li>
<li>90°だけ回すなら、図形を右クリックして「左に90°回転」「右に90°回転」を選ぶのが早いです。</li>
</ul>`,
  },
  {
    id: 'scale',
    category: 'edit',
    title: '大きさを変える（拡大縮小）',
    keywords: ['拡大縮小', '拡大', '縮小', '倍率', '大きく', '小さく', '2倍', 'スケール'],
    tools: [],
    html: `
<ol class="help-steps">
<li><span class="help-btn">選択</span> で図形を選びます。</li>
<li>「編集」タブの <span class="help-btn">拡大縮小</span> の横の倍率の欄に数字を入れます。<b>2</b> なら2倍、<b>0.5</b> なら半分です。</li>
<li><span class="help-btn">拡大縮小</span> を押します。選んだ図形全体の真ん中を中心に大きさが変わります。</li>
</ol>
${fig(440, 150, '2倍に拡大', beforeAfter(200, 110,
    grid(0, 0, 200, 110) + rc(75, 35, 50, 30, { w: 2.5, c: C.sel }) + txt(100, 95, '倍率 2', { size: 11 }),
    grid(0, 0, 200, 110) + rc(75, 35, 50, 30, { c: '#ccc', w: 1, dash: '3 3' }) + rc(50, 20, 100, 60, { w: 2.5, c: C.sel }) + txt(100, 100, '縦も横も2倍', { size: 11 })),
    '真ん中の位置は変わらず、縦横が同じ割合で大きくなります。')}
<div class="help-note">注意: 文字や寸法の<b>数字の大きさ</b>は変わりません。文字を大きくしたいときは「文字」メニューを使います。→ <a href="#help:widthText">太さと文字の大きさ</a>。寸法も一緒に選んでおくと、寸法の線の位置と数字（測った長さ）も合わせて変わります。一緒に選ばなかった寸法は変わらないので、入れ直してください。</div>
<div class="help-tip">ヒント: 紙に入りきらない大きな部品は、図形を縮めるより「縮尺」を変えるのが正しい方法です。→ <a href="#help:paperScale">用紙と縮尺</a></div>`,
  },
  {
    id: 'mirror',
    category: 'edit',
    title: '裏返す（左右反転・上下反転）',
    keywords: ['反転', '左右反転', '上下反転', 'ミラー', '鏡', '裏返す', '対称'],
    tools: [],
    html: `
<ol class="help-steps">
<li><span class="help-btn">選択</span> で図形を選びます。</li>
<li>「編集」タブの <span class="help-btn">左右反転</span> または <span class="help-btn">上下反転</span> を押します。</li>
</ol>
<p>選んだ図形全体の真ん中を境に、鏡に映したように裏返ります。</p>
${fig(440, 140, '左右反転', beforeAfter(200, 100,
    grid(0, 0, 200, 100) + path('M60 80 L60 20 L140 80 Z', { w: 2.5, c: C.sel }),
    grid(0, 0, 200, 100) + path('M140 80 L140 20 L60 80 Z', { w: 2.5, c: C.sel }) + ln(100, 10, 100, 90, { c: C.guide, w: 1, dash: '5 3' })),
    '左右反転。青い点線が裏返しの境目（選んだ図形の真ん中）です。')}
<div class="help-tip">ヒント: 左右対称の部品は、半分を描いて <kbd>Ctrl</kbd>+<kbd>D</kbd> で複製し、左右反転して並べると早く描けます。</div>`,
  },
  {
    id: 'explode',
    category: 'edit',
    title: '四角や連続線をバラバラの線にする（分解）',
    keywords: ['分解', 'ぶんかい', 'バラバラ', '分ける', '直線にする'],
    tools: [],
    html: `
<p>「分解」は、四角（矩形）や連続線を、<b>1本ずつ別々の直線</b>に分ける機能です。</p>
<p>トリム（線を切る）・延長・フィレット（角を丸める）・面取りは、直線にしか使えません。四角の角を丸めたいときなどは、先に分解します。</p>
<ol class="help-steps">
<li><span class="help-btn">選択</span> で四角または連続線を選びます。</li>
<li>「編集」タブの <span class="help-btn">分解</span> を押します（右クリックメニューの「分解」でも同じ）。</li>
</ol>
${fig(440, 140, '分解の前と後', beforeAfter(200, 100,
    grid(0, 0, 200, 100) + rc(40, 20, 120, 60, { w: 2.5, c: C.sel }) + txt(100, 96, '1つの四角', { size: 11 }),
    grid(0, 0, 200, 100) + ln(40, 20, 160, 20, { w: 2.5 }) + ln(160, 20, 160, 80, { w: 2.5, c: C.sel }) + ln(160, 80, 40, 80, { w: 2.5 }) + ln(40, 80, 40, 20, { w: 2.5 })
    + [[40, 20], [160, 20], [160, 80], [40, 80]].map(([x, y]) => rc(x - 3, y - 3, 6, 6, { c: C.mark, w: 1.2 })).join('') + txt(100, 96, '4本の直線', { size: 11 })),
    '見た目は同じですが、4本の直線に分かれ、1本ずつ選べるようになります。')}`,
  },
  {
    id: 'trim',
    category: 'edit',
    title: 'はみ出た線を切り取る（トリム）',
    keywords: ['トリム', '切る', '切り取る', 'はみ出し', 'カット', '削る', 'X'],
    tools: ['trim'],
    html: `
<p>「トリム」は、<b>線の余分な部分を切り取る</b>機能です。ほかの線と交わっている所を境目にして、クリックした部分だけが消えます。</p>
<ol class="help-steps">
<li>「編集」タブの <span class="help-btn">トリム</span> を押します（<kbd>X</kbd>）。</li>
<li>消したい部分の上をクリックします（①）。交わっている点と点の間（または交点から端まで）が消えます。</li>
<li>続けて別の部分もクリックできます。終わったら <kbd>Esc</kbd>。</li>
</ol>
${fig(440, 150, 'トリムの前と後', beforeAfter(200, 110,
    grid(0, 0, 200, 110) + ln(20, 55, 180, 55, { w: 2.5 }) + ln(70, 10, 70, 100, { w: 2.5 }) + ln(130, 10, 130, 100, { w: 2.5 })
    + ln(130, 55, 180, 55, { c: C.hi, w: 4 }) + mark(160, 55, 1),
    grid(0, 0, 200, 110) + ln(20, 55, 130, 55, { w: 2.5 }) + ln(70, 10, 70, 100, { w: 2.5 }) + ln(130, 10, 130, 100, { w: 2.5 })),
    '横線の右側（水色の部分）をクリックすると、交わる所から先が消えます。')}
<div class="help-note">注意: 使えるのは<b>直線だけ</b>です。四角や連続線は先に <a href="#help:explode">分解</a> してください。どこも交わっていない線をクリックしても切れません（画面下に理由が出ます）。</div>`,
  },
  {
    id: 'extend',
    category: 'edit',
    title: '線を伸ばす（延長）',
    keywords: ['延長', 'えんちょう', '伸ばす', '届かせる', 'エクステンド'],
    tools: ['extend'],
    html: `
<p>「延長」は、直線を<b>その先にある図形まで伸ばす</b>機能です。</p>
<ol class="help-steps">
<li>「編集」タブの <span class="help-btn">延長</span> を押します。</li>
<li>伸ばしたい線の、<b>伸ばしたい側の端の近く</b>をクリックします（①）。</li>
<li>線がその向きにまっすぐ伸び、一番近くの図形にぶつかった所で止まります。</li>
</ol>
${fig(440, 140, '延長の前と後', beforeAfter(200, 100,
    grid(0, 0, 200, 100) + ln(20, 50, 100, 50, { w: 2.5 }) + ln(160, 10, 160, 90, { w: 2.5 }) + mark(92, 50, 1) + arrow(105, 50, 150, 50),
    grid(0, 0, 200, 100) + ln(20, 50, 160, 50, { w: 2.5 }) + ln(160, 10, 160, 90, { w: 2.5 })),
    '右の端の近くをクリックしたので、右にある縦線まで伸びました。')}
<div class="help-note">注意: 直線だけに使えます。伸ばした先に何もないと伸びません。</div>`,
  },
  {
    id: 'offset',
    category: 'edit',
    title: '同じ間隔で平行な線を作る（オフセット）',
    keywords: ['オフセット', '平行', '平行線', '内側', '外側', '距離', '肉厚', 'O'],
    tools: ['offset'],
    html: `
<p>「オフセット」は、図形から<b>決まった距離だけ離れた所に、平行なコピーを作る</b>機能です。板の厚みや、ひと回り小さい四角を描くときに便利です。</p>
<ol class="help-steps">
<li>「編集」タブの <span class="help-btn">オフセット</span> を押します（<kbd>O</kbd>）。</li>
<li>となりの「距離」の欄に、離す長さ（mm）を入れます（はじめは 10）。</li>
<li>元にする線・円・円弧・四角をクリックします（①）。</li>
<li>コピーを置きたい<b>側</b>をクリックします（②）。</li>
</ol>
${fig(440, 150, 'オフセットの手順', grid(0, 0, 440, 150) + ln(40, 50, 220, 50, { w: 2.5 }) + ln(40, 100, 220, 100, { w: 2.5, c: C.sel })
    + mark(130, 50, 1) + mark(180, 118, 2, 14, 6) + dimV(50, 100, 220, 245, '10', { c: C.guide })
    + rc(300, 30, 110, 90, { w: 2.5 }) + rc(318, 48, 74, 54, { w: 2.5, c: C.sel }) + mark(300, 75, 1, -12, -12) + mark(355, 75, 2, 0, 0)
    + txt(355, 142, '四角の内側をクリック', { size: 11 }),
    '左：線の下側をクリックして10mm下にコピー。右：四角の内側をクリックしてひと回り小さい四角。')}
<ul>
<li>円や円弧は、内側をクリックすると小さく、外側をクリックすると大きい円ができます。</li>
<li>元の図形はそのまま残ります。</li>
</ul>`,
  },
  {
    id: 'fillet',
    category: 'edit',
    title: '角を丸くする（フィレット）',
    keywords: ['フィレット', '角を丸く', '丸める', 'R', 'アール', '角R', 'F'],
    tools: ['fillet'],
    html: `
<p>「フィレット」は、<b>2本の線が作る角を丸くする</b>機能です。</p>
<ol class="help-steps">
<li>「編集」タブの <span class="help-btn">フィレット</span> を押します（<kbd>F</kbd>）。</li>
<li>「サイズ」の欄に丸みの半径（mm）を入れます（はじめは 5）。</li>
<li>1本目の線をクリックします（①）。</li>
<li>2本目の線をクリックします（②）。角が丸くなり、線は丸みにぴったり合うように自動で短くなります（届いていなければ伸びます）。</li>
</ol>
${fig(440, 150, 'フィレットの前と後', beforeAfter(200, 110,
    grid(0, 0, 200, 110) + ln(30, 90, 150, 90, { w: 2.5 }) + ln(150, 90, 150, 15, { w: 2.5 }) + mark(80, 90, 1, 0, -16) + mark(150, 45, 2, -16, 0),
    grid(0, 0, 200, 110) + path('M30 90 L115 90 A35 35 0 0 0 150 55 L150 15', { w: 2.5 }) + txt(105, 60, 'R5', { size: 11, c: C.guide })),
    '①②の順に2本の線をクリックすると、角が丸くなります。')}
<div class="help-note">注意: 直線どうしだけに使えます。四角の角を丸めるときは、先に <a href="#help:explode">分解</a> してください。サイズが大きすぎて線に入りきらないときは、画面下に理由が出ます。</div>`,
  },
  {
    id: 'chamfer',
    category: 'edit',
    title: '角を斜めに落とす（面取り）',
    keywords: ['面取り', 'めんとり', '角を落とす', '斜め', 'C面', 'チャンファー', '45度'],
    tools: ['chamferEdit'],
    html: `
<p>「面取り」は、<b>角を45°の斜めの線で切り落とす</b>機能です。</p>
<ol class="help-steps">
<li>「編集」タブの <span class="help-btn">面取り</span> を押します。</li>
<li>「サイズ」の欄に、角から切り落とす長さ（mm）を入れます。</li>
<li>1本目の線（①）、2本目の線（②）の順にクリックします。</li>
</ol>
${fig(440, 150, '面取りの前と後', beforeAfter(200, 110,
    grid(0, 0, 200, 110) + ln(30, 90, 150, 90, { w: 2.5 }) + ln(150, 90, 150, 15, { w: 2.5 }) + mark(80, 90, 1, 0, -16) + mark(150, 45, 2, -16, 0),
    grid(0, 0, 200, 110) + path('M30 90 L120 90 L150 60 L150 15', { w: 2.5 }) + dimH(120, 150, 90, 104, '', { c: C.guide }) + txt(120, 70, 'C5', { size: 11, c: C.guide })),
    '角が45°に切り落とされます。')}
<div class="help-note">注意: 直線どうしだけに使えます。四角の角は先に <a href="#help:explode">分解</a> してください。</div>
<div class="help-tip">ヒント: 面取りした所に「C5」のような記号を入れるには、<a href="#help:dimChamfer">C（面取りの寸法）</a> を使います。</div>`,
  },
];

// 寸法の数字を外に出した形(矢印は外側から内向き)
function dimOutside(x1, x2, yPt, yLine, textX, value, c = C.shape) {
  return ln(x1, yPt - 3, x1, yLine - 5, { c, w: 1 }) + ln(x2, yPt - 3, x2, yLine - 5, { c, w: 1 })
    + ln(x1 - 14, yLine, textX + 16, yLine, { c, w: 1 })
    + arrowHead(x1, yLine, 0, 8, c) + arrowHead(x2, yLine, Math.PI, 8, c)
    + txt(textX, yLine - 4, value, { c });
}

// ---- 寸法を入れる ----
const T_DIM = [
  {
    id: 'dimLinear',
    category: 'dim',
    title: '長さの寸法を入れる（寸法）',
    keywords: ['寸法', 'すんぽう', '長さ', '距離', '水平', '垂直', '斜め', '平行寸法', 'D'],
    tools: ['dim'],
    html: `
<p>「寸法」は、2つの点の間の長さを、矢印付きの線と数字で図面に書き入れる機能です。数字は自動で測られます（mm、小数は2けたまで）。</p>
<ol class="help-steps">
<li>「寸法・記号」タブの <span class="help-btn">寸法</span> を押します（<kbd>D</kbd>）。</li>
<li>測りたい1つ目の点をクリックします（①）。図形の角に近づけると吸い付きます。</li>
<li>2つ目の点をクリックします（②）。</li>
<li>寸法の線を置きたい所をクリックします（③）。</li>
</ol>
${fig(440, 190, '寸法の入れ方', grid(0, 0, 440, 190) + rc(90, 50, 200, 80, { w: 2.5 })
    + dimH(90, 290, 50, 25, '100', { c: C.sel }) + mark(90, 50, 1, -14, 12) + mark(290, 50, 2, 14, 12) + mark(190, 25, 3, 20, -2)
    + dimV(50, 130, 290, 330, '40', { c: C.sel }),
    '上の寸法：角①→角②→上の③をクリック。右の寸法は、右の2つの角→右側をクリックしたもの。')}
<h3>横の長さ・縦の長さ・斜めの長さ</h3>
<ul>
<li>③を2点の<b>上か下</b>でクリックすると、<b>横方向の長さ</b>の寸法になります。</li>
<li>③を2点の<b>左か右</b>でクリックすると、<b>縦方向の長さ</b>の寸法になります。</li>
<li>③をクリックするときに <kbd>Shift</kbd> を押していると、2点を結ぶ<b>斜めの線に平行な</b>寸法になります。</li>
</ul>
${fig(440, 150, '斜めの2点に入れた3種類の寸法', grid(0, 0, 440, 150) + ln(150, 110, 290, 40, { w: 2.5 })
    + dimH(150, 290, 110, 132, '140') + dimV(40, 110, 150, 120, '70')
    + `<g transform="rotate(-26.57 220 75)">${dimH(141.7, 298.3, 75, 55, '156.52', { c: C.sel })}</g>`
    + txt(375, 30, '青: Shift を押しながら', { size: 11, c: C.sel }) + txt(375, 46, '線の位置をクリック', { size: 11, c: C.sel }),
    '同じ2点でも、③の場所と Shift で「横」「縦」「斜め」が変わります。')}
<div class="help-note">注意: 寸法は、あとで図形の大きさを変えても<b>自動では変わりません</b>。図形を直したら、寸法を消して入れ直すか、数字を書き換えてください。</div>
<p>関連：<a href="#help:dimValueMove">寸法の数字を動かす</a>／<a href="#help:dimEdit">寸法の値を書き換える・公差を入れる</a></p>`,
  },
  {
    id: 'dimValueMove',
    category: 'dim',
    title: '寸法の数字を動かす（狭い所の寸法）',
    keywords: ['寸法', '数字を動かす', '値の移動', '外側', '矢印', '狭い', '中央に戻す', '寸法補助線'],
    tools: [],
    html: `
<p>寸法の数字は、寸法の線にそって横に<b>すべらせて</b>動かせます。間が狭くて数字や矢印が入らないときに使います。</p>
<ol class="help-steps">
<li><span class="help-btn">選択</span> を押します。</li>
<li>寸法の<b>数字の上</b>でボタンを押し、押したまま左右に動かします（ドラッグ）。</li>
<li>数字は寸法の線と平行にだけ動きます。置きたい所で離します。</li>
</ol>
<h3>数字を外に出すと、矢印の向きが自動で変わります</h3>
<p>測った点から出ている短い線を「寸法補助線（すんぽうほじょせん）」と呼びます。数字を<b>寸法補助線の外側</b>まで動かすと、次のように自動で書き方が変わります。</p>
<ul>
<li>寸法の線が、数字の下まで伸びます。</li>
<li>矢印が外側に移り、<b>外から内側へ向かって</b>寸法補助線を指します。狭い所の寸法の、決まった書き方です。</li>
</ul>
${fig(460, 170, '数字を内側から外側へ動かしたとき', beforeAfter(200, 130,
    grid(0, 0, 200, 130) + ln(60, 105, 140, 105, { w: 2.5 }) + dimH(60, 140, 105, 65, '12') + cursor(112, 68),
    grid(0, 0, 200, 130) + ln(30, 105, 110, 105, { w: 2.5 }) + dimOutside(30, 110, 105, 65, 160, '12')
      + arrow(70, 32, 150, 32) + txt(70, 26, '元の位置', { size: 10 }) + cursor(172, 68),
    ['内側（ふつうの形）', '外側に出したとき']),
    '左：矢印は内側から外向き。右：数字を補助線の外へすべらせると、線が伸びて矢印が外から内向きになります。')}
<ul>
<li>数字を寸法補助線の<b>間</b>に戻すと、ふつうの形（矢印が内側で外向き）に戻ります。</li>
<li>真ん中の近くまで動かすと、<b>ちょうど真ん中</b>に吸い付きます。</li>
<li>寸法を右クリックして「<b>寸法の値を中央に戻す</b>」を選んでも、真ん中に戻ります。</li>
</ul>
<div class="help-tip">ヒント: 数字ではなく<b>寸法の線</b>をドラッグすると、寸法全体（測った点も一緒）が動きます。数字だけを動かしたいときは、数字の上を押してください。マウスが数字の上にあると、操作ガイドに「寸法の値: 押したまま動かすと寸法線に沿って移動」と出ます。</div>`,
  },
  {
    id: 'dimDiaRad',
    category: 'dim',
    title: '円の直径・半径の寸法を入れる（φ・R）',
    keywords: ['φ', 'ファイ', '直径', 'R', 'アール', '半径', '穴径', '円の寸法'],
    tools: ['dia', 'rad'],
    html: `
<h3>直径（φ）</h3>
<p>「φ（ファイ）」は<b>直径</b>（円のはしからはしまでの長さ）を表す記号です。</p>
<ol class="help-steps">
<li>「寸法・記号」タブの <span class="help-btn">φ</span> を押します。</li>
<li>円の線の上をクリックします（①）。クリックした向きに、「φ40」のような寸法が入ります。</li>
</ol>
<h3>半径（R）</h3>
<p>「R（アール）」は<b>半径</b>（中心から円のはしまでの長さ）を表す記号です。丸めた角（円弧）によく使います。</p>
<ol class="help-steps">
<li><span class="help-btn">R</span> を押します。</li>
<li>円または円弧の線の上をクリックします（①）。</li>
</ol>
${fig(440, 160, '直径と半径の寸法', grid(0, 0, 440, 160) + circ(110, 80, 50, { w: 2.5 })
    + ln(74.6, 115.4, 145.4, 44.6, { c: C.sel, w: 1 }) + arrowHead(145.4, 44.6, -Math.PI / 4, 8, C.sel) + arrowHead(74.6, 115.4, Math.PI * 0.75, 8, C.sel)
    + txt(172, 40, 'φ100', { c: C.sel }) + mark(145.4, 44.6, 1, 10, 18)
    + path('M270 130 L340 130 A60 60 0 0 0 400 70 L400 30', { w: 2.5 }) + ln(340, 70, 382.4, 112.4, { c: C.sel, w: 1 }) + arrowHead(382.4, 112.4, Math.PI / 4, 8, C.sel)
    + txt(345, 100, 'R60', { c: C.sel }) + mark(382.4, 112.4, 1, 14, 6),
    '左：円をクリックして直径。右：丸めた角（円弧）をクリックして半径。')}`,
  },
  {
    id: 'dimAngle',
    category: 'dim',
    title: '角度の寸法を入れる',
    keywords: ['角度', 'かくど', '角度寸法', '度', '°', 'テーパ'],
    tools: ['angle'],
    html: `
<ol class="help-steps">
<li>「寸法・記号」タブの <span class="help-btn">角度</span> を押します。</li>
<li>角の<b>頂点</b>（2本の線が出会う点）をクリックします（①）。</li>
<li>1本目の辺の上の点をクリックします（②）。</li>
<li>2本目の辺の上の点をクリックします（③）。頂点から③までの距離で、角度の弧の大きさが決まります。</li>
</ol>
${fig(420, 170, '角度の寸法の入れ方', grid(0, 0, 420, 170) + ln(80, 140, 330, 140, { w: 2.5 }) + ln(80, 140, 266.6, 32.3, { w: 2.5 })
    + path('M210 140 A130 130 0 0 0 192.6 75', { c: C.sel, w: 1 }) + arrowHead(210, 140, Math.PI / 2, 8, C.sel) + arrowHead(192.6, 75, -Math.PI * 2 / 3, 8, C.sel)
    + txt(225, 110, '30°', { c: C.sel, anchor: 'start' }) + mark(80, 140, 1, -14, -10) + mark(300, 140, 2, 0, 16) + mark(192.6, 75, 3, -14, -12),
    '①頂点 → ②1本目の辺 → ③2本目の辺。角度は②の辺から③の辺へ、時計と反対回りに測ります。')}
<div class="help-note">注意: 角度は <b>②の辺から③の辺へ、時計と反対回り</b>に測ります。思った角度（例：30°のはずが330°）と違うときは、②と③の順番を入れ替えてください。</div>`,
  },
  {
    id: 'dimChamfer',
    category: 'dim',
    title: '面取りの寸法を入れる（C）',
    keywords: ['C', 'C面', '面取り寸法', 'シー', '45度'],
    tools: ['chamfer'],
    html: `
<p>45°の面取り（角を斜めに落とした所）には、「C5」のように <b>C＋切り落とした長さ</b> で寸法を書きます。</p>
<ol class="help-steps">
<li>「寸法・記号」タブの <span class="help-btn">C</span> を押します。</li>
<li>45°の斜めの線をクリックします（①）。</li>
<li>文字を置きたい所をクリックします（②）。「C5」のような文字が線付きで入ります。</li>
</ol>
${fig(400, 150, '面取りの寸法', grid(0, 0, 400, 150) + path('M40 120 L230 120 L270 80 L270 20', { w: 2.5 })
    + ln(250, 100, 310, 40, { c: C.sel, w: 1 }) + ln(310, 40, 350, 40, { c: C.sel, w: 1 }) + arrowHead(250, 100, Math.PI * 0.75, 8, C.sel) + txt(330, 35, 'C40', { c: C.sel })
    + mark(250, 100, 1, -16, -6) + mark(340, 40, 2, 10, 18),
    '①斜めの線 → ②文字の場所。')}
<div class="help-note">注意: 45°ではない斜めの線では使えません。その場合は、ふつうの <a href="#help:dimLinear">寸法</a> で長さを入れてください。</div>`,
  },
  {
    id: 'dimEdit',
    category: 'dim',
    title: '寸法の値を書き換える・公差を入れる',
    keywords: ['書き換え', '変更', '公差', '±', 'プラスマイナス', 'ダブルクリック', '値', '編集', 'はめあい'],
    tools: [],
    html: `
<p>寸法の数字は自動で測られますが、自分で書き換えることもできます。「公差（こうさ）」＝仕上がりの許される誤差（例：±0.1）を書き足すときに使います。</p>
<ol class="help-steps">
<li><span class="help-btn">選択</span> を押します。</li>
<li>寸法の数字を<b>ダブルクリック</b>します（右クリック →「値・文字を書き換える」でも同じ）。</li>
<li>入力欄に書きたい文字を入れます。例：<b>50±0.1</b></li>
<li><kbd>Enter</kbd> で確定します。</li>
</ol>
${fig(440, 120, '公差の書き足し', beforeAfter(200, 80,
    grid(0, 0, 200, 80) + rc(40, 50, 120, 25, { w: 2 }) + dimH(40, 160, 50, 25, '50'),
    grid(0, 0, 200, 80) + rc(40, 50, 120, 25, { w: 2 }) + dimH(40, 160, 50, 25, '50±0.1')),
    '数字をダブルクリックして「50±0.1」と書き換えたところ。')}
<ul>
<li>入力欄を<b>空にして</b> <kbd>Enter</kbd> を押すと、自動で測った数字に戻ります。</li>
<li>同じようにダブルクリックで直せるもの：<b>文字</b>、<b>引出線の文字</b>、<b>バルーンの番号</b>、<b>粗さ記号の値</b>、<b>公差枠</b>、<b>部品表のマス</b>、<b>表題欄のマス</b>。</li>
</ul>
<div class="help-note">注意: 書き換えた数字は、図形の大きさとは連動しません。寸法の数字だけが変わります。</div>`,
  },
  {
    id: 'leader',
    category: 'dim',
    title: '矢印で指して説明を書く（引出線）',
    keywords: ['引出線', 'ひきだしせん', '矢印', '注記', 'メモ', '指示', '溶接', '溶接記号', 'M6'],
    tools: ['leader'],
    html: `
<p>「引出線（ひきだしせん）」は、図の一部を<b>矢印で指して、説明の文字を書く</b>ための線です。「4-φ6キリ」「M6」などの指示に使います。</p>
<ol class="help-steps">
<li>「寸法・記号」タブの <span class="help-btn">引出線</span> を押します。</li>
<li>指したい所をクリックします（①）。ここに矢印の先が付きます。</li>
<li>文字を置きたい所をクリックします（②）。</li>
<li>入力欄に文字を打ち、<kbd>Enter</kbd> で確定します。</li>
</ol>
${fig(420, 150, '引出線の入れ方', grid(0, 0, 420, 150) + rc(40, 60, 170, 70, { w: 2.5 }) + circ(125, 95, 14, { w: 2.5 })
    + ln(135, 85, 205, 30, { c: C.sel, w: 1 }) + ln(205, 30, 290, 30, { c: C.sel, w: 1 }) + arrowHead(135, 85, Math.PI * 0.79, 9, C.sel)
    + txt(212, 25, 'M6 深さ10', { c: C.sel, anchor: 'start' }) + mark(135, 85, 1, 18, 8) + mark(205, 30, 2, -14, -12),
    '①指す場所 → ②文字の場所 → 文字を打って Enter。')}
<div class="help-tip">ヒント: 溶接の記号を入れる専用の道具はありません。引出線を使い、文字で溶接の指示を書いてください。</div>`,
  },
];

// ---- 記号・表・斜線 ----
const T_SYMBOL = [
  {
    id: 'roughness',
    category: 'symbol',
    title: '表面の仕上げ記号を入れる（粗さ）',
    keywords: ['粗さ', 'あらさ', '表面粗さ', 'Ra', '仕上げ', '仕上げ記号', '三角記号'],
    tools: ['roughness'],
    html: `
<p>「粗さ」の記号は、<b>表面をどのくらいなめらかに仕上げるか</b>を示す記号です。数字（Ra）が小さいほど、なめらかな仕上げです。</p>
<ol class="help-steps">
<li>「寸法・記号」タブの <span class="help-btn">粗さ</span> を押します。</li>
<li>記号を置きたい所（仕上げる面の線の上など）をクリックします（①）。はじめは「Ra 6.3」で置かれます。</li>
<li>値を変えるには、<span class="help-btn">選択</span> で記号を<b>ダブルクリック</b>し、数字（例：Ra 1.6）を入れて <kbd>Enter</kbd>。</li>
</ol>
${fig(400, 130, '粗さ記号', grid(0, 0, 400, 130) + ln(40, 100, 360, 100, { w: 2.5 })
    + path('M160 80 L175 100 L205 50 L250 50', { w: 1.5 }) + ln(160, 80, 190, 80, { w: 1.5 }) + txt(218, 44, 'Ra 6.3', { c: '#222' }) + mark(175, 100, 1, -16, 12),
    '面の線の上に置いた粗さ記号。')}`,
  },
  {
    id: 'fcf',
    category: 'symbol',
    title: '形の精度を指示する枠（公差枠）',
    keywords: ['公差枠', '幾何公差', '平行度', '直角度', '平面度', 'データム', '枠'],
    tools: ['fcf'],
    html: `
<p>「公差枠（こうさわく）」は、「この面はA面と平行に、ずれは0.05mm以内」のような<b>形の正確さの指示</b>を、区切られた枠の中に書くものです。</p>
<ol class="help-steps">
<li>「寸法・記号」タブの <span class="help-btn">公差枠</span> を押します。</li>
<li>枠を置きたい所をクリックします（①）。</li>
<li><span class="help-btn">選択</span> で枠を<b>ダブルクリック</b>し、マスごとの内容を <b>|</b>（縦棒）で区切って入れます。例：<b>//|0.05|A</b></li>
<li><kbd>Enter</kbd> で確定します。</li>
</ol>
${fig(400, 110, '公差枠の例', grid(0, 0, 400, 110) + rc(110, 35, 150, 30, { w: 1.5 }) + ln(150, 35, 150, 65, { w: 1.5 }) + ln(220, 35, 220, 65, { w: 1.5 })
    + txt(130, 55, '//', { c: '#222', size: 14 }) + txt(185, 55, '0.05', { c: '#222', size: 14 }) + txt(240, 55, 'A', { c: '#222', size: 14 })
    + txt(200, 92, '「//|0.05|A」と入力すると3つのマスになります', { size: 11 }),
    '縦棒 | で区切った数だけマスができます。「//」は平行を表す記号です。')}
<div class="help-tip">ヒント: 縦棒 <kbd>|</kbd> は、日本語キーボードでは <kbd>Shift</kbd>+<kbd>￥</kbd> で入力できます。</div>`,
  },
  {
    id: 'hatch',
    category: 'symbol',
    title: '切り口に斜線を入れる（ハッチ）',
    keywords: ['ハッチ', 'ハッチング', '斜線', '断面', '切り口', 'H', '塗りつぶし'],
    tools: ['hatch'],
    html: `
<p>「ハッチ」は、部品を切った<b>切り口（断面）を示すための細い斜線</b>を、形の中に並べて描く機能です。</p>
<ol class="help-steps">
<li>「寸法・記号」タブの <span class="help-btn">ハッチ</span> を押します（<kbd>H</kbd>）。</li>
<li>「角度」（はじめは 45）と「間隔」（線と線の間、はじめは 3mm）を必要なら変えます。</li>
<li>斜線を入れたい<b>閉じた形の線</b>（矩形・円・楕円・閉じた連続線）をクリックします（①）。</li>
</ol>
${fig(440, 150, 'ハッチの前と後', beforeAfter(200, 110,
    grid(0, 0, 200, 110) + rc(40, 20, 120, 70, { w: 2.5 }) + mark(160, 55, 1),
    grid(0, 0, 200, 110) + `<clipPath id="help-hatch-clip"><rect x="40" y="20" width="120" height="70"/></clipPath><g clip-path="url(#help-hatch-clip)">${
      Array.from({ length: 16 }, (_, i) => ln(40 + i * 12 - 70, 90, 40 + i * 12, 20, { w: 1 })).join('')}</g>` + rc(40, 20, 120, 70, { w: 2.5 })),
    '四角の線をクリックすると、中に45°の斜線が入ります。')}
<div class="help-note">注意: 閉じていない形（ただの直線を組み合わせた形など）には入りません。斜線を入れたい部分は、矩形や円で描いておくと確実です。</div>`,
  },
  {
    id: 'balloon',
    category: 'symbol',
    title: '部品に番号を付ける（バルーン）',
    keywords: ['バルーン', '番号', '品番', '丸数字', '部品番号', 'B'],
    tools: ['balloon'],
    html: `
<p>「バルーン」は、組み立て図などで<b>部品を線で指し、丸の中に番号を書く</b>ものです。</p>
<ol class="help-steps">
<li>「寸法・記号」タブの <span class="help-btn">バルーン</span> を押します（<kbd>B</kbd>）。</li>
<li>番号を付けたい部品をクリックします（①）。</li>
<li>丸を置きたい所をクリックします（②）。</li>
<li>番号は 1、2、3… と自動で付きます。変えたいときは丸をダブルクリックして書き換えます。</li>
</ol>
${fig(420, 150, 'バルーンの付け方', grid(0, 0, 420, 150) + rc(40, 70, 140, 60, { w: 2.5 }) + rc(180, 90, 80, 40, { w: 2.5 })
    + ln(110, 100, 150, 40, { c: C.sel, w: 1 }) + circ(110, 100, 2.5, { c: C.sel, fill: C.sel, w: 1 }) + circ(162, 30, 15, { c: C.sel, w: 1.5 }) + txt(162, 35, '1', { c: C.sel, size: 14 })
    + ln(230, 110, 290, 45, { c: C.sel, w: 1 }) + circ(230, 110, 2.5, { c: C.sel, fill: C.sel, w: 1 }) + circ(302, 35, 15, { c: C.sel, w: 1.5 }) + txt(302, 40, '2', { c: C.sel, size: 14 })
    + mark(110, 100, 1, -14, 12) + mark(177, 30, 2, 14, -12),
    '①部品 → ②丸の場所。2つ目は自動で「2」になります。')}
<p>番号を付けたら、<a href="#help:bom">部品表</a> を作ると番号の行が自動でできます。</p>`,
  },
  {
    id: 'bom',
    category: 'symbol',
    title: '部品の一覧表を作る（部品表）',
    keywords: ['部品表', 'ぶひんひょう', '表', '品名', '数量', '材質', '一覧', 'パーツリスト'],
    tools: ['bom'],
    html: `
<p>「部品表」は、<b>品番・品名・数量・材質</b>を並べた表です。</p>
<ol class="help-steps">
<li>先に <a href="#help:balloon">バルーン</a> で部品に番号を付けておきます。</li>
<li>「寸法・記号」タブの <span class="help-btn">部品表</span> を押します。</li>
<li>表の<b>左下の角</b>にしたい所をクリックします（①）。バルーンの番号の数だけ行ができます（バルーンがないときは、空の行が3つできます）。</li>
<li>空いているマスを <span class="help-btn">選択</span> で<b>ダブルクリック</b>し、品名などを入れて <kbd>Enter</kbd>。</li>
</ol>
${fig(420, 130, '部品表', (() => {
      let s = grid(0, 0, 420, 130);
      const xs = [60, 100, 250, 290, 370];
      const ys = [20, 45, 70, 95];
      xs.forEach((x) => { s += ln(x, 20, x, 95, { w: 1.2 }); });
      ys.forEach((y) => { s += ln(60, y, 370, y, { w: 1.2 }); });
      const rows = [['品番', '品名', '数量', '材質'], ['1', 'ベース', '1', 'SS400'], ['2', 'ピン', '4', 'S45C']];
      rows.forEach((r, i) => r.forEach((t, j) => {
        s += txt((xs[j] + xs[j + 1]) / 2, ys[i] + 17, t, { c: '#222', bold: i === 0 });
      }));
      return s + mark(60, 95, 1, -14, 12);
    })(), '①をクリックした所が表の左下になります。いちばん上が見出しの行で、その下に 1、2… の行が並びます。')}
<div class="help-tip">ヒント: 表の文字の大きさを「文字」メニューで変えると、表全体の大きさも合わせて変わります。</div>`,
  },
];

// ---- 線の種類・太さ・文字の大きさ ----
const T_STYLE = [
  {
    id: 'lineTypes',
    category: 'style',
    title: '線の種類を使い分ける（線種）',
    keywords: ['線種', 'せんしゅ', '外形線', 'かくれ線', '隠れ線', '点線', '破線', '中心線', '一点鎖線', '想像線', '二点鎖線', '細実線', '補助線', '印刷されない'],
    tools: [],
    html: `
<p>図面では、線の見た目で意味を区別します。右上の <span class="help-btn">線種</span> メニューで選びます。</p>
${fig(440, 190, '線の種類の見本', [
    ['外形線', '見えている形のふち', { w: 3 }],
    ['かくれ線', '裏に隠れて見えない形', { w: 2, dash: '8 4' }],
    ['中心線', '穴や丸い物の中心', { w: 1.2, dash: '18 3 3 3' }],
    ['想像線', '動いた位置・となりの部品', { w: 1.2, dash: '18 3 3 3 3 3' }],
    ['細実線', 'ねじの谷など細い線（印刷する）', { w: 1 }],
    ['補助線', '下書き用（印刷されない）', { w: 1, c: '#999' }],
  ].map(([n, d, o], i) => txt(10, 26 + i * 30, n, { anchor: 'start', c: '#222', bold: true }) + ln(80, 22 + i * 30, 220, 22 + i * 30, o) + txt(235, 26 + i * 30, d, { anchor: 'start' })).join(''),
    '線種ごとの見た目と使い道。')}
<ul>
<li><b>外形線</b>（太い実線）：外から見える部品の形。いちばんよく使います。</li>
<li><b>かくれ線</b>（点線）：内側の穴など、外から見えない部分。</li>
<li><b>中心線</b>（長い線と点のくり返し）：穴や円柱の中心、左右対称の中心。</li>
<li><b>想像線</b>（長い線と2つの点のくり返し）：動いたときの位置や、となりにある部品など、実際にはない物。</li>
<li><b>細実線</b>（細い実線）：ねじの谷など。印刷されます。</li>
<li><b>補助線</b>（細い線）：位置決めのための下書き。<b>画面には出ますが、印刷やSVG出力には出ません</b>。</li>
</ul>
<h3>使い方</h3>
<ul>
<li><b>これから描く線</b>：描く道具（直線など）を選んでから線種を選ぶと、その後に描く図形がその線種になります。</li>
<li><b>描いた線を変える</b>：<span class="help-btn">選択</span> で図形を選んでから線種を選ぶと、すぐに変わります（右クリックの「線種 ▸」でも同じ）。</li>
</ul>
<p>詳しくは <a href="#help:widthText">太さと文字の大きさ</a> と <a href="#help:centerLineMode">中心線を引くときの便利機能</a> をご覧ください。</p>`,
  },
  {
    id: 'widthText',
    category: 'style',
    title: '線の太さ・文字の大きさを変える',
    keywords: ['太さ', 'ふとさ', '線の太さ', '文字', '文字の大きさ', '文字サイズ', '混在', '標準', 'mm'],
    tools: [],
    html: `
<p>右上に並ぶ <span class="help-btn">線種</span><span class="help-btn">太さ</span><span class="help-btn">文字</span> の3つのメニューは、どれも同じ考え方で働きます。</p>
${fig(440, 140, '3つのメニューの働き方', btnRow(10, 10, ['線種: 外形線 ▾', '太さ: 標準 ▾', '文字: 3.5 ▾'], { size: 11 }).s
    + txt(10, 60, '選択中の図形がある', { anchor: 'start', bold: true, c: '#222' }) + arrow(130, 56, 160, 56, { solid: true }) + txt(168, 60, 'その図形をすぐ変える（元に戻すもできる）', { anchor: 'start' })
    + txt(10, 88, '描く道具を選んでいる', { anchor: 'start', bold: true, c: '#222' }) + arrow(130, 84, 160, 84, { solid: true }) + txt(168, 88, 'これから描く図形の設定', { anchor: 'start' })
    + txt(10, 116, '何も選んでいない', { anchor: 'start', bold: true, c: '#222' }) + arrow(130, 112, 160, 112, { solid: true }) + txt(168, 116, '「—」と灰色で表示（使えない）', { anchor: 'start' }),
    '状況によって、メニューが何を変えるかが決まります。')}
<h3>描いた図形を変える</h3>
<ol class="help-steps">
<li><span class="help-btn">選択</span> で図形を選びます。メニューに、選んだ図形の今の設定が表示されます。</li>
<li>メニューから値を選ぶと、選んだ図形がすぐ変わります。</li>
</ol>
<ul>
<li>いくつも選んだ図形の設定がばらばらのときは「<b>混在</b>」と表示されます。選べば全部そろいます。</li>
<li>関係のない図形は変わりません（文字には線の太さがなく、線には文字の大きさがありません。線種は線や円などに使い、寸法や文字には使いません）。</li>
</ul>
<h3>これから描く図形の設定</h3>
<p>描く道具を選んでいるときは、次に作る図形の設定になります。設定は次の3つのグループで<b>別々に</b>覚えています。</p>
<ul>
<li><b>図形</b>（直線〜スプライン）</li>
<li><b>文字</b></li>
<li><b>寸法・記号</b></li>
</ul>
<p>たとえば題名の文字を 7mm にしても、寸法の数字は 3.5mm のままです。</p>
<h3>選べる値</h3>
<ul>
<li><b>太さ</b>：「標準」＝線種どおり（外形線 0.5mm、かくれ線 0.35mm、そのほか 0.25mm）。または 0.13〜1.4mm。</li>
<li><b>文字</b>：1.8〜20mm（はじめは 3.5mm）。</li>
</ul>
${fig(420, 110, '文字の大きさを変えた寸法', beforeAfter(190, 70, rc(30, 50, 130, 20, { w: 2 }) + dimH(30, 160, 50, 30, '80'),
    rc(30, 50, 130, 20, { w: 2 }) + ln(30, 47, 30, 20, { w: 1 }) + ln(160, 47, 160, 20, { w: 1 }) + ln(30, 25, 160, 25, { w: 1 }) + arrowHead(30, 25, Math.PI, 12, C.shape) + arrowHead(160, 25, 0, 12, C.shape) + txt(95, 20, '80', { size: 20, c: '#222' }),
    ['文字 3.5', '文字 7']), '寸法の文字を大きくすると、矢印なども合わせて大きくなります。')}
<div class="help-note">注意: 太さと文字の大きさは<b>印刷した紙の上での大きさ</b>です。縮尺（1:2など）を変えても、紙の上では同じ太さ・大きさで印刷されます。寸法・バルーン・部品表・記号は、文字の大きさに合わせて枠や丸も大きくなります。</div>`,
  },
  {
    id: 'centerLineMode',
    category: 'style',
    title: '中心線を引くときの便利機能（中心線モード）',
    keywords: ['中心線', '中心線モード', '中心', '十字', 'はみ出す', '軸', '一点鎖線'],
    tools: [],
    html: `
<p>線種を「<b>中心線</b>」にして直線などを描くと、中心線を引きやすくする特別な動きになります。</p>
<ol class="help-steps">
<li>「作図」タブの <span class="help-btn">直線</span> を押し、<span class="help-btn">線種</span> を「中心線」にします。</li>
<li>図形にマウスを近づけると、<b>辺の真ん中</b>や<b>円の中心</b>に印が出て、そこから横と縦に青い案内の線（軸）が伸びます。</li>
<li>マウスはその軸の上に吸い付きます。<b>図形の外にはみ出した所</b>でも軸の上なら吸い付くので、形より少し長い中心線が引けます。</li>
</ol>
${fig(420, 170, '中心線モード', grid(0, 0, 420, 170) + rc(130, 45, 160, 80, { w: 2.5 })
    + ln(20, 85, 400, 85, { c: C.guide, w: 1, dash: '4 4' }) + ln(210, 8, 210, 162, { c: C.guide, w: 1, dash: '4 4' })
    + path('M204 51 L210 45 L216 51', { c: C.mark, w: 1.5 }) + path('M136 79 L130 85 L136 91', { c: C.mark, w: 1.5 })
    + ln(110, 85, 310, 85, { w: 1.2, dash: '18 3 3 3' }) + mark(110, 85, 1, -12, -14) + mark(310, 85, 2, 12, -14) + cursor(310, 85),
    '四角の辺の真ん中から青い軸が出ます。①②は四角の外ですが、軸の上なのでぴったり中心の高さに合います。')}
<div class="help-note">注意: このモードの間は、ふつうの「角に吸い付く」働きは止まります。ほかの線種に戻すと元に戻ります。</div>`,
  },
];

// ---- 正確に描くための機能 ----
const T_ASSIST = [
  {
    id: 'gridSnap',
    category: 'assist',
    title: '方眼に吸い付けて描く（グリッド・スナップ）',
    keywords: ['グリッド', '方眼', 'マス目', 'スナップ', '吸い付く', '吸着', '間隔', '自動', '手動'],
    tools: [],
    html: `
<p>「グリッド」は、用紙に見えている<b>方眼紙のような薄いマス目</b>です。「スナップ」は、クリックした位置を<b>近くのマス目の交わる点に吸い付ける</b>働きです。</p>
${fig(420, 140, 'スナップで方眼の交点に吸い付く', grid(0, 0, 420, 140, 20) + cursor(127, 67) + arrow(127, 67, 140, 60, { c: C.mark, size: 7 }) + circ(140, 60, 5, { c: C.mark, w: 2 })
    + ln(140, 60, 300, 100, { w: 2.5 }) + circ(300, 100, 5, { c: C.mark, w: 2 }) + txt(300, 128, 'クリックはマス目の交点に合う', { size: 11 }),
    'マウスが少しずれていても、近くの交点（オレンジの丸）に合わせて描かれます。')}
<h3>設定のしかた（「表示・設定」タブ）</h3>
<ul>
<li><b>スナップ</b>のチェック：入れるとマス目に吸い付きます。外すと自由な位置になります。</li>
<li><b>グリッド 自動</b>：拡大・縮小に合わせて、マス目の間隔が見やすく自動で変わります。</li>
<li><b>グリッド 手動</b>：間隔を 10・5・2・1・0.5・0.1mm から選んで固定します。</li>
</ul>
<p>今のマス目の間隔は、画面下の状態表示に出ています。</p>
<div class="help-tip">ヒント: 図形の角や円の中心に合わせたいときは、<a href="#help:pointSnap">点スナップ</a> を使います。</div>`,
  },
  {
    id: 'pointSnap',
    category: 'assist',
    title: '図形の角や中心に吸い付ける（点スナップ）',
    keywords: ['点スナップ', '端点', '中点', '中心', '四半点', '交点', '吸い付く', 'マーカー', '印'],
    tools: [],
    html: `
<p>「点スナップ」をオンにすると、マウスが<b>描いてある図形の特別な点</b>に近づいたとき、印が出てそこに吸い付きます。</p>
${fig(440, 150, '点スナップの印', grid(0, 0, 440, 150) + ln(30, 90, 210, 90, { w: 2.5 }) + ln(170, 30, 170, 130, { w: 2.5 }) + circ(320, 75, 45, { w: 2.5 })
    + rc(25, 85, 10, 10, { c: C.mark, w: 1.8 }) + path('M120 83 L126 94 L114 94 Z', { c: C.mark, w: 1.8 })
    + path('M165 85 L175 95 M175 85 L165 95', { c: C.mark, w: 2 }) + circ(320, 75, 5, { c: C.mark, w: 1.8 }) + circ(365, 75, 5, { c: C.mark, w: 1.8 }) + circ(320, 30, 5, { c: C.mark, w: 1.8 })
    + txt(30, 118, '□ 端', { anchor: 'start' }) + txt(120, 118, '△ 真ん中') + txt(182, 80, '× 交わる点', { anchor: 'start' }) + txt(320, 140, '○ 中心・4分の1の点'),
    '印の形で、どの点に吸い付いたかが分かります。')}
<ul>
<li><b>□ 端</b>：線の端、四角の角。</li>
<li><b>△ 真ん中</b>：線のちょうど真ん中。</li>
<li><b>○ 中心と4分の1の点</b>：円の中心と、円の上下左右の点。</li>
<li><b>× 交わる点</b>：線と線が交わる点。</li>
</ul>
<p>「表示・設定」タブの「<b>点スナップ</b>」のチェックでオン・オフします。</p>
<div class="help-tip">ヒント: 寸法を入れるときは、点スナップで角に吸い付けると正確な長さになります。</div>`,
  },
  {
    id: 'projection',
    category: 'assist',
    title: '三面図の位置をそろえる（投影ガイド・45°線）',
    keywords: ['投影ガイド', '三面図', '第三角法', '正面図', '平面図', '側面図', '45°線', '45度線', '45°線配置', 'そろえる', '奥行き'],
    tools: ['mirror45'],
    html: `
<p>「三面図」は、部品を<b>正面・上・右横</b>から見た3つの図を並べて描く方法です。日本の機械図面では、<b>正面図の上に上から見た図（平面図）</b>、<b>正面図の右に右から見た図（側面図）</b>を置きます（第三角法）。3つの図の位置がぴったりそろっている必要があり、それを助けるのが「投影ガイド」と「45°線」です。</p>
${fig(460, 230, '三面図と投影ガイド・45°線', grid(0, 0, 460, 230)
    // 平面図(上)
    + rc(60, 20, 120, 50, { w: 2.5 }) + txt(120, 14, '上から見た図', { size: 11 })
    // 正面図
    + rc(60, 120, 120, 70, { w: 2.5, c: C.sel }) + txt(120, 206, '正面図', { size: 11 })
    // 側面図
    + rc(250, 120, 50, 70, { w: 2.5 }) + txt(275, 206, '右から見た図', { size: 11 })
    // ガイド(正面図から)
    + ln(60, 8, 60, 225, { c: C.guide, w: 1, dash: '5 4' }) + ln(180, 8, 180, 225, { c: C.guide, w: 1, dash: '5 4' })
    + ln(10, 120, 450, 120, { c: C.guide, w: 1, dash: '5 4' }) + ln(10, 190, 450, 190, { c: C.guide, w: 1, dash: '5 4' })
    // 45°線と奥行き転写
    + ln(235, 85, 315, 5, { c: C.mark, w: 2 })
    + arrow(180, 20, 300, 20, { c: C.mark, dash: '2 3', size: 7 }) + arrow(180, 70, 250, 70, { c: C.mark, dash: '2 3', size: 7 })
    + arrow(300, 20, 300, 118, { c: C.mark, dash: '2 3', size: 7 }) + arrow(250, 70, 250, 118, { c: C.mark, dash: '2 3', size: 7 })
    + txt(322, 18, '45°線', { size: 11, c: C.mark, anchor: 'start' }) + txt(322, 56, '上の図の奥行きを', { size: 11, anchor: 'start' }) + txt(322, 72, '45°線で折り返して', { size: 11, anchor: 'start' }) + txt(322, 88, '右の図へ移す', { size: 11, anchor: 'start' }),
    '正面図（青）を選ぶと、角から縦横に青い点線が伸びます。上の図の奥行きは、オレンジの45°線で折り返して右の図へ移せます。')}
<h3>投影ガイドの使い方</h3>
<ol class="help-steps">
<li>「表示・設定」タブの「<b>投影ガイド</b>」にチェックを入れます。</li>
<li><span class="help-btn">選択</span> で、もとにする図（例：正面図）を選びます。</li>
<li>選んだ図形の角や中心から、用紙の端まで<b>青い点線</b>が縦と横に伸びます。</li>
<li>描く道具に切り替えて描くと、クリックがこの点線や点線どうしの交わる所に吸い付くので、上の図や横の図の位置をそろえられます。</li>
</ol>
<h3>45°線で奥行きを移す</h3>
<ol class="help-steps">
<li>「表示・設定」タブの <span class="help-btn">45°線配置</span> を押します。</li>
<li>上から見た図の右、横から見た図の上あたり（2つの図の角が向き合う所）をクリックすると、<b>オレンジの45°の線</b>が置かれます。</li>
<li>上から見た図を選ぶと、横に伸びた青い点線が45°線に当たって<b>下向きに折れ曲がり</b>、横から見た図の奥行きの位置を示します。</li>
</ol>
<p>「<b>45°線</b>」のチェックを外すと、45°線を隠せます。</p>
<div class="help-note">注意: 投影ガイドと45°線は、描くための目印です。印刷やSVG出力には出ません。</div>`,
  },
  {
    id: 'origin',
    category: 'assist',
    title: '位置の基準を決める（原点設定）',
    keywords: ['原点', 'げんてん', '原点設定', '座標', '基準', '0', 'ゼロ', 'X', 'Y'],
    tools: ['origin'],
    html: `
<p>「原点（げんてん）」は、位置を数字で表すときの<b>0の場所</b>です。画面ではオレンジの十字で表示され、はじめは用紙の枠の左下の内側にあります。位置は原点から<b>右と上がプラス</b>です。</p>
<ol class="help-steps">
<li>「表示・設定」タブの <span class="help-btn">原点設定</span> を押します。</li>
<li>新しく0にしたい点（例：部品の左下の角）をクリックします（①）。</li>
</ol>
${fig(440, 150, '原点を部品の角に移す', beforeAfter(200, 110,
    grid(0, 0, 200, 110) + originMark(15, 100) + rc(70, 30, 100, 50, { w: 2.5 }) + txt(120, 20, '角の位置 X55 Y20', { size: 10 }),
    grid(0, 0, 200, 110) + rc(70, 30, 100, 50, { w: 2.5 }) + originMark(70, 80) + mark(70, 80, 1, -14, 14) + txt(120, 20, '角の位置 X0 Y0', { size: 10 })),
    '原点を角に移すと、角からの距離でそのまま位置を入力できます。')}
<div class="help-note">注意: 原点を移しても、<b>図形は動きません</b>。位置の数字の数え方が変わるだけです。</div>`,
  },
];

// ---- 用紙・図面の設定 ----
const T_PAPER = [
  {
    id: 'paperScale',
    category: 'paper',
    title: '用紙の大きさ・向きと縮尺',
    keywords: ['用紙', 'ようし', 'A3', 'A4', 'A2', 'B4', 'B5', 'B3', '横', '縦', '縮尺', 'しゅくしゃく', '尺度', '1:2', '2:1', 'スケール'],
    tools: [],
    html: `
<h3>用紙の大きさと向き</h3>
<ol class="help-steps">
<li>「表示・設定」タブを開きます。</li>
<li>「用紙」のメニューで大きさ（A2・A3・A4・B3・B4・B5）を選びます。</li>
<li>となりで「横」か「縦」を選びます。</li>
</ol>
<h3>縮尺（しゅくしゃく）</h3>
<p>「縮尺」は、<b>実物を紙の上で何分の1の大きさで描くか</b>です。「1:2」なら紙の上では実物の半分、「2:1」なら2倍、「1:1」なら実物と同じ大きさです。</p>
${fig(440, 150, '縮尺 1:1 と 1:2', beforeAfter(200, 110,
    rc(10, 5, 180, 100, { c: '#bbb', w: 1, fill: '#fff' }) + rc(20, 15, 160, 80, { w: 2.5 }) + txt(100, 60, '長さ200の部品'),
    rc(10, 5, 180, 100, { c: '#bbb', w: 1, fill: '#fff' }) + rc(60, 35, 80, 40, { w: 2.5 }) + txt(100, 95, '紙の上では半分', { size: 11 }) + dimH(60, 140, 35, 22, '200', { c: C.sel }),
    ['縮尺 1:1', '縮尺 1:2']), '1:2にすると紙の上では半分に見えますが、寸法は実物の長さ（200）のままです。')}
<ul>
<li>図形は、いつも<b>実物の大きさ（mm）</b>で入力します。縮尺を変えても数字を計算し直す必要はありません。</li>
<li>線の太さや文字の大きさは、縮尺を変えても紙の上で同じです。</li>
<li>大きな部品が用紙に入らないときは、縮尺を 1:2 や 1:5 にします。小さな部品は 2:1 などで大きく描けます。</li>
<li>縮尺は、表題欄の「尺度」に自動で書き込まれます。</li>
</ul>`,
  },
  {
    id: 'layers',
    category: 'paper',
    title: '線のグループごとに表示・印刷を切り替える（レイヤー）',
    keywords: ['レイヤー', '層', '表示', '印刷', '非表示', '隠す', '補助線', 'グループ'],
    tools: [],
    html: `
<p>「レイヤー」は、図形を<b>種類ごとに分けたグループ</b>です。透明なシートを重ねているようなもので、グループごとに見せる・隠す、印刷する・しないを決められます。</p>
<p>グループは「外形線」「かくれ線」「中心線」「寸法」「注記」「補助線」の6つです。</p>
${fig(360, 150, 'レイヤーの設定欄', (() => {
      let s = rc(10, 5, 340, 140, { c: '#ccd', w: 1, fill: '#fff' }) + txt(120, 22, 'レイヤー', { bold: true, c: '#222', anchor: 'start' }) + txt(230, 22, '表示') + txt(290, 22, '印刷');
      ['外形線', 'かくれ線', '中心線', '寸法', '注記', '補助線'].forEach((n, i) => {
        const y = 42 + i * 17;
        const print = n !== '補助線';
        s += txt(120, y, n, { anchor: 'start', c: '#222' });
        s += rc(224, y - 10, 11, 11, { c: '#666', w: 1, fill: C.guide }) + path(`M226 ${y - 4} L229 ${y - 1} L234 ${y - 8}`, { c: '#fff', w: 1.6 });
        s += print ? rc(284, y - 10, 11, 11, { c: '#666', w: 1, fill: C.guide }) + path(`M286 ${y - 4} L289 ${y - 1} L294 ${y - 8}`, { c: '#fff', w: 1.6 }) : rc(284, y - 10, 11, 11, { c: '#666', w: 1, fill: '#fff' });
      });
      return s;
    })(), 'はじめの状態。補助線だけ「印刷」のチェックが外れています。')}
<ol class="help-steps">
<li>「表示・設定」タブの「レイヤー」の欄を開きます。</li>
<li><b>表示</b>のチェックを外すと、そのグループの図形が画面から見えなくなります（消えたわけではありません）。</li>
<li><b>印刷</b>のチェックを外すと、印刷とSVG出力に出なくなります。</li>
</ol>
<div class="help-tip">ヒント: 補助線ははじめから「印刷」が外れているので、下書きの線を残したまま、きれいな図面を印刷できます。</div>`,
  },
  {
    id: 'titleBlock',
    category: 'paper',
    title: '表題欄に図面の名前などを書く',
    keywords: ['表題欄', 'ひょうだいらん', '図番', '図名', '材質', '作成者', '日付', '尺度', 'タイトル'],
    tools: [],
    html: `
<p>「表題欄（ひょうだいらん）」は、用紙の右下にある、<b>図面の名前や作った人などを書く表</b>です。</p>
<ol class="help-steps">
<li><span class="help-btn">選択</span> を押します。</li>
<li>書きたいマスを<b>ダブルクリック</b>します。</li>
<li>文字を入れて <kbd>Enter</kbd> を押します。</li>
</ol>
${fig(320, 200, '表題欄', (() => {
      // 実際の表題欄と同じ並び: 左に項目名、右に中身の7行
      const rows = [['図番', 'BP-001'], ['図名', 'ベースプレート'], ['尺度', '1:1（自動）'], ['用紙', 'A3 横（自動）'],
        ['材質', 'SS400'], ['作成者', '山田'], ['日付', '2026/09/15']];
      const x0 = 30, y0 = 10, w = 260, rowH = 25, labelW = 70;
      let s = rc(x0, y0, w, rowH * rows.length, { w: 2 }) + ln(x0 + labelW, y0, x0 + labelW, y0 + rowH * rows.length, { w: 1 });
      rows.forEach(([k, v], i) => {
        const y = y0 + i * rowH;
        if (i > 0) s += ln(x0, y, x0 + w, y, { w: 1 });
        const auto = v.includes('自動');
        s += txt(x0 + 8, y + 17, k, { anchor: 'start', size: 11 })
          + txt(x0 + labelW + 10, y + 17, v, { anchor: 'start', c: auto ? '#888' : '#222', size: 13 });
      });
      return s;
    })(), '表題欄の例。灰色の2行（尺度・用紙）は自動で入り、書き換えはできません。')}
<ul>
<li>書き込めるマス：<b>図番</b>（図面の番号）、<b>図名</b>（部品の名前）、<b>材質</b>、<b>作成者</b>、<b>日付</b>。</li>
<li><b>尺度</b>と<b>用紙</b>は、設定に合わせて自動で入ります。</li>
<li><b>日付</b>は、はじめは図面を作った日が入っています。</li>
</ul>`,
  },
];

// ---- 保存・印刷 ----
const T_FILE = [
  {
    id: 'saveOpen',
    category: 'file',
    title: '保存する・開く・新しく作る',
    keywords: ['保存', 'ほぞん', '開く', 'ひらく', '新規', '名前を付けて保存', '上書き', 'json', 'ファイル', '復元', '破棄', 'Ctrl+S', 'Ctrl+O'],
    tools: [],
    html: `
<p>図面は <b>.json</b> という種類のファイルに保存します。「ファイル」タブのボタンを使います。</p>
${fig(420, 50, 'ファイルタブのボタン', btnRow(10, 12, ['新規', '開く', '保存', '名前を付けて保存', 'SVG出力', '印刷'], { size: 12 }).s, '「ファイル」タブのボタン。')}
<h3>保存する</h3>
<ul>
<li><span class="help-btn">保存</span>（<kbd>Ctrl</kbd>+<kbd>S</kbd>）：初めてのときは保存場所と名前を聞かれます。Chrome や Edge では、2回目からは<b>同じファイルに上書き</b>されます。ほかのブラウザでは、毎回「ダウンロード」フォルダなどに保存されます。</li>
<li><span class="help-btn">名前を付けて保存</span>（<kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>S</kbd>）：別の名前や場所で保存します。元のファイルはそのまま残ります。</li>
</ul>
<h3>開く</h3>
<ul>
<li><span class="help-btn">開く</span>（<kbd>Ctrl</kbd>+<kbd>O</kbd>）を押して、保存した .json ファイルを選びます。</li>
<li>パソコンのフォルダから .json ファイルをつかんで（ドラッグして）、この画面の上で離しても開けます。</li>
</ul>
${fig(420, 120, 'ファイルを画面に持ってきて開く', rc(10, 20, 120, 80, { c: '#bbb', w: 1, fill: '#f6f7f9' }) + txt(70, 14, 'フォルダ', { size: 11 })
    + path('M50 45 L70 45 L78 53 L78 80 L50 80 Z', { c: '#666', w: 1.2, fill: '#fff' }) + txt(64, 94, '部品.json', { size: 10 })
    + arrow(85, 60, 240, 60) + cursor(240, 60) + rc(200, 10, 210, 100, { c: '#bbb', w: 1, fill: '#fff' }) + txt(305, 100, '製図ツールの画面', { size: 11 }),
    'ファイルをドラッグして、画面の上で離します。')}
<h3>新しく作る</h3>
<p><span class="help-btn">新規</span> を押すと、白紙の図面になります。保存していない変更があるときは確認が出ます。</p>
<h3>保存を忘れたとき</h3>
<ul>
<li>保存していない変更があるままブラウザを閉じようとすると、注意のメッセージが出ます。</li>
<li>ブラウザが突然閉じてしまったときは、次に開いたときに<b>黄色い帯</b>が出ます。<b>復元する</b>を押すと、閉じる前の図面に戻せます。いらなければ<b>破棄する</b>を押します。</li>
</ul>
${fig(420, 50, '復元の案内', rc(5, 10, 410, 30, { c: '#e0c060', w: 1, fill: '#fff3bf' }) + txt(15, 30, '保存されていない図面があります', { anchor: 'start', c: '#222' }) + btn(250, 14, '復元する', { size: 11, on: true }) + btn(320, 14, '破棄する', { size: 11 }), '次に開いたときに出る黄色い帯。')}`,
  },
  {
    id: 'svgPrint',
    category: 'file',
    title: '印刷する・PDFや画像にする（印刷・SVG出力）',
    keywords: ['印刷', 'いんさつ', 'プリント', 'PDF', 'SVG', 'SVG出力', '画像', '実際のサイズ', '100%', '書き出し'],
    tools: [],
    html: `
<h3>印刷する</h3>
<ol class="help-steps">
<li>「ファイル」タブの <span class="help-btn">印刷</span> を押します。ブラウザの印刷画面が開きます。</li>
<li>用紙の大きさと向きを、図面の設定（例：A3 横）に合わせます。</li>
<li>倍率を <b>100%</b> または「<b>実際のサイズ</b>」にします。こうすると、寸法どおりの大きさで印刷されます。</li>
<li>「印刷」を押します。</li>
</ol>
${fig(420, 120, '印刷画面の設定', rc(10, 5, 400, 110, { c: '#bbb', w: 1, fill: '#fff' })
    + txt(25, 30, 'プリンター', { anchor: 'start' }) + box(130, 16, 180, 'PDFに保存 ▾') + txt(318, 30, '← PDFにするとき', { anchor: 'start', size: 11, c: C.guide })
    + txt(25, 60, '用紙サイズ', { anchor: 'start' }) + box(130, 46, 180, 'A3 ▾')
    + txt(25, 90, '倍率', { anchor: 'start' }) + box(130, 76, 180, '実際のサイズ（100%）', { on: true }) + txt(318, 90, '← 大事', { anchor: 'start', size: 11, c: C.mark }),
    'ブラウザによって見た目は違いますが、同じような項目があります。')}
<h3>PDFにする</h3>
<p>印刷画面の「プリンター（送信先）」で「<b>PDFに保存</b>」を選んで保存します。メールで送るときに便利です。</p>
<h3>SVG出力（ほかのソフト用の画像）</h3>
<p>「SVG」は、拡大しても線がぼやけない<b>絵のファイルの種類</b>です。ほかの図面ソフトやレーザー加工機のソフトなどに渡すときに使います。</p>
<ol class="help-steps">
<li>「ファイル」タブの <span class="help-btn">SVG出力</span> を押します。</li>
<li>用紙全体の絵が .svg ファイルとして保存されます。</li>
</ol>
<div class="help-note">注意: 印刷とSVG出力には、「印刷」のチェックを外したレイヤー（はじめは補助線）、投影ガイド、45°線、操作ガイドは出ません。→ <a href="#help:layers">レイヤー</a></div>`,
  },
];

// ---- キー操作の一覧 ----
function keyRows(rows) {
  return rows.map(([k, d]) => `<tr><td>${k}</td><td>${d}</td></tr>`).join('');
}

const T_KEYS = [
  {
    id: 'keys',
    category: 'keys',
    title: 'キーボードの近道（ショートカット）一覧',
    keywords: ['キー', 'キーボード', 'ショートカット', '近道', '一覧', 'Ctrl', 'Esc', 'Enter', 'Delete', 'F1'],
    tools: [],
    html: `
<p>よく使う操作は、キーボードでもできます。「<kbd>Ctrl</kbd>+<kbd>Z</kbd>」は「<kbd>Ctrl</kbd> を押したまま <kbd>Z</kbd> を押す」という意味です。</p>
${fig(400, 90, 'Ctrlを押したままZを押す', btn(40, 30, 'Ctrl', { size: 16, width: 80, h: 36 }) + txt(150, 55, '＋', { size: 20, c: '#222' }) + btn(180, 30, 'Z', { size: 16, width: 44, h: 36, on: true })
    + txt(80, 22, '① 押したまま', { size: 11 }) + txt(202, 22, '② 押す', { size: 11 }) + txt(320, 55, '＝ 元に戻す', { size: 13, c: '#222' }),
    '2つのキーの組み合わせの押し方。')}
<div class="help-note">注意: 数字や文字を入力する欄に文字を打っている間は、<kbd>L</kbd> などの1文字のキーは道具の切り替えに使われません。</div>
<h3>道具を選ぶ</h3>
<table class="help-keys"><tbody>
${keyRows([
    ['<kbd>Esc</kbd>', '描きかけをやめる／選択の道具に戻る／選択を解除する'],
    ['<kbd>L</kbd>', '直線'], ['<kbd>P</kbd>', '連続線'], ['<kbd>R</kbd>', '矩形（四角）'], ['<kbd>C</kbd>', '円'],
    ['<kbd>A</kbd>', '円弧'], ['<kbd>E</kbd>', '楕円'], ['<kbd>S</kbd>', 'スプライン（なめらかな曲線）'], ['<kbd>T</kbd>', '文字'],
    ['<kbd>D</kbd>', '寸法'], ['<kbd>H</kbd>', 'ハッチ（斜線）'], ['<kbd>B</kbd>', 'バルーン（部品番号）'],
    ['<kbd>X</kbd>', 'トリム（線を切る）'], ['<kbd>F</kbd>', 'フィレット（角を丸める）'], ['<kbd>O</kbd>', 'オフセット（平行コピー）'],
    ['<kbd>F1</kbd> または <kbd>?</kbd>', '今の道具のヘルプを開く'],
  ])}
</tbody></table>
<h3>編集</h3>
<table class="help-keys"><tbody>
${keyRows([
    ['<kbd>Delete</kbd> ／ <kbd>Backspace</kbd>', '選んだ図形を消す'],
    ['<kbd>Ctrl</kbd>+<kbd>Z</kbd>', '元に戻す'],
    ['<kbd>Ctrl</kbd>+<kbd>Y</kbd> ／ <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>Z</kbd>', 'やり直し'],
    ['<kbd>Ctrl</kbd>+<kbd>C</kbd>', 'コピー'],
    ['<kbd>Ctrl</kbd>+<kbd>V</kbd>', 'マウスの位置に貼り付け'],
    ['<kbd>Ctrl</kbd>+<kbd>D</kbd>', '複製（10mmずらしてコピー）'],
    ['<kbd>Ctrl</kbd>+<kbd>A</kbd>', 'すべて選択'],
    ['<kbd>Shift</kbd>+クリック', '選択に追加する／外す'],
  ])}
</tbody></table>
<h3>描くとき</h3>
<table class="help-keys"><tbody>
${keyRows([
    ['<kbd>Enter</kbd>', '連続線・スプラインを描き終える／数値入力を確定する'],
    ['数字キー', '直線を描いている途中なら「長さ」の欄に入力'],
    ['<kbd>Shift</kbd>+3回目のクリック', '寸法を斜め（2点に平行）にする'],
  ])}
</tbody></table>
<h3>ファイル</h3>
<table class="help-keys"><tbody>
${keyRows([
    ['<kbd>Ctrl</kbd>+<kbd>S</kbd>', '保存'],
    ['<kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>S</kbd>', '名前を付けて保存'],
    ['<kbd>Ctrl</kbd>+<kbd>O</kbd>', '開く'],
  ])}
</tbody></table>
<h3>画面を動かす</h3>
<table class="help-keys"><tbody>
${keyRows([
    ['<kbd>↑</kbd><kbd>↓</kbd><kbd>←</kbd><kbd>→</kbd>', '画面をその方向へ動かす'],
    ['<kbd>Space</kbd>+ドラッグ', '画面を自由に動かす'],
    ['<kbd>Shift</kbd>／<kbd>Ctrl</kbd>+ホイール', 'マウスの位置を中心に拡大・縮小'],
  ])}
</tbody></table>`,
  },
];

export const HELP_TOPICS = [
  ...T_START, ...T_VIEW, ...T_DRAW, ...T_SELECT, ...T_EDIT, ...T_DIM,
  ...T_SYMBOL, ...T_STYLE, ...T_ASSIST, ...T_PAPER, ...T_FILE, ...T_KEYS,
];
