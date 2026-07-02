import { entitySnapPoints, entitySegments, entityBounds } from './model.js';
import { distance, segSegIntersection, segCircleIntersections } from './geometry.js';

function nearBounds(e, p, tolMm, k) {
  const b = entityBounds(e, k);
  return p.x >= b.minX - tolMm && p.x <= b.maxX + tolMm &&
         p.y >= b.minY - tolMm && p.y <= b.maxY + tolMm;
}

function intersectionsBetween(e1, e2) {
  const out = [];
  const segs1 = entitySegments(e1);
  const segs2 = entitySegments(e2);
  if (segs1.length > 0 && segs2.length > 0) {
    for (const [a, b] of segs1) {
      for (const [c, d] of segs2) {
        const ip = segSegIntersection(a, b, c, d);
        if (ip) out.push(ip);
      }
    }
    return out;
  }
  const circle = e1.type === 'circle' ? e1 : e2.type === 'circle' ? e2 : null;
  if (!circle) return out;
  const other = circle === e1 ? e2 : e1;
  for (const [a, b] of entitySegments(other)) {
    out.push(...segCircleIntersections(a, b, { x: circle.cx, y: circle.cy }, circle.r));
  }
  return out;
}

// p の近傍(tolMm以内)で最も近いスナップ点を返す
// 戻り値: { x, y, kind } | null。kind: end/mid/center/quad/intersection
export function findSnap(doc, p, tolMm, k = 1) {
  const near = [];
  const candidates = doc.entities.filter((e) => nearBounds(e, p, tolMm, k));
  for (const e of candidates) {
    for (const sp of entitySnapPoints(e)) {
      const d = distance(p, sp);
      if (d <= tolMm) near.push({ x: sp.x, y: sp.y, kind: sp.kind, d });
    }
  }
  for (let i = 0; i < candidates.length; i++) {
    for (let j = i + 1; j < candidates.length; j++) {
      for (const ip of intersectionsBetween(candidates[i], candidates[j])) {
        const d = distance(p, ip);
        if (d <= tolMm) near.push({ x: ip.x, y: ip.y, kind: 'intersection', d });
      }
    }
  }
  if (near.length === 0) return null;
  near.sort((a, b) => a.d - b.d);
  return { x: near[0].x, y: near[0].y, kind: near[0].kind };
}
