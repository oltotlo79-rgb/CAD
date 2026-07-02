const DEG = Math.PI / 180;

export function round6(v) {
  return Math.round(v * 1e6) / 1e6;
}

export function distance(a, b) {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

export function angleDegOf(a, b) {
  return Math.atan2(b.y - a.y, b.x - a.x) / DEG;
}

export function lineEndPoint(start, lengthMm, angleDeg) {
  return {
    x: round6(start.x + lengthMm * Math.cos(angleDeg * DEG)),
    y: round6(start.y + lengthMm * Math.sin(angleDeg * DEG)),
  };
}

export function snapToGrid(p, stepMm) {
  return {
    x: round6(Math.round(p.x / stepMm) * stepMm),
    y: round6(Math.round(p.y / stepMm) * stepMm),
  };
}

// 点pを中心cまわりに+90°(反時計回り)回転
export function rotate90Point(p, c) {
  return { x: round6(c.x - (p.y - c.y)), y: round6(c.y + (p.x - c.x)) };
}

// 線分ab×線分cd の交点(なければnull)
export function segSegIntersection(a, b, c, d) {
  const r = { x: b.x - a.x, y: b.y - a.y };
  const s = { x: d.x - c.x, y: d.y - c.y };
  const denom = r.x * s.y - r.y * s.x;
  if (Math.abs(denom) < 1e-12) return null;
  const t = ((c.x - a.x) * s.y - (c.y - a.y) * s.x) / denom;
  const u = ((c.x - a.x) * r.y - (c.y - a.y) * r.x) / denom;
  if (t < -1e-9 || t > 1 + 1e-9 || u < -1e-9 || u > 1 + 1e-9) return null;
  return { x: round6(a.x + t * r.x), y: round6(a.y + t * r.y) };
}

// 線分ab×円(中心c半径r) の交点列(0〜2個)
export function segCircleIntersections(a, b, c, r) {
  const d = { x: b.x - a.x, y: b.y - a.y };
  const f = { x: a.x - c.x, y: a.y - c.y };
  const A = d.x * d.x + d.y * d.y;
  if (A === 0) return [];
  const B = 2 * (f.x * d.x + f.y * d.y);
  const C = f.x * f.x + f.y * f.y - r * r;
  let disc = B * B - 4 * A * C;
  if (disc < 0) return [];
  disc = Math.sqrt(disc);
  const out = [];
  for (const t of [(-B - disc) / (2 * A), (-B + disc) / (2 * A)]) {
    if (t >= -1e-9 && t <= 1 + 1e-9) {
      out.push({ x: round6(a.x + t * d.x), y: round6(a.y + t * d.y) });
    }
  }
  if (out.length === 2 && out[0].x === out[1].x && out[0].y === out[1].y) out.pop();
  return out;
}

export function distancePointToSegment(p, a, b) {
  const abx = b.x - a.x, aby = b.y - a.y;
  const len2 = abx * abx + aby * aby;
  if (len2 === 0) return distance(p, a);
  let t = ((p.x - a.x) * abx + (p.y - a.y) * aby) / len2;
  t = Math.max(0, Math.min(1, t));
  return distance(p, { x: a.x + t * abx, y: a.y + t * aby });
}
