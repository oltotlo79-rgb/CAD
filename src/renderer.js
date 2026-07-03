import { paperDimensions, frameRect } from './papers.js';
import { scaleK, paperToScreen, realToPaper } from './viewTransform.js';
import { effectiveGridStep, MAJOR_STEP_MM } from './gridCalc.js';
import { entitySegments, LINE_STYLES } from './model.js';
import {
  dimLayout, DIM_TEXT_MM, DIM_ARROW_MM, balloonLayout, annotationLayout,
} from './dims.js';
import { catmullRomPoints } from './geometry.js';
import { titleBlockLayout } from './titleBlock.js';
import { hatchSegments } from './hatch.js';
import { bomLayout } from './bom.js';

const DEG = Math.PI / 180;

const COLORS = {
  background: '#3c4048',
  paper: '#ffffff',
  frame: '#222222',
  gridMinor: '#dfe6ee',
  gridMajor: '#b9c6d6',
  entity: '#111111',
  selected: '#0b6bcb',
  draft: '#0a8a3e',
  origin: '#cc4400',
  selectBox: '#0b6bcb',
  snapHint: '#d63384',
};

function realToScreen(p, doc, view) {
  return paperToScreen(realToPaper(p, doc.scale), view);
}

export function draw(ctx, state) {
  const { doc, view, selection, draft } = state;
  const paper = paperDimensions(doc.paper.size, doc.paper.orientation);
  const frame = frameRect(doc.paper.size, doc.paper.orientation);
  const k = scaleK(doc.scale);

  ctx.fillStyle = COLORS.background;
  ctx.fillRect(0, 0, view.canvasWidth, view.canvasHeight);

  const tl = paperToScreen({ x: 0, y: paper.height }, view);
  ctx.fillStyle = COLORS.paper;
  ctx.fillRect(tl.x, tl.y, paper.width * view.pxPerMm, paper.height * view.pxPerMm);

  drawGrid(ctx, doc, view, frame, k);
  drawProjection(ctx, doc, view, state, paper, k);

  const ftl = paperToScreen({ x: frame.x, y: frame.y + frame.height }, view);
  ctx.strokeStyle = COLORS.frame;
  ctx.lineWidth = Math.max(1, 0.7 * view.pxPerMm);
  ctx.strokeRect(ftl.x, ftl.y, frame.width * view.pxPerMm, frame.height * view.pxPerMm);

  drawTitleBlock(ctx, doc, view);
  drawEntities(ctx, doc, view, selection, k);
  drawOrigin(ctx, doc, view);
  if (draft) drawDraft(ctx, doc, view, draft);
  if (state.copyDrag) drawCopyGhost(ctx, doc, view, state.copyDrag);
  if (state.snapHint) drawSnapHint(ctx, doc, view, state.snapHint);
}

// 右ドラッグ複製の移動先プレビュー(破線の枠)
function drawCopyGhost(ctx, doc, view, d) {
  const dx = d.current.x - d.startReal.x;
  const dy = d.current.y - d.startReal.y;
  const tl = realToScreen({ x: d.bounds.minX + dx, y: d.bounds.maxY + dy }, doc, view);
  const br = realToScreen({ x: d.bounds.maxX + dx, y: d.bounds.minY + dy }, doc, view);
  ctx.save();
  ctx.setLineDash([6, 4]);
  ctx.strokeStyle = COLORS.draft;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(tl.x, tl.y, br.x - tl.x, br.y - tl.y);
  ctx.restore();
}

