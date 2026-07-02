// トリム・延長・オフセット(Phase 4 では対象を絞った実装)
// - トリム/延長: 直線(line)のみ対象。境界は全要素の線分と円/円弧(円として扱う)
import { entitySegments } from './model.js';
import {
  round6, distance, segSegIntersection, segCircleIntersections,
  raySegIntersection, rayCircleIntersections,
} from './geometry.js';

// 対象直線と他要素との交点を、直線のパラメータt(0..1)で列挙する
function intersectionParams(line, others) {
  const a = { x: line.x1, y: line.y1 };
  const b = { x: line.x2, y: line.y2 };
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return [];
  const toT = (p) => ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
  const ts = [];
  for (const o of others) {
    if (o.type === 'circle' || o.type === 'arc') {
      for (const p of segCircleIntersections(a, b, { x: o.cx, y: o.cy }, o.r)) {
        ts.push(toT(p));
      }
      continue;
    }
    for (const [c, d] of entitySegments(o)) {
      const p = segSegIntersection(a, b, c, d);
      if (p) ts.push(toT(p));
    }
  }
  const eps = 1e-6;
  return ts.filter((t) => t > eps && t < 1 - eps).sort((x, y) => x - y);
}

// クリック位置を挟む交点間の区間を取り除く。
// 戻り値: 置き換え後の線分プロパティ配列(交点がなければ null = 何もしない)
export function trimLine(line, clickPoint, others) {
  const ts = intersectionParams(line, others);
  if (ts.length === 0) return null;
  const a = { x: line.x1, y: line.y1 };
  const dx = line.x2 - line.x1;
  const dy = line.y2 - line.y1;
  const len2 = dx * dx + dy * dy;
  const tc = Math.max(0, Math.min(1,
    ((clickPoint.x - a.x) * dx + (clickPoint.y - a.y) * dy) / len2));
  let tLo = 0;
  let tHi = 1;
  for (const t of ts) {
    if (t <= tc) tLo = t;
    if (t >= tc) { tHi = t; break; }
  }
  const at = (t) => ({ x: round6(a.x + dx * t), y: round6(a.y + dy * t) });
  const pieces = [];
  const base = { type: 'line', layer: line.layer, lineType: line.lineType };
  if (tLo > 0) {
    const p = at(tLo);
    pieces.push({ ...base, x1: line.x1, y1: line.y1, x2: p.x, y2: p.y });
  }
  if (tHi < 1) {
    const p = at(tHi);
    pieces.push({ ...base, x1: p.x, y1: p.y, x2: line.x2, y2: line.y2 });
  }
  return pieces;
}

// クリックに近い側の端点を、他要素との最寄り交点まで延長する。
// 戻り値: 新しい端点座標 {x1,y1,x2,y2} | null(交点がない場合)
export function extendLine(line, clickPoint, others) {
  const p1 = { x: line.x1, y: line.y1 };
  const p2 = { x: line.x2, y: line.y2 };
  const fromP2 = distance(clickPoint, p2) <= distance(clickPoint, p1);
  const origin = fromP2 ? p2 : p1;
  const back = fromP2 ? p1 : p2;
  const len = distance(back, origin) || 1;
  const dir = { x: (origin.x - back.x) / len, y: (origin.y - back.y) / len };
  let best = null;
  for (const o of others) {
    if (o.type === 'circle' || o.type === 'arc') {
      for (const t of rayCircleIntersections(origin, dir, { x: o.cx, y: o.cy }, o.r)) {
        if (best === null || t < best) best = t;
      }
      continue;
    }
    for (const [c, d] of entitySegments(o)) {
      const t = raySegIntersection(origin, dir, c, d);
      if (t !== null && (best === null || t < best)) best = t;
    }
  }
  if (best === null) return null;
  const nx = round6(origin.x + dir.x * best);
  const ny = round6(origin.y + dir.y * best);
  return fromP2
    ? { x1: line.x1, y1: line.y1, x2: nx, y2: ny }
    : { x1: nx, y1: ny, x2: line.x2, y2: line.y2 };
}

