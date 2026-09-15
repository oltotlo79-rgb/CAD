import { distance, angleDegOf } from './geometry.js';

// 寸法の描画定数。すべて用紙上mm(縮尺に依存しない)
export const DIM_TEXT_MM = 3.5;   // 文字高さの既定値
export const DIM_ARROW_MM = 3;    // 矢印長さ
export const DIM_EXT_MM = 2;      // 寸法補助線の突き出し
export const DIM_GAP_MM = 1;      // 文字と寸法線の間隔

// 注記(寸法・引出線・記号・バルーン・部品表)の文字高さ。要素ごとに textMm で変えられる
export function annoTextMm(e) {
  const v = Number(e.textMm);
  return v > 0 ? v : DIM_TEXT_MM;
}

const DEG = Math.PI / 180;

// 実寸mmの数値表示(小数2桁まで、末尾ゼロなし)
export function fmtMm(v) {
  return String(Math.round(v * 100) / 100);
}

// 寸法値の自動計測(override があればそれを使う)
export function dimText(e) {
  if (e.override) return e.override;
  if (e.type === 'leader') return e.content ?? '';
  if (e.dimType === 'linear') {
    const m = e.orient === 'h' ? Math.abs(e.p2[0] - e.p1[0])
      : e.orient === 'v' ? Math.abs(e.p2[1] - e.p1[1])
      : Math.hypot(e.p2[0] - e.p1[0], e.p2[1] - e.p1[1]);
    return fmtMm(m);
  }
  if (e.dimType === 'dia') return `φ${fmtMm(e.r * 2)}`;
  if (e.dimType === 'rad') return `R${fmtMm(e.r)}`;
  if (e.dimType === 'chamfer') return `C${fmtMm(e.size)}`;
  if (e.dimType === 'angle') return `${fmtMm(angleSweep(e))}°`;
  return '';
}

// 長さ寸法の寸法線の向き(単位ベクトル)。値のずれ textShift はこの向きの実寸mm
export function dimAxis(e) {
  if (e.orient === 'h') return { x: 1, y: 0 };
  if (e.orient === 'v') return { x: 0, y: 1 };
  const len = Math.hypot(e.p2[0] - e.p1[0], e.p2[1] - e.p1[1]) || 1;
  return { x: (e.p2[0] - e.p1[0]) / len, y: (e.p2[1] - e.p1[1]) / len };
}

// 点 p を寸法線の向きに投影した、寸法線の中央からのずれ(値のドラッグ移動に使う)
export function dimShiftAt(e, p) {
  const u = dimAxis(e);
  const mx = (e.p1[0] + e.p2[0]) / 2;
  const my = (e.p1[1] + e.p2[1]) / 2;
  return (p.x - mx) * u.x + (p.y - my) * u.y;
}

// 文字(基準位置 t・高さ textH)の枠に点 p が入るか。回転した文字にも対応
export function textBoxHit(t, textH, p, tolMm) {
  const w = t.content.length * textH;
  const r = (t.angleDeg || 0) * DEG;
  const dx = p.x - t.x;
  const dy = p.y - t.y;
  const lx = dx * Math.cos(r) + dy * Math.sin(r);
  const ly = -dx * Math.sin(r) + dy * Math.cos(r);
  const x0 = t.align === 'center' ? -w / 2 : t.align === 'right' ? -w : 0;
  return lx >= x0 - tolMm && lx <= x0 + w + tolMm && ly >= -tolMm && ly <= textH + tolMm;
}

// 長さ寸法の値(文字)の上か。値だけを寸法線に沿って動かす操作の判定に使う
export function dimTextHit(e, p, tolMm, k = 1) {
  if (e.type !== 'dim' || e.dimType !== 'linear') return false;
  const layout = dimLayout(e, k);
  return textBoxHit(layout.texts[0], layout.textMm / k, p, tolMm);
}

function angleSweep(e) {
  const v = { x: e.vertex[0], y: e.vertex[1] };
  const a1 = angleDegOf(v, { x: e.p1[0], y: e.p1[1] });
  let a2 = angleDegOf(v, { x: e.p2[0], y: e.p2[1] });
  while (a2 <= a1) a2 += 360;
  return a2 - a1;
}