function drawGrid(ctx, doc, view, frame, k) {
  const pxPerRealMm = k * view.pxPerMm;
  const step = effectiveGridStep(doc.grid, pxPerRealMm);
  if (!step || step * pxPerRealMm < 2) return;

  // 図面枠内側の実寸mm範囲
  const x0 = frame.x / k, x1 = (frame.x + frame.width) / k;
  const y0 = frame.y / k, y1 = (frame.y + frame.height) / k;
  const isMajor = (v) =>
    Math.abs(v / MAJOR_STEP_MM - Math.round(v / MAJOR_STEP_MM)) < 1e-6;

  ctx.lineWidth = 1;
  const drawLine = (a, b, major) => {
    ctx.strokeStyle = major ? COLORS.gridMajor : COLORS.gridMinor;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  };
  for (let i = Math.ceil(x0 / step); i * step <= x1; i++) {
    const x = i * step;
    drawLine(realToScreen({ x, y: y0 }, doc, view), realToScreen({ x, y: y1 }, doc, view), isMajor(x));
  }
  for (let i = Math.ceil(y0 / step); i * step <= y1; i++) {
    const y = i * step;
    drawLine(realToScreen({ x: x0, y }, doc, view), realToScreen({ x: x1, y }, doc, view), isMajor(y));
  }
}

function drawTitleBlock(ctx, doc, view) {
  const tb = titleBlockLayout(doc);
  if (!tb) return;
  const z = view.pxPerMm;
  const P = (x, y) => paperToScreen({ x, y }, view);
  ctx.strokeStyle = COLORS.frame;
  ctx.lineWidth = Math.max(1, 0.35 * z);
  const tl = P(tb.x, tb.y + tb.height);
  ctx.strokeRect(tl.x, tl.y, tb.width * z, tb.height * z);
  ctx.beginPath();
  for (const row of tb.rows) {
    const a = P(row.rect.x, row.rect.y);
    const b = P(row.rect.x + row.rect.width, row.rect.y);
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
  }
  const la = P(tb.x + tb.labelWidth, tb.y);
  const lb = P(tb.x + tb.labelWidth, tb.y + tb.height);
  ctx.moveTo(la.x, la.y);
  ctx.lineTo(lb.x, lb.y);
  ctx.stroke();
  ctx.fillStyle = COLORS.entity;
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  for (const row of tb.rows) {
    const baseY = row.rect.y + row.rect.height / 2 - 1.2;
    const lp = P(row.rect.x + 2, baseY);
    ctx.font = `${Math.max(6, 2.5 * z)}px "Yu Gothic UI", "Meiryo", sans-serif`;
    ctx.fillText(row.field.label, lp.x, lp.y);
    const vp = P(row.rect.x + tb.labelWidth + 2, baseY);
    ctx.font = `${Math.max(6, 3.5 * z)}px "Yu Gothic UI", "Meiryo", sans-serif`;
    ctx.fillText(row.text, vp.x, vp.y);
  }
}

// 投影補助線(選択要素由来の一時ガイド)と45°ミラー線
function drawProjection(ctx, doc, view, state, paper, k) {
  const g = state.guides;
  const m45 = state.show45 ? doc.mirror45 : null;
  const hasGuides = g && (g.xs.length > 0 || g.ys.length > 0);
  if (!hasGuides && !m45) return;
  const W = paper.width / k;  // 実寸mmでの用紙範囲
  const H = paper.height / k;
  ctx.save();
  ctx.setLineDash([5, 4]);
  ctx.lineWidth = 1;
  if (hasGuides) {
    ctx.strokeStyle = '#3f8efc';
    for (const gx of g.xs) {
      strokeSegments(ctx, doc, view, [[{ x: gx, y: 0 }, { x: gx, y: H }]]);
    }
    for (const gy of g.ys) {
      strokeSegments(ctx, doc, view, [[{ x: 0, y: gy }, { x: W, y: gy }]]);
    }
  }
  if (m45) {
    ctx.strokeStyle = '#e8590c';
    const c = m45.y - m45.x; // y = x + c
    strokeSegments(ctx, doc, view, [[{ x: -H, y: -H + c }, { x: W + H, y: W + H + c }]]);
  }
  ctx.restore();
}

function strokeSegments(ctx, doc, view, segments) {
  ctx.beginPath();
  for (const [a, b] of segments) {
    const sa = realToScreen(a, doc, view);
    const sb = realToScreen(b, doc, view);
    ctx.moveTo(sa.x, sa.y);
    ctx.lineTo(sb.x, sb.y);
  }
  ctx.stroke();
}

