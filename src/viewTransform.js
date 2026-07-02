export function scaleK(scale) {
  return scale.ratio[0] / scale.ratio[1];
}

export function realToPaper(p, scale) {
  const k = scaleK(scale);
  return { x: p.x * k, y: p.y * k };
}

export function paperToReal(p, scale) {
  const k = scaleK(scale);
  return { x: p.x / k, y: p.y / k };
}

export function paperToScreen(p, view) {
  return {
    x: (p.x - view.panX) * view.pxPerMm,
    y: view.canvasHeight - (p.y - view.panY) * view.pxPerMm,
  };
}

export function screenToPaper(p, view) {
  return {
    x: p.x / view.pxPerMm + view.panX,
    y: (view.canvasHeight - p.y) / view.pxPerMm + view.panY,
  };
}

export function zoomAt(view, screenPoint, factor) {
  const pxPerMm = Math.min(2000, Math.max(0.05, view.pxPerMm * factor));
  const before = screenToPaper(screenPoint, view);
  const next = { ...view, pxPerMm };
  const after = screenToPaper(screenPoint, next);
  return { ...next, panX: next.panX + before.x - after.x, panY: next.panY + before.y - after.y };
}

export function fitPaperView(paperW, paperH, canvasW, canvasH, marginPx = 40) {
  const pxPerMm = Math.min((canvasW - marginPx * 2) / paperW, (canvasH - marginPx * 2) / paperH);
  return {
    pxPerMm,
    panX: -(canvasW / pxPerMm - paperW) / 2,
    panY: -(canvasH / pxPerMm - paperH) / 2,
    canvasWidth: canvasW,
    canvasHeight: canvasH,
  };
}
