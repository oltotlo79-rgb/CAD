import { paperDimensions, frameRect } from './papers.js';
import { scaleK, paperToScreen, realToPaper } from './viewTransform.js';
import { effectiveGridStep, MAJOR_STEP_MM } from './gridCalc.js';
import { entitySegments } from './model.js';

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

  const ftl = paperToScreen({ x: frame.x, y: frame.y + frame.height }, view);
  ctx.strokeStyle = COLORS.frame;
  ctx.lineWidth = Math.max(1, 0.7 * view.pxPerMm);
  ctx.strokeRect(ftl.x, ftl.y, frame.width * view.pxPerMm, frame.height * view.pxPerMm);

  drawEntities(ctx, doc, view, selection, k);
  drawOrigin(ctx, doc, view);
  if (draft) drawDraft(ctx, doc, view, draft);
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

function drawEntities(ctx, doc, view, selection, k) {
  const visible = new Map(doc.layers.map((l) => [l.id, l.visible]));
  const baseWidth = Math.max(1, 0.5 * k * view.pxPerMm); // 外形線 0.5mm
  for (const e of doc.entities) {
    if (visible.get(e.layer) === false) continue;
    const isSelected = selection.has(e.id);
    ctx.strokeStyle = isSelected ? COLORS.selected : COLORS.entity;
    ctx.lineWidth = isSelected ? baseWidth + 2 : baseWidth;
    strokeSegments(ctx, doc, view, entitySegments(e));
  }
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
    }
  }
  ctx.restore();
}
