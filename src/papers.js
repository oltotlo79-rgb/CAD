// 縦置き(portrait)基準の寸法。B列はJIS B。
export const PAPER_SIZES = {
  A2: { width: 420, height: 594 },
  A3: { width: 297, height: 420 },
  A4: { width: 210, height: 297 },
  B3: { width: 364, height: 515 },
  B4: { width: 257, height: 364 },
  B5: { width: 182, height: 257 },
};

export const FRAME_MARGIN_MM = 10;

export function paperDimensions(size, orientation) {
  const base = PAPER_SIZES[size];
  if (!base) throw new Error(`unknown paper size: ${size}`);
  return orientation === 'landscape'
    ? { width: base.height, height: base.width }
    : { width: base.width, height: base.height };
}

// 用紙mm・左下原点の図面枠矩形
export function frameRect(size, orientation) {
  const { width, height } = paperDimensions(size, orientation);
  return {
    x: FRAME_MARGIN_MM,
    y: FRAME_MARGIN_MM,
    width: width - FRAME_MARGIN_MM * 2,
    height: height - FRAME_MARGIN_MM * 2,
  };
}
