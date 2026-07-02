import { distance, angleDegOf } from './geometry.js';

// 寸法の描画定数。すべて用紙上mm(縮尺に依存しない)
export const DIM_TEXT_MM = 3.5;   // 文字高さ
export const DIM_ARROW_MM = 3;    // 矢印長さ
export const DIM_EXT_MM = 2;      // 寸法補助線の突き出し
export const DIM_GAP_MM = 1;      // 文字と寸法線の間隔

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
  return '';
}

// 寸法・引出線の構成要素(実寸mm座標)を計算する。
// k は縮尺係数。文字・矢印・突き出しは用紙mm基準なので実寸へ換算する。
// 戻り値: { lines: [[a,b],...], arrows: [{at,angleDeg}], texts: [{x,y,content,angleDeg,align}] }
export function dimLayout(e, k = 1) {
  const textH = DIM_TEXT_MM / k;
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
    return { lines, arrows, texts };
  }

  if (e.dimType === 'linear') {
    const [x1, y1] = e.p1;
    const [x2, y2] = e.p2;
    if (e.orient === 'h') {
      const y = e.offset;
      const sgn = y >= Math.max(y1, y2) ? 1 : -1;
      lines.push([{ x: x1, y: y1 }, { x: x1, y: y + sgn * ext }]);
      lines.push([{ x: x2, y: y2 }, { x: x2, y: y + sgn * ext }]);
      const xa = Math.min(x1, x2);
      const xb = Math.max(x1, x2);
      lines.push([{ x: xa, y }, { x: xb, y }]);
      arrows.push({ at: { x: xa, y }, angleDeg: 180 });
      arrows.push({ at: { x: xb, y }, angleDeg: 0 });
      texts.push({ x: (xa + xb) / 2, y: y + gap, content: text, angleDeg: 0, align: 'center' });
    } else if (e.orient === 'v') {
      const x = e.offset;
      const sgn = x >= Math.max(x1, x2) ? 1 : -1;
      const ya = Math.min(y1, y2);
      const yb = Math.max(y1, y2);
      lines.push([{ x: x1, y: y1 }, { x: x + sgn * ext, y: y1 }]);
      lines.push([{ x: x2, y: y2 }, { x: x + sgn * ext, y: y2 }]);
      lines.push([{ x, y: ya }, { x, y: yb }]);
      arrows.push({ at: { x, y: ya }, angleDeg: 270 });
      arrows.push({ at: { x, y: yb }, angleDeg: 90 });
      texts.push({ x: x - gap, y: (ya + yb) / 2, content: text, angleDeg: 90, align: 'center' });
    } else { // aligned(平行寸法)
      const p1 = { x: x1, y: y1 };
      const p2 = { x: x2, y: y2 };
      const len = distance(p1, p2) || 1;
      const nx = -(y2 - y1) / len;
      const ny = (x2 - x1) / len;
      const off = e.offset;
      const sgn = Math.sign(off) || 1;
      const a = { x: x1 + nx * off, y: y1 + ny * off };
      const b = { x: x2 + nx * off, y: y2 + ny * off };
      lines.push([p1, { x: x1 + nx * (off + sgn * ext), y: y1 + ny * (off + sgn * ext) }]);
      lines.push([p2, { x: x2 + nx * (off + sgn * ext), y: y2 + ny * (off + sgn * ext) }]);
      lines.push([a, b]);
      const ang = angleDegOf(p1, p2);
      arrows.push({ at: a, angleDeg: ang + 180 });
      arrows.push({ at: b, angleDeg: ang });
      texts.push({
        x: (a.x + b.x) / 2 + nx * gap * sgn,
        y: (a.y + b.y) / 2 + ny * gap * sgn,
        content: text, angleDeg: ang, align: 'center',
      });
    }
    return { lines, arrows, texts };
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
    return { lines, arrows, texts };
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
    return { lines, arrows, texts };
  }

  return { lines, arrows, texts };
}