function strokeEntity(ctx, doc, view, e, k) {
  const z = k * view.pxPerMm;
  if (e.type === 'circle') {
    const c = realToScreen({ x: e.cx, y: e.cy }, doc, view);
    ctx.beginPath();
    ctx.arc(c.x, c.y, e.r * z, 0, Math.PI * 2);
    ctx.stroke();
  } else if (e.type === 'arc') {
    const c = realToScreen({ x: e.cx, y: e.cy }, doc, view);
    ctx.beginPath();
    // 実座標はy上向き・画面はy下向きなので角度を反転して描く
    ctx.arc(c.x, c.y, e.r * z, -e.endAngle * DEG, -e.startAngle * DEG, false);
    ctx.stroke();
  } else if (e.type === 'ellipse') {
    const c = realToScreen({ x: e.cx, y: e.cy }, doc, view);
    ctx.beginPath();
    ctx.ellipse(c.x, c.y, e.rx * z, e.ry * z, 0, 0, Math.PI * 2);
    ctx.stroke();
  } else if (e.type === 'text') {
    const p = realToScreen({ x: e.x, y: e.y }, doc, view);
    ctx.font = `${Math.max(6, e.height * view.pxPerMm)}px "Yu Gothic UI", "Meiryo", sans-serif`;
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'left';
    ctx.fillStyle = ctx.strokeStyle;
    ctx.fillText(e.content, p.x, p.y);
  } else if (e.type === 'dim' || e.type === 'leader' || e.type === 'roughness' || e.type === 'fcf') {
    const layout = annotationLayout(e, k);
    strokeSegments(ctx, doc, view, layout.lines);
    if (layout.arcs) {
      for (const arc of layout.arcs) {
        const c = realToScreen(arc.c, doc, view);
        ctx.beginPath();
        ctx.arc(c.x, c.y, arc.r * z, -arc.endDeg * DEG, -arc.startDeg * DEG, false);
        ctx.stroke();
      }
    }
    drawArrows(ctx, doc, view, layout.arrows);
    drawDimTexts(ctx, doc, view, layout.texts);
  } else if (e.type === 'hatch') {
    strokeSegments(ctx, doc, view, hatchSegments(e.boundary, e.angleDeg, e.spacingMm / k));
  } else if (e.type === 'balloon') {
    const layout = balloonLayout(e, k);
    const c = realToScreen(layout.circle.c, doc, view);
    ctx.beginPath();
    ctx.arc(c.x, c.y, layout.circle.r * k * view.pxPerMm, 0, Math.PI * 2);
    ctx.stroke();
    strokeSegments(ctx, doc, view, layout.lines);
    drawArrows(ctx, doc, view, layout.arrows);
    drawDimTexts(ctx, doc, view, layout.texts);
  } else if (e.type === 'bom') {
    const layout = bomLayout(e, k);
    strokeSegments(ctx, doc, view, [...layout.hLines, ...layout.vLines]);
    const pad = 1.5 / k;
    const texts = [...layout.headers, ...layout.cells].map((cell) => ({
      x: cell.rect.x + pad,
      y: cell.rect.y + cell.rect.height / 2 - (DIM_TEXT_MM / k) * 0.35,
      content: cell.text, angleDeg: 0, align: 'left',
    }));
    drawDimTexts(ctx, doc, view, texts);
  } else {
    strokeSegments(ctx, doc, view, entitySegments(e));
  }
}

