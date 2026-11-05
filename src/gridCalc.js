// 方眼(グリッド)の間隔。自動のときは、拡大・縮小に合わせて見やすい間隔(画面で8px以上)を選ぶ
export const GRID_STEPS_MM = [0.1, 0.5, 1, 2, 5, 10];
export const MIN_GRID_PX = 8;
export const MAJOR_STEP_MM = 10;

// pxPerRealMm = 実寸1mmが画面上で何pxか (= scaleK * view.pxPerMm)
export function autoGridStep(pxPerRealMm) {
  for (const step of GRID_STEPS_MM) {
    if (step * pxPerRealMm >= MIN_GRID_PX) return step;
  }
  return null;
}

// 今使う方眼の間隔(手動なら指定の値、自動なら倍率に合わせた値)
export function effectiveGridStep(grid, pxPerRealMm) {
  if (grid.mode === 'manual') return grid.manualMm;
  return autoGridStep(pxPerRealMm);
}
