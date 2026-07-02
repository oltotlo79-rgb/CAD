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

export function effectiveGridStep(grid, pxPerRealMm) {
  if (grid.mode === 'manual') return grid.manualMm;
  return autoGridStep(pxPerRealMm);
}
