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

export function distancePointToSegment(p, a, b) {
  const abx = b.x - a.x, aby = b.y - a.y;
  const len2 = abx * abx + aby * aby;
  if (len2 === 0) return distance(p, a);
  let t = ((p.x - a.x) * abx + (p.y - a.y) * aby) / len2;
  t = Math.max(0, Math.min(1, t));
  return distance(p, { x: a.x + t * abx, y: a.y + t * aby });
}
