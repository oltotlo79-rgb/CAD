// ハッチング(断面の斜線)。閉じた図形(矩形・円・楕円・閉じた連続線)を
// 範囲として、平行線を範囲の内側だけ残して作る(内側かどうかは境目を横切った回数の偶奇で決める)。
// 使うのは geometry.js だけ(model.js と互いに読み込み合わないよう、辺を並べる処理はここに持つ)
import { round6 } from './geometry.js';

const DEG = Math.PI / 180;

// 図形からハッチの範囲を作る。ハッチを入れられない図形なら null
export function boundaryFromEntity(e) {
  if (e.type === 'rect') {
    if (e.rotation) {
      // 回転した矩形は4隅の多角形として扱う
      const rot = (e.rotation * Math.PI) / 180;
      const c = Math.cos(rot);
      const s = Math.sin(rot);
      const pt = (dx, dy) => [e.x + dx * c - dy * s, e.y + dx * s + dy * c];
      return { kind: 'polyline', points: [pt(0, 0), pt(e.width, 0), pt(e.width, e.height), pt(0, e.height)] };
    }
    return { kind: 'rect', x: e.x, y: e.y, width: e.width, height: e.height };
  }
  if (e.type === 'circle') return { kind: 'circle', cx: e.cx, cy: e.cy, r: e.r };
  if (e.type === 'ellipse') {
    if (e.rotation || e.startAngle != null) return null; // 回転した楕円・楕円弧にはまだ対応していない
    return { kind: 'ellipse', cx: e.cx, cy: e.cy, rx: e.rx, ry: e.ry };
  }
  if (e.type === 'polyline' && e.closed && e.points.length >= 3) {
    return { kind: 'polyline', points: e.points.map((p) => [...p]) };
  }
  return null;
}

// ハッチの範囲を囲む四角
export function boundaryBBox(b) {
  if (b.kind === 'rect') {
    return { minX: b.x, minY: b.y, maxX: b.x + b.width, maxY: b.y + b.height };
  }
  if (b.kind === 'circle') {
    return { minX: b.cx - b.r, minY: b.cy - b.r, maxX: b.cx + b.r, maxY: b.cy + b.r };
  }
  if (b.kind === 'ellipse') {
    return { minX: b.cx - b.rx, minY: b.cy - b.ry, maxX: b.cx + b.rx, maxY: b.cy + b.ry };
  }
  const bb = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
  for (const [x, y] of b.points) {
    bb.minX = Math.min(bb.minX, x); bb.minY = Math.min(bb.minY, y);
    bb.maxX = Math.max(bb.maxX, x); bb.maxY = Math.max(bb.maxY, y);
  }
  return bb;
}

// 四角・多角形の範囲の頂点の並び
function polygonPoints(b) {
  if (b.kind === 'rect') {
    return [[b.x, b.y], [b.x + b.width, b.y], [b.x + b.width, b.y + b.height], [b.x, b.y + b.height]];
  }
  return b.points;
}

// 点 p がハッチの範囲の中にあるか(クリックで選ぶときに使う)
export function pointInBoundary(b, p) {
  if (b.kind === 'circle') {
    return Math.hypot(p.x - b.cx, p.y - b.cy) <= b.r;
  }
  if (b.kind === 'ellipse') {
    if (b.rx <= 0 || b.ry <= 0) return false;
    return Math.hypot((p.x - b.cx) / b.rx, (p.y - b.cy) / b.ry) <= 1;
  }
  // 点から横へ伸ばした線が境目を横切る回数が奇数なら内側
  const pts = polygonPoints(b);
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i];
    const [xj, yj] = pts[j];
    if ((yi > p.y) !== (yj > p.y) &&
        p.x < ((xj - xi) * (p.y - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

// 基準点 p0・向き u(長さ1)の直線と、範囲の境目との交点の位置 t の一覧
function lineBoundaryTs(p0, u, b) {
  if (b.kind === 'circle' || b.kind === 'ellipse') {
    const rx = b.kind === 'circle' ? b.r : b.rx;
    const ry = b.kind === 'circle' ? b.r : b.ry;
    const px = (p0.x - b.cx) / rx;
    const py = (p0.y - b.cy) / ry;
    const ux = u.x / rx;
    const uy = u.y / ry;
    const A = ux * ux + uy * uy;
    const B = 2 * (px * ux + py * uy);
    const C = px * px + py * py - 1;
    const disc = B * B - 4 * A * C;
    if (disc <= 0 || A === 0) return [];
    const s = Math.sqrt(disc);
    return [(-B - s) / (2 * A), (-B + s) / (2 * A)];
  }
  const pts = polygonPoints(b);
  const ts = [];
  for (let i = 0; i < pts.length; i++) {
    const [ax, ay] = pts[i];
    const [dx2, dy2] = pts[(i + 1) % pts.length];
    const ex = dx2 - ax;
    const ey = dy2 - ay;
    const D = ex * u.y - ey * u.x;
    if (Math.abs(D) < 1e-12) continue;
    const t = (ex * (ay - p0.y) - ey * (ax - p0.x)) / D;
    const v = (u.x * (ay - p0.y) - u.y * (ax - p0.x)) / D;
    if (v >= 0 && v < 1) ts.push(t); // 辺の片方の端だけを含めて、頂点を2回数えないようにする
  }
  return ts;
}

// ハッチの線分を作る。spacing は実寸mm
export function hatchSegments(b, angleDeg, spacing) {
  const u = { x: Math.cos(angleDeg * DEG), y: Math.sin(angleDeg * DEG) };
  const n = { x: -u.y, y: u.x };
  const bb = boundaryBBox(b);
  const corners = [
    [bb.minX, bb.minY], [bb.maxX, bb.minY], [bb.minX, bb.maxY], [bb.maxX, bb.maxY],
  ];
  let c0 = Infinity;
  let c1 = -Infinity;
  for (const [x, y] of corners) {
    const c = x * n.x + y * n.y;
    c0 = Math.min(c0, c);
    c1 = Math.max(c1, c);
  }
  const segs = [];
  for (let c = Math.ceil(c0 / spacing) * spacing; c <= c1; c += spacing) {
    const p0 = { x: n.x * c, y: n.y * c };
    const ts = lineBoundaryTs(p0, u, b).sort((a, z) => a - z);
    for (let i = 0; i + 1 < ts.length; i += 2) {
      segs.push([
        { x: round6(p0.x + u.x * ts[i]), y: round6(p0.y + u.y * ts[i]) },
        { x: round6(p0.x + u.x * ts[i + 1]), y: round6(p0.y + u.y * ts[i + 1]) },
      ]);
    }
  }
  return segs;
}

// ハッチの範囲の平行移動(translateEntities から使う)
export function translateBoundary(b, dx, dy) {
  if (b.kind === 'rect') { b.x += dx; b.y += dy; }
  else if (b.kind === 'circle' || b.kind === 'ellipse') { b.cx += dx; b.cy += dy; }
  else if (b.kind === 'polyline') b.points = b.points.map(([x, y]) => [x + dx, y + dy]);
}