function drawArrows(ctx, doc, view, arrows) {
  const L = DIM_ARROW_MM * view.pxPerMm;
  const W = L / 3;
  ctx.fillStyle = ctx.strokeStyle;
  for (const a of arrows) {
    const tip = realToScreen(a.at, doc, view);
    const ang = -a.angleDeg * DEG; // y反転で角度も反転
    const bx = tip.x - L * Math.cos(ang);
    const by = tip.y - L * Math.sin(ang);
    const px = -Math.sin(ang);
    const py = Math.cos(ang);
    ctx.beginPath();
    ctx.moveTo(tip.x, tip.y);
    ctx.lineTo(bx + px * W / 2, by + py * W / 2);
    ctx.lineTo(bx - px * W / 2, by - py * W / 2);
    ctx.closePath();
    ctx.fill();
  }
}

function drawDimTexts(ctx, doc, view, texts) {
  ctx.font = `${Math.max(6, DIM_TEXT_MM * view.pxPerMm)}px "Yu Gothic UI", "Meiryo", sans-serif`;
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = ctx.strokeStyle;
  for (const t of texts) {
    const p = realToScreen({ x: t.x, y: t.y }, doc, view);
    ctx.save();
    ctx.translate(p.x, p.y);
    if (t.angleDeg) ctx.rotate(-t.angleDeg * DEG);
    ctx.textAlign = t.align === 'center' ? 'center' : t.align === 'right' ? 'right' : 'left';
    ctx.fillText(t.content, 0, 0);
    ctx.restore();
  }
  ctx.textAlign = 'left';
}

function drawEntities(ctx, doc, view, selection, k) {
  const visible = new Map(doc.layers.map((l) => [l.id, l.visible]));
  for (const e of doc.entities) {
    if (visible.get(e.layer) === false) continue;
    const style = LINE_STYLES[e.lineType] ?? LINE_STYLES.solid;
    const isSelected = selection.has(e.id);
    // 線の太さ・破線は用紙上mm基準(縮尺に依存しない)
    const width = Math.max(1, style.widthMm * view.pxPerMm);
    ctx.strokeStyle = isSelected ? COLORS.selected : COLORS.entity;
    ctx.lineWidth = isSelected ? width + 2 : width;
    ctx.setLineDash(style.dashMm.map((mm) => Math.max(1.5, mm * view.pxPerMm)));
    strokeEntity(ctx, doc, view, e, k);
  }
  ctx.setLineDash([]);
}

function drawSnapHint(ctx, doc, view, hint) {
  const s = realToScreen(hint, doc, view);
  ctx.save();
  ctx.strokeStyle = COLORS.snapHint;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  if (hint.kind === 'end') {
    ctx.rect(s.x - 5, s.y - 5, 10, 10);
  } else if (hint.kind === 'mid') {
    ctx.moveTo(s.x, s.y - 6); ctx.lineTo(s.x - 6, s.y + 5); ctx.lineTo(s.x + 6, s.y + 5);
    ctx.closePath();
  } else if (hint.kind === 'intersection') {
    ctx.moveTo(s.x - 5, s.y - 5); ctx.lineTo(s.x + 5, s.y + 5);
    ctx.moveTo(s.x - 5, s.y + 5); ctx.lineTo(s.x + 5, s.y - 5);
  } else { // center / quad
    ctx.arc(s.x, s.y, 5, 0, Math.PI * 2);
  }
  ctx.stroke();
  ctx.restore();
}

function drawOrigin(ctx, doc, view) {
  const s = realToScreen(doc.userOrigin, doc, view);
  ctx.strokeStyle = COLORS.origin;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(s.x - 10, s.y); ctx.lineTo(s.x + 10, s.y);
  ctx.moveTo(s.x, s.y - 10); ctx.lineTo(s.x, s.y + 10);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(s.x, s.y, 4, 0, Math.PI * 2);
  ctx.stroke();
}