// 表面粗さ記号(チェックマーク形状+値)
export function roughnessLayout(e, k = 1) {
  const textMm = annoTextMm(e);
  const h = (5 * textMm) / DIM_TEXT_MM / k; // 記号高さ(文字3.5mmで用紙5mm)
  const gap = DIM_GAP_MM / k;
  const tip = { x: e.x, y: e.y };
  const leg60 = (deg, len) => ({
    x: tip.x + len * Math.cos(deg * DEG), y: tip.y + len * Math.sin(deg * DEG),
  });
  const left = leg60(120, h);
  const right = leg60(60, h * 2);
  return {
    lines: [[tip, left], [tip, right]],
    arrows: [],
    texts: [{
      x: right.x + gap, y: right.y, content: e.value ?? '', angleDeg: 0, align: 'left',
    }],
    textMm,
  };
}

// 幾何公差の公差記入枠(セルを横に並べた箱)。枠は文字高さに比例
export function fcfLayout(e, k = 1) {
  const textMm = annoTextMm(e);
  const s = textMm / DIM_TEXT_MM;
  const rowH = (7 * s) / k;
  const textH = textMm / k;
  const pad = (1.5 * s) / k;
  const cells = e.cells ?? [];
  const widths = cells.map((c) => Math.max(rowH, String(c).length * textH * 0.8 + pad * 2));
  const lines = [];
  const texts = [];
  let x = e.x;
  const y0 = e.y;
  const y1 = e.y + rowH;
  for (let i = 0; i < cells.length; i++) {
    lines.push([{ x, y: y0 }, { x, y: y1 }]);
    texts.push({
      x: x + widths[i] / 2, y: y0 + rowH / 2 - textH * 0.35,
      content: String(cells[i]), angleDeg: 0, align: 'center',
    });
    x += widths[i];
  }
  lines.push([{ x, y: y0 }, { x, y: y1 }]);
  lines.push([{ x: e.x, y: y0 }, { x, y: y0 }]);
  lines.push([{ x: e.x, y: y1 }, { x, y: y1 }]);
  return { lines, arrows: [], texts, textMm };
}

// 注記系エンティティの共通レイアウト取得
export function annotationLayout(e, k = 1) {
  if (e.type === 'dim' || e.type === 'leader') return dimLayout(e, k);
  if (e.type === 'roughness') return roughnessLayout(e, k);
  if (e.type === 'fcf') return fcfLayout(e, k);
  return null;
}

export const BALLOON_R_MM = 4; // バルーン円の半径(用紙mm、文字3.5mm時。文字に比例)

// バルーン(部品番号)のレイアウト。円+番号+対象への引出線
export function balloonLayout(e, k = 1) {
  const textMm = annoTextMm(e);
  const r = (BALLOON_R_MM * textMm) / DIM_TEXT_MM / k;
  const textH = textMm / k;
  const at = { x: e.at[0], y: e.at[1] };
  const pos = { x: e.pos[0], y: e.pos[1] };
  const d = distance(pos, at) || 1;
  const edge = {
    x: pos.x + ((at.x - pos.x) / d) * r,
    y: pos.y + ((at.y - pos.y) / d) * r,
  };
  return {
    circle: { c: pos, r },
    lines: d > r ? [[edge, at]] : [],
    arrows: d > r ? [{ at, angleDeg: angleDegOf(pos, at) }] : [],
    texts: [{
      x: pos.x, y: pos.y - textH * 0.35,
      content: String(e.number), angleDeg: 0, align: 'center',
    }],
    textMm,
  };
}

