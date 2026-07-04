// ねじ穴(タップ穴)のワンクリック生成。
// JIS B 0205 並目ねじの呼び径と下穴径(≒呼び径-ピッチ、慣用値)。
export const THREAD_SIZES = {
  M3: { dia: 3, drill: 2.5 },
  M4: { dia: 4, drill: 3.3 },
  M5: { dia: 5, drill: 4.2 },
  M6: { dia: 6, drill: 5.0 },
  M8: { dia: 8, drill: 6.8 },
  M10: { dia: 10, drill: 8.5 },
  M12: { dia: 12, drill: 10.2 },
};

// 上面視のねじ穴を構成するエンティティ群(実寸mm)を返す。
// JIS表現: 下穴=太実線の円、ねじ谷=細実線の3/4円弧、中心線の十字。
// overhang は中心線のはみ出し量(実寸mm)。
export function threadHoleEntities(center, size, overhang = 3) {
  const spec = THREAD_SIZES[size];
  if (!spec) return null;
  const r = spec.dia / 2;
  const ext = r + overhang;
  return [
    {
      type: 'circle', cx: center.x, cy: center.y, r: spec.drill / 2,
      layer: 'outline', lineType: 'solid',
    },
    {
      type: 'arc', cx: center.x, cy: center.y, r,
      startAngle: 0, endAngle: 270,
      layer: 'outline', lineType: 'thin',
    },
    {
      type: 'line', x1: center.x - ext, y1: center.y, x2: center.x + ext, y2: center.y,
      layer: 'center', lineType: 'chain',
    },
    {
      type: 'line', x1: center.x, y1: center.y - ext, x2: center.x, y2: center.y + ext,
      layer: 'center', lineType: 'chain',
    },
  ];
}