// フィレット: 2本の直線の角に半径rの円弧を入れる。
// click1/click2 は各線分上のクリック位置(残す側の判定に使う)。
// 戻り値: { l1:{x1..y2}, l2:{...}, arc:{cx,cy,r,startAngle,endAngle} } | null
export function filletLines(l1, click1, l2, click2, r) {
  const d1 = { x: l1.x2 - l1.x1, y: l1.y2 - l1.y1 };
  const d2 = { x: l2.x2 - l2.x1, y: l2.y2 - l2.y1 };
  const denom = d1.x * d2.y - d1.y * d2.x;
  if (Math.abs(denom) < 1e-12) return null; // 平行
  // 無限直線同士の交点P
  const t = ((l2.x1 - l1.x1) * d2.y - (l2.y1 - l1.y1) * d2.x) / denom;
  const P = { x: l1.x1 + d1.x * t, y: l1.y1 + d1.y * t };
  // 各線について、クリック側へ向かう単位ベクトル
  const unitToward = (d, click) => {
    const len = Math.hypot(d.x, d.y) || 1;
    let u = { x: d.x / len, y: d.y / len };
    if ((click.x - P.x) * u.x + (click.y - P.y) * u.y < 0) u = { x: -u.x, y: -u.y };
    return u;
  };
  const u1 = unitToward(d1, click1);
  const u2 = unitToward(d2, click2);
  const cosT = u1.x * u2.x + u1.y * u2.y;
  const theta = Math.acos(Math.max(-1, Math.min(1, cosT)));
  if (theta < 1e-6 || Math.PI - theta < 1e-6) return null;
  const tan2 = Math.tan(theta / 2);
  const dist = r / tan2; // 接点までの距離
  const T1 = { x: round6(P.x + u1.x * dist), y: round6(P.y + u1.y * dist) };
  const T2 = { x: round6(P.x + u2.x * dist), y: round6(P.y + u2.y * dist) };
  const bis = { x: u1.x + u2.x, y: u1.y + u2.y };
  const bl = Math.hypot(bis.x, bis.y) || 1;
  const cDist = r / Math.sin(theta / 2);
  const C = { x: round6(P.x + (bis.x / bl) * cDist), y: round6(P.y + (bis.y / bl) * cDist) };
  let a1 = Math.atan2(T1.y - C.y, T1.x - C.x) * 180 / Math.PI;
  let a2 = Math.atan2(T2.y - C.y, T2.x - C.x) * 180 / Math.PI;
  let sweep = a2 - a1;
  while (sweep < 0) sweep += 360;
  if (sweep > 180) [a1, a2] = [a2, a1]; // 劣弧を採用
  while (a2 <= a1) a2 += 360;

  // P に近い側の端点を接点に置き換える(必要なら延長にもなる)
  const replaceNearEnd = (l, T) => {
    const d1p = Math.hypot(l.x1 - P.x, l.y1 - P.y);
    const d2p = Math.hypot(l.x2 - P.x, l.y2 - P.y);
    return d1p <= d2p
      ? { x1: T.x, y1: T.y, x2: l.x2, y2: l.y2 }
      : { x1: l.x1, y1: l.y1, x2: T.x, y2: T.y };
  };
  return {
    l1: replaceNearEnd(l1, T1),
    l2: replaceNearEnd(l2, T2),
    arc: { cx: C.x, cy: C.y, r, startAngle: round6(a1), endAngle: round6(a2) },
  };
}

// 平行複製。sidePoint 側に distance だけずらした複製のプロパティを返す
export function offsetEntity(e, dist, sidePoint) {
  if (dist <= 0) return null;
  if (e.type === 'line') {
    const len = Math.hypot(e.x2 - e.x1, e.y2 - e.y1);
    if (len === 0) return null;
    let nx = -(e.y2 - e.y1) / len;
    let ny = (e.x2 - e.x1) / len;
    const side = (sidePoint.x - e.x1) * nx + (sidePoint.y - e.y1) * ny;
    if (side < 0) { nx = -nx; ny = -ny; }
    return {
      type: 'line', layer: e.layer, lineType: e.lineType,
      x1: round6(e.x1 + nx * dist), y1: round6(e.y1 + ny * dist),
      x2: round6(e.x2 + nx * dist), y2: round6(e.y2 + ny * dist),
    };
  }
  if (e.type === 'circle' || e.type === 'arc') {
    const dCenter = Math.hypot(sidePoint.x - e.cx, sidePoint.y - e.cy);
    const r = dCenter >= e.r ? e.r + dist : e.r - dist;
    if (r <= 0) return null;
    const props = { type: e.type, layer: e.layer, lineType: e.lineType, cx: e.cx, cy: e.cy, r: round6(r) };
    if (e.type === 'arc') {
      props.startAngle = e.startAngle;
      props.endAngle = e.endAngle;
    }
    return props;
  }
  if (e.type === 'rect') {
    const inside = sidePoint.x > e.x && sidePoint.x < e.x + e.width &&
                   sidePoint.y > e.y && sidePoint.y < e.y + e.height;
    const d = inside ? -dist : dist;
    const width = e.width + d * 2;
    const height = e.height + d * 2;
    if (width <= 0 || height <= 0) return null;
    return {
      type: 'rect', layer: e.layer, lineType: e.lineType,
      x: round6(e.x - d), y: round6(e.y - d), width: round6(width), height: round6(height),
    };
  }
  return null;
}