// 寸法・引出線の構成要素(実寸mm座標)を計算する。
// k は縮尺係数。文字・矢印・突き出しは用紙mm基準なので実寸へ換算する。
// 戻り値: { lines: [[a,b],...], arrows: [{at,angleDeg}], texts: [{x,y,content,angleDeg,align}],
//          textMm(文字高さ・用紙mm) }
export function dimLayout(e, k = 1) {
  const textMm = annoTextMm(e);
  const textH = textMm / k;
  const ext = DIM_EXT_MM / k;
  const gap = DIM_GAP_MM / k;
  const lines = [];
  const arrows = [];
  const texts = [];
  const text = dimText(e);

  if (e.type === 'leader') {
    const from = { x: e.points[0][0], y: e.points[0][1] };
    let prev = from;
    for (let i = 1; i < e.points.length; i++) {
      const p = { x: e.points[i][0], y: e.points[i][1] };
      lines.push([prev, p]);
      prev = p;
    }
    const elbow = prev;
    const dir = elbow.x >= from.x ? 1 : -1;
    const tailEnd = { x: elbow.x + dir * Math.max(text.length, 2) * textH, y: elbow.y };
    lines.push([elbow, tailEnd]);
    const second = e.points.length > 1
      ? { x: e.points[1][0], y: e.points[1][1] } : tailEnd;
    arrows.push({ at: from, angleDeg: angleDegOf(second, from) });
    texts.push({
      x: dir === 1 ? elbow.x + gap : elbow.x - gap,
      y: elbow.y + gap, content: text, angleDeg: 0, align: dir === 1 ? 'left' : 'right',
    });
    return { lines, arrows, texts, textMm };
  }

  if (e.dimType === 'linear') {
    const [x1, y1] = e.p1;
    const [x2, y2] = e.p2;
    // a→b: 寸法線(補助線との交点どうし)。textOff: 寸法線から文字までの隙間
    let a; let b; let textOff; let textAngle;
    if (e.orient === 'h') {
      const y = e.offset;
      const sgn = y >= Math.max(y1, y2) ? 1 : -1;
      lines.push([{ x: x1, y: y1 }, { x: x1, y: y + sgn * ext }]);
      lines.push([{ x: x2, y: y2 }, { x: x2, y: y + sgn * ext }]);
      a = { x: Math.min(x1, x2), y };
      b = { x: Math.max(x1, x2), y };
      textOff = { x: 0, y: gap };
      textAngle = 0;
    } else if (e.orient === 'v') {
      const x = e.offset;
      const sgn = x >= Math.max(x1, x2) ? 1 : -1;
      lines.push([{ x: x1, y: y1 }, { x: x + sgn * ext, y: y1 }]);
      lines.push([{ x: x2, y: y2 }, { x: x + sgn * ext, y: y2 }]);
      a = { x, y: Math.min(y1, y2) };
      b = { x, y: Math.max(y1, y2) };
      textOff = { x: -gap, y: 0 };
      textAngle = 90;
    } else { // aligned(平行寸法)
      const p1 = { x: x1, y: y1 };
      const p2 = { x: x2, y: y2 };
      const len = distance(p1, p2) || 1;
      const nx = -(y2 - y1) / len;
      const ny = (x2 - x1) / len;
      const off = e.offset;
      const sgn = Math.sign(off) || 1;
      a = { x: x1 + nx * off, y: y1 + ny * off };
      b = { x: x2 + nx * off, y: y2 + ny * off };
      lines.push([p1, { x: x1 + nx * (off + sgn * ext), y: y1 + ny * (off + sgn * ext) }]);
      lines.push([p2, { x: x2 + nx * (off + sgn * ext), y: y2 + ny * (off + sgn * ext) }]);
      textOff = { x: nx * gap * sgn, y: ny * gap * sgn };
      textAngle = angleDegOf(p1, p2);
    }
    // 値は textShift だけ寸法線に沿って中央からずらせる。補助線の外に出たら
    // 寸法線を値の外端まで延ばし、矢印を外側から内向きにする
    const u = dimAxis(e);
    const angU = Math.atan2(u.y, u.x) / DEG;
    const half = distance(a, b) / 2;
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    const at = (s) => ({ x: mid.x + u.x * s, y: mid.y + u.y * s });
    const shift = Number(e.textShift) || 0;
    if (Math.abs(shift) <= half) {
      lines.push([a, b]);
      arrows.push({ at: a, angleDeg: angU + 180 });
      arrows.push({ at: b, angleDeg: angU });
    } else {
      const dir = Math.sign(shift);
      const tail = (DIM_ARROW_MM * 2) / k;                 // 反対側の矢印の軸
      const textHalf = text.length * textH * 0.3;           // 文字幅(1文字≒高さ×0.6)の半分
      lines.push([at(-dir * (half + tail)), at(dir * (Math.abs(shift) + textHalf))]);
      arrows.push({ at: a, angleDeg: angU });
      arrows.push({ at: b, angleDeg: angU + 180 });
    }
    const tp = at(shift);
    texts.push({
      x: tp.x + textOff.x, y: tp.y + textOff.y, content: text, angleDeg: textAngle, align: 'center',
    });
    return { lines, arrows, texts, textMm };
  }

  if (e.dimType === 'dia' || e.dimType === 'rad') {
    const dx = Math.cos(e.angleDeg * DEG);
    const dy = Math.sin(e.angleDeg * DEG);
    const edge = { x: e.cx + dx * e.r, y: e.cy + dy * e.r };
    const tail = { x: edge.x + dx * textH * 2, y: edge.y + dy * textH * 2 };
    if (e.dimType === 'dia') {
      const opposite = { x: e.cx - dx * e.r, y: e.cy - dy * e.r };
      lines.push([opposite, tail]);
      arrows.push({ at: opposite, angleDeg: e.angleDeg + 180 });
    } else {
      lines.push([{ x: e.cx, y: e.cy }, tail]);
    }
    arrows.push({ at: edge, angleDeg: e.angleDeg });
    texts.push({
      x: dx >= 0 ? tail.x + gap : tail.x - gap,
      y: tail.y + gap, content: text, angleDeg: 0, align: dx >= 0 ? 'left' : 'right',
    });
    return { lines, arrows, texts, textMm };
  }

  if (e.dimType === 'angle') {
    const v = { x: e.vertex[0], y: e.vertex[1] };
    const a1 = angleDegOf(v, { x: e.p1[0], y: e.p1[1] });
    let a2 = angleDegOf(v, { x: e.p2[0], y: e.p2[1] });
    while (a2 <= a1) a2 += 360;
    const r = e.radius;
    const at = (deg, rr) => ({
      x: v.x + rr * Math.cos(deg * DEG), y: v.y + rr * Math.sin(deg * DEG),
    });
    lines.push([v, at(a1, r + ext)]);
    lines.push([v, at(a2, r + ext)]);
    const arcs = [{ c: v, r, startDeg: a1, endDeg: a2 }];
    arrows.push({ at: at(a1, r), angleDeg: a1 - 90 }); // 弧の接線方向
    arrows.push({ at: at(a2, r), angleDeg: a2 + 90 });
    const mid = (a1 + a2) / 2;
    const tp = at(mid, r + gap + textH * 0.5);
    texts.push({ x: tp.x, y: tp.y, content: text, angleDeg: 0, align: 'center' });
    return { lines, arrows, texts, arcs, textMm };
  }

  if (e.dimType === 'chamfer') {
    const mid = { x: (e.p1[0] + e.p2[0]) / 2, y: (e.p1[1] + e.p2[1]) / 2 };
    const elbow = { x: e.tail[0], y: e.tail[1] };
    const dir = elbow.x >= mid.x ? 1 : -1;
    const tailEnd = { x: elbow.x + dir * Math.max(text.length, 2) * textH * 0.8, y: elbow.y };
    lines.push([mid, elbow]);
    lines.push([elbow, tailEnd]);
    arrows.push({ at: mid, angleDeg: angleDegOf(elbow, mid) });
    texts.push({
      x: dir === 1 ? elbow.x + gap : elbow.x - gap,
      y: elbow.y + gap, content: text, angleDeg: 0, align: dir === 1 ? 'left' : 'right',
    });
    return { lines, arrows, texts, textMm };
  }

  return { lines, arrows, texts, textMm };
}
