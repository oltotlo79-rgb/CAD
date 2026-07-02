// SVGエクスポート(一次出力形式)。用紙実寸mmで出力する。
// 印刷ONのレイヤーのみ含める。グリッド・投影ガイドは含めない。
import { paperDimensions, frameRect } from './papers.js';
import { LINE_STYLES, entitySegments } from './model.js';
import {
  dimLayout, DIM_TEXT_MM, DIM_ARROW_MM, balloonLayout, annotationLayout,
} from './dims.js';
import { catmullRomPoints } from './geometry.js';
import { hatchSegments } from './hatch.js';
import { bomLayout } from './bom.js';
import { scaleK } from './viewTransform.js';
import { titleBlockLayout } from './titleBlock.js';

const DEG = Math.PI / 180;
const FONT = 'Yu Gothic UI, Meiryo, sans-serif';

const r2 = (v) => Math.round(v * 100) / 100;
const esc = (s) => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function toSVG(doc) {
  const paper = paperDimensions(doc.paper.size, doc.paper.orientation);
  const frame = frameRect(doc.paper.size, doc.paper.orientation);
  const k = scaleK(doc.scale);
  const H = paper.height;
  // 実寸mm → SVG座標(用紙mm・y下向き)
  const X = (x) => r2(x * k);
  const Y = (y) => r2(H - y * k);
  const out = [];

  out.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${paper.width}mm" height="${paper.height}mm" viewBox="0 0 ${paper.width} ${paper.height}" font-family="${FONT}">`);
  out.push('<rect x="0" y="0" width="' + paper.width + '" height="' + paper.height + '" fill="white"/>');

  // 図面枠(用紙mm)
  out.push(`<rect x="${frame.x}" y="${H - frame.y - frame.height}" width="${frame.width}" height="${frame.height}" fill="none" stroke="black" stroke-width="0.7"/>`);

  // 表題欄
  const tb = titleBlockLayout(doc);
  if (tb) {
    const ty = (y) => r2(H - y);
    out.push(`<g stroke="black" stroke-width="0.35" fill="none">`);
    out.push(`<rect x="${tb.x}" y="${ty(tb.y + tb.height)}" width="${tb.width}" height="${tb.height}"/>`);
    for (const row of tb.rows) {
      out.push(`<line x1="${row.rect.x}" y1="${ty(row.rect.y)}" x2="${r2(row.rect.x + row.rect.width)}" y2="${ty(row.rect.y)}"/>`);
    }
    out.push(`<line x1="${r2(tb.x + tb.labelWidth)}" y1="${ty(tb.y + tb.height)}" x2="${r2(tb.x + tb.labelWidth)}" y2="${ty(tb.y)}"/>`);
    out.push('</g>');
    for (const row of tb.rows) {
      const cy = ty(row.rect.y + row.rect.height / 2 - 1.2);
      out.push(`<text x="${r2(row.rect.x + 2)}" y="${cy}" font-size="2.5" fill="black">${esc(row.field.label)}</text>`);
      out.push(`<text x="${r2(row.rect.x + tb.labelWidth + 2)}" y="${cy}" font-size="3.5" fill="black">${esc(row.text)}</text>`);
    }
  }

  const printable = new Map(doc.layers.map((l) => [l.id, l.printable]));
  for (const e of doc.entities) {
    if (printable.get(e.layer) === false) continue;
    out.push(entityToSVG(e, doc, k, X, Y));
  }
  out.push('</svg>');
  return out.filter(Boolean).join('\n');
}

function strokeAttrs(e) {
  const style = LINE_STYLES[e.lineType] ?? LINE_STYLES.solid;
  const dash = style.dashMm.length > 0 ? ` stroke-dasharray="${style.dashMm.join(' ')}"` : '';
  return `stroke="black" stroke-width="${style.widthMm}" fill="none"${dash}`;
}