function drawDraft(ctx, doc, view, draft) {
  ctx.save();
  ctx.setLineDash([6, 4]);
  ctx.lineWidth = 1.5;
  if (draft.kind === 'box') {
    ctx.strokeStyle = COLORS.selectBox;
    const { startScreen: a, currentScreen: b } = draft;
    ctx.strokeRect(Math.min(a.x, b.x), Math.min(a.y, b.y), Math.abs(b.x - a.x), Math.abs(b.y - a.y));
  } else {
    ctx.strokeStyle = COLORS.draft;
    if (draft.kind === 'line') {
      strokeSegments(ctx, doc, view, [[draft.start, draft.current]]);
    } else if (draft.kind === 'rect') {
      const x = Math.min(draft.start.x, draft.current.x);
      const y = Math.min(draft.start.y, draft.current.y);
      const e = {
        type: 'rect', x, y,
        width: Math.abs(draft.current.x - draft.start.x),
        height: Math.abs(draft.current.y - draft.start.y),
      };
      strokeSegments(ctx, doc, view, entitySegments(e));
    } else if (draft.kind === 'polyline') {
      const pts = [...draft.points, draft.current];
      const segs = [];
      for (let i = 0; i < pts.length - 1; i++) segs.push([pts[i], pts[i + 1]]);
      strokeSegments(ctx, doc, view, segs);
    } else if (draft.kind === 'spline') {
      const raw = [...draft.points.map((p) => [p.x, p.y]), [draft.current.x, draft.current.y]];
      const pts = catmullRomPoints(raw, false);
      const segs = [];
      for (let i = 0; i < pts.length - 1; i++) segs.push([pts[i], pts[i + 1]]);
      strokeSegments(ctx, doc, view, segs);
    } else if (draft.kind === 'angle') {
      strokeSegments(ctx, doc, view,
        draft.p1 ? [[draft.vertex, draft.p1], [draft.vertex, draft.current]]
          : [[draft.vertex, draft.current]]);
    } else if (draft.kind === 'circle') {
      const k = scaleK(doc.scale);
      const c = realToScreen(draft.center, doc, view);
      const r = Math.hypot(draft.current.x - draft.center.x, draft.current.y - draft.center.y);
      ctx.beginPath();
      ctx.arc(c.x, c.y, r * k * view.pxPerMm, 0, Math.PI * 2);
      ctx.stroke();
    } else if (draft.kind === 'arc') {
      const k = scaleK(doc.scale);
      const c = realToScreen(draft.center, doc, view);
      strokeSegments(ctx, doc, view, [[draft.center, draft.current]]);
      if (draft.stage === 2) {
        const r = Math.hypot(draft.startPoint.x - draft.center.x, draft.startPoint.y - draft.center.y);
        const a0 = Math.atan2(draft.startPoint.y - draft.center.y, draft.startPoint.x - draft.center.x);
        let a1 = Math.atan2(draft.current.y - draft.center.y, draft.current.x - draft.center.x);
        while (a1 <= a0) a1 += Math.PI * 2;
        ctx.beginPath();
        ctx.arc(c.x, c.y, r * k * view.pxPerMm, -a1, -a0, false);
        ctx.stroke();
      }
    } else if (draft.kind === 'dim') {
      if (draft.stage === 1) {
        strokeSegments(ctx, doc, view, [[draft.p1, draft.current]]);
      } else if (draft.orient) {
        const temp = {
          type: 'dim', dimType: 'linear', orient: draft.orient,
          p1: [draft.p1.x, draft.p1.y], p2: [draft.p2.x, draft.p2.y], offset: draft.offset,
        };
        strokeSegments(ctx, doc, view, dimLayout(temp, scaleK(doc.scale)).lines);
      }
    } else if (draft.kind === 'chamfer' || draft.kind === 'leaderDraft') {
      strokeSegments(ctx, doc, view, [[draft.from, draft.current]]);
    } else if (draft.kind === 'ellipse') {
      const k = scaleK(doc.scale);
      const c = realToScreen(draft.center, doc, view);
      const rx = Math.abs(draft.current.x - draft.center.x);
      const ry = Math.abs(draft.current.y - draft.center.y);
      if (rx > 0 && ry > 0) {
        ctx.beginPath();
        ctx.ellipse(c.x, c.y, rx * k * view.pxPerMm, ry * k * view.pxPerMm, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
  }
  ctx.restore();
}
