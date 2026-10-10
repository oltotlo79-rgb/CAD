// 正多角形(すべての辺の長さと角の大きさが等しい多角形)の作図計算。
// できあがりは閉じた連続線の頂点(実寸mm)。
import { round6 } from './geometry.js';
import { parseNumber } from './model.js';

const DEG = Math.PI / 180;

// 大きさの決め方。target はマウスでクリックする点(辺の真ん中か角か)
export const POLYGON_SIZE_MODES = {
  side: { label: '二面幅', target: 'side' },     // 向かい合う辺の間(中心→辺の2倍)
  corner: { label: '対角', target: 'corner' },   // 向かい合う角の間(中心→角の2倍)
  edge: { label: '一辺', target: 'corner' },     // 1つの辺の長さ
};
export const POLYGON_MIN_SIDES = 3;
export const POLYGON_MAX_SIDES = 64;

// 角数の入力値。3〜64の整数なら数、それ以外は null
export function parseSides(value) {
  const n = parseNumber(value);
  return Number.isInteger(n) && n >= POLYGON_MIN_SIDES && n <= POLYGON_MAX_SIDES ? n : null;
}

// 中心から角までの距離(角を通る円の半径)
function circumradius(sides, size, mode) {
  if (mode === 'side') return size / 2 / Math.cos(Math.PI / sides);
  if (mode === 'edge') return size / 2 / Math.sin(Math.PI / sides);
  return size / 2;
}

// 中心からクリック点(辺の真ん中 or 角)までの距離 → 大きさの値
function sizeFromDistance(sides, dist, mode) {
  if (mode === 'edge') return 2 * dist * Math.sin(Math.PI / sides);
  return 2 * dist;
}

// 正多角形の頂点(左回り)。angleDeg は中心から見た「辺の真ん中」(二面幅)または「角」(対角・一辺)の向き。
// 二面幅のときは最初の辺(頂点0→1)の真ん中が angleDeg の向きにくる
export function regularPolygonPoints(center, sides, size, angleDeg, mode = 'side') {
  const R = circumradius(sides, size, mode);
  const step = 360 / sides;
  const start = POLYGON_SIZE_MODES[mode]?.target === 'side' ? angleDeg - step / 2 : angleDeg;
  return Array.from({ length: sides }, (_, i) => {
    const a = (start + i * step) * DEG;
    return [round6(center.x + R * Math.cos(a)) || 0, round6(center.y + R * Math.sin(a)) || 0];
  });
}

// マウスの位置から大きさと向きを決める。ふだんは向きを15°刻みに丸め、中心からの距離は
// その向きに測る(グリッドの点を少し外れても大きさ・向きがずれない)。
// exact=true(点スナップで吸い付いた点)なら、その点にぴったり合わせる
export function polygonFromCursor(center, cursor, sides, mode, exact = false) {
  const dx = cursor.x - center.x;
  const dy = cursor.y - center.y;
  if (dx === 0 && dy === 0) return null;
  let angleDeg = Math.atan2(dy, dx) / DEG;
  let dist = Math.hypot(dx, dy);
  if (!exact) {
    angleDeg = Math.round(angleDeg / 15) * 15;
    dist = dx * Math.cos(angleDeg * DEG) + dy * Math.sin(angleDeg * DEG);
  }
  if (angleDeg <= -180) angleDeg += 360;
  if (!(dist > 0)) return null;
  return { size: round6(sizeFromDistance(sides, dist, mode)), angleDeg: round6(angleDeg) || 0 };
}