function entityToSVG(e, doc, k, X, Y) {
  if (e.type === 'line') {
    return `<line x1="${X(e.x1)}" y1="${Y(e.y1)}" x2="${X(e.x2)}" y2="${Y(e.y2)}" ${strokeAttrs(e)}/>`;
  }
  if (e.type === 'rect') {
    return `<rect x="${X(e.x)}" y="${Y(e.y + e.height)}" width="${r2(e.width * k)}" height="${r2(e.height * k)}" ${strokeAttrs(e)}/>`;
  }
  if (e.type === 'polyline') {
    const pts = e.points.map(([x, y]) => `${X(x)},${Y(y)}`).join(' ');
    const tag = e.closed ? 'polygon' : 'polyline';
    return `<${tag} points="${pts}" ${strokeAttrs(e)}/>`;
  }
  if (e.type === 'circle') {
    return `<circle cx="${X(e.cx)}" cy="${Y(e.cy)}" r="${r2(e.r * k)}" ${strokeAttrs(e)}/>`;
  }
  if (e.type === 'ellipse') {
    return `<ellipse cx="${X(e.cx)}" cy="${Y(e.cy)}" rx="${r2(e.rx * k)}" ry="${r2(e.ry * k)}" ${strokeAttrs(e)}/>`;
  }
  if (e.type === 'arc') {
    let sweep = e.endAngle - e.startAngle;
    while (sweep < 0) sweep += 360;
    const sx = X(e.cx + e.r * Math.cos(e.startAngle * DEG));
    const sy = Y(e.cy + e.r * Math.sin(e.startAngle * DEG));
    const ex = X(e.cx + e.r * Math.cos(e.endAngle * DEG));
    const ey = Y(e.cy + e.r * Math.sin(e.endAngle * DEG));
    const rp = r2(e.r * k);
    const large = sweep > 180 ? 1 : 0;
    // 実座標で反時計回り → y反転後のSVGでは sweep-flag 0
    return `<path d="M ${sx} ${sy} A ${rp} ${rp} 0 ${large} 0 ${ex} ${ey}" ${strokeAttrs(e)}/>`;
  }
  if (e.type === 'text') {
    return `<text x="${X(e.x)}" y="${Y(e.y)}" font-size="${e.height}" fill="black">${esc(e.content)}</text>`;
  }
  if (e.type === 'hatch') {
    return hatchSegments(e.boundary, e.angleDeg, e.spacingMm / k)
      .map(([a, b]) => `<line x1="${X(a.x)}" y1="${Y(a.y)}" x2="${X(b.x)}" y2="${Y(b.y)}" stroke="black" stroke-width="0.25" fill="none"/>`)
      .join('\n');
  }
  if (e.type === 'balloon') {
    const layout = balloonLayout(e, k);
    const parts = [];
    parts.push(`<circle cx="${X(layout.circle.c.x)}" cy="${Y(layout.circle.c.y)}" r="${r2(layout.circle.r * k)}" stroke="black" stroke-width="0.25" fill="none"/>`);
    parts.push(svgDimParts(layout, k, X, Y));
    return parts.join('\n');
  }
  if (e.type === 'bom') {
    const layout = bomLayout(e, k);
    const parts = [];
    for (const [a, b] of [...layout.hLines, ...layout.vLines]) {
      parts.push(`<line x1="${X(a.x)}" y1="${Y(a.y)}" x2="${X(b.x)}" y2="${Y(b.y)}" stroke="black" stroke-width="0.35" fill="none"/>`);
    }
    const pad = 1.5 / k;
    for (const cell of [...layout.headers, ...layout.cells]) {
      const tx = cell.rect.x + pad;
      const ty = cell.rect.y + cell.rect.height / 2 - (DIM_TEXT_MM / k) * 0.35;
      parts.push(`<text x="${X(tx)}" y="${Y(ty)}" font-size="${DIM_TEXT_MM}" fill="black">${esc(cell.text)}</text>`);
    }
    return parts.join('\n');
  }
  if (e.type === 'spline') {
    const pts = catmullRomPoints(e.points, e.closed)
      .map((p) => `${X(p.x)},${Y(p.y)}`).join(' ');
    return `<polyline points="${pts}" ${strokeAttrs(e)}/>`;
  }
  if (e.type === 'dim' || e.type === 'leader' || e.type === 'roughness' || e.type === 'fcf') {
    return svgDimParts(annotationLayout(e, k), k, X, Y);
  }
  return '';
}

// 寸法・引出線・バルーンで共通の 線+円弧+矢印+文字 のSVG化
function svgDimParts(layout, k, X, Y) {
  const parts = [];
  for (const [a, b] of layout.lines) {
    parts.push(`<line x1="${X(a.x)}" y1="${Y(a.y)}" x2="${X(b.x)}" y2="${Y(b.y)}" stroke="black" stroke-width="0.25" fill="none"/>`);
  }
  for (const arc of layout.arcs ?? []) {
    const sx = X(arc.c.x + arc.r * Math.cos(arc.startDeg * DEG));
    const sy = Y(arc.c.y + arc.r * Math.sin(arc.startDeg * DEG));
    const ex = X(arc.c.x + arc.r * Math.cos(arc.endDeg * DEG));
    const ey = Y(arc.c.y + arc.r * Math.sin(arc.endDeg * DEG));
    const large = arc.endDeg - arc.startDeg > 180 ? 1 : 0;
    parts.push(`<path d="M ${sx} ${sy} A ${r2(arc.r * k)} ${r2(arc.r * k)} 0 ${large} 0 ${ex} ${ey}" stroke="black" stroke-width="0.25" fill="none"/>`);
  }
  for (const a of layout.arrows) {
    const tipX = X(a.at.x);
    const tipY = Y(a.at.y);
    const ang = -a.angleDeg * DEG;
    const L = DIM_ARROW_MM;
    const W = L / 3;
    const bx = tipX - L * Math.cos(ang);
    const by = tipY - L * Math.sin(ang);
    const px = -Math.sin(ang);
    const py = Math.cos(ang);
    parts.push(`<polygon points="${r2(tipX)},${r2(tipY)} ${r2(bx + px * W / 2)},${r2(by + py * W / 2)} ${r2(bx - px * W / 2)},${r2(by - py * W / 2)}" fill="black"/>`);
  }
  for (const t of layout.texts) {
    const anchor = t.align === 'center' ? 'middle' : t.align === 'right' ? 'end' : 'start';
    const rot = t.angleDeg ? ` transform="rotate(${r2(-t.angleDeg)} ${X(t.x)} ${Y(t.y)})"` : '';
    parts.push(`<text x="${X(t.x)}" y="${Y(t.y)}" font-size="${DIM_TEXT_MM}" text-anchor="${anchor}" fill="black"${rot}>${esc(t.content)}</text>`);
  }
  return parts.join('\n');
}
