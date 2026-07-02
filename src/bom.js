// 部品表(BOM)。表として1枚の図面上に自由配置する。
export const BOM_COLS = [
  { field: 'no', label: '品番', widthMm: 12 },
  { field: 'name', label: '品名', widthMm: 45 },
  { field: 'qty', label: '数量', widthMm: 12 },
  { field: 'material', label: '材質', widthMm: 25 },
];
export const BOM_ROW_H_MM = 8; // 用紙mm

// e: {type:'bom', x, y(実寸mm・左下), rows:[{no,name,qty,material}]}
// 戻り値: { rect, hLines, vLines, cells:[{rowIndex, field, rect, text}], headers:[...] }
export function bomLayout(e, k = 1) {
  const rowH = BOM_ROW_H_MM / k;
  const widths = BOM_COLS.map((c) => c.widthMm / k);
  const totalW = widths.reduce((a, b) => a + b, 0);
  const totalH = rowH * (e.rows.length + 1); // +ヘッダ行
  const rect = { x: e.x, y: e.y, width: totalW, height: totalH };

  const hLines = [];
  for (let i = 0; i <= e.rows.length + 1; i++) {
    const y = e.y + i * rowH;
    hLines.push([{ x: e.x, y }, { x: e.x + totalW, y }]);
  }
  const vLines = [];
  let cx = e.x;
  for (let i = 0; i <= widths.length; i++) {
    vLines.push([{ x: cx, y: e.y }, { x: cx, y: e.y + totalH }]);
    cx += widths[i] ?? 0;
  }

  const cellsFor = (rowIndex, y) => {
    let x = e.x;
    return BOM_COLS.map((col, ci) => {
      const cell = {
        rowIndex,
        field: col.field,
        rect: { x, y, width: widths[ci], height: rowH },
        text: rowIndex < 0 ? col.label : String(e.rows[rowIndex][col.field] ?? ''),
      };
      x += widths[ci];
      return cell;
    });
  };

  // ヘッダは最上段、行は上から順
  const headers = cellsFor(-1, e.y + totalH - rowH);
  const cells = [];
  for (let i = 0; i < e.rows.length; i++) {
    cells.push(...cellsFor(i, e.y + totalH - rowH * (i + 2)));
  }
  return { rect, hLines, vLines, cells, headers };
}

// バルーンから初期行を作る(番号の昇順・重複なし)
export function bomRowsFromBalloons(entities) {
  const numbers = [...new Set(
    entities.filter((e) => e.type === 'balloon').map((e) => String(e.number)),
  )].sort((a, b) => Number(a) - Number(b));
  if (numbers.length === 0) {
    return [1, 2, 3].map((n) => ({ no: String(n), name: '', qty: '', material: '' }));
  }
  return numbers.map((n) => ({ no: n, name: '', qty: '', material: '' }));
}
