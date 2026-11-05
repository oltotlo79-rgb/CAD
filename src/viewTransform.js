// 座標の変換: 実寸(mm) ⇔ 用紙の上(mm、縮尺をかけた大きさ) ⇔ 画面(px)。拡大・縮小と全体表示の計算もここ
// 縮尺の倍率(1:2 なら 0.5)
export function scaleK(scale) {
  return scale.ratio[0] / scale.ratio[1];
}

// 実寸の座標 → 用紙の上の座標
export function realToPaper(p, scale) {
  const k = scaleK(scale);
  return { x: p.x * k, y: p.y * k };
}

// 用紙の上の座標 → 実寸の座標
export function paperToReal(p, scale) {
  const k = scaleK(scale);
  return { x: p.x / k, y: p.y / k };
}

// 用紙の座標 → 画面の座標(画面は下向きがプラスなので上下を逆にする)
export function paperToScreen(p, view) {
  return {
    x: (p.x - view.panX) * view.pxPerMm,
    y: view.canvasHeight - (p.y - view.panY) * view.pxPerMm,
  };
}

// 画面の座標 → 用紙の座標
export function screenToPaper(p, view) {
  return {
    x: p.x / view.pxPerMm + view.panX,
    y: (view.canvasHeight - p.y) / view.pxPerMm + view.panY,
  };
}

// 画面の点 screenPoint を中心に factor 倍に拡大・縮小する(マウスの下の点がずれない)
export function zoomAt(view, screenPoint, factor) {
  const pxPerMm = Math.min(2000, Math.max(0.05, view.pxPerMm * factor));
  const before = screenToPaper(screenPoint, view);
  const next = { ...view, pxPerMm };
  const after = screenToPaper(screenPoint, next);
  return { ...next, panX: next.panX + before.x - after.x, panY: next.panY + before.y - after.y };
}

// 用紙全体がキャンバスに余白付きで収まる表示
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
