import {
  entitySnapPoints, entitySegments, entityBounds, isEntityVisible,
} from './model.js';
import {
  distance, segSegIntersection, segCircleIntersections, round6,
} from './geometry.js';

const DEG = Math.PI / 180;

// 円・円弧の円周上で stepDeg ごとの点(円弧は弧の範囲内だけ)。引出線の矢印の先に使う
function perimeterPoints(e, stepDeg) {
  if (e.type !== 'circle' && e.type !== 'arc') return [];
  let sweep = e.type === 'arc' ? e.endAngle - e.startAngle : 360;
  while (sweep < 0) sweep += 360;
  const pts = [];
  for (let a = 0; a < 360; a += stepDeg) {
    if (e.type === 'arc') {
      let rel = a - e.startAngle;
      while (rel < 0) rel += 360;
      while (rel >= 360) rel -= 360;
      if (rel > sweep + 1e-9) continue;
    }
    pts.push({
      x: round6(e.cx + e.r * Math.cos(a * DEG)), y: round6(e.cy + e.r * Math.sin(a * DEG)), kind: 'quad',
    });
  }
  return pts;
}

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
// options.perimeterStepDeg: 円・円弧の円周の点を、上下左右に加えてこの角度ごとにも出す(引出線の矢印の先)
export function findSnap(doc, p, tolMm, k = 1, options = {}) {
  const near = [];
  // 見えていない図形(非表示レイヤー)には吸着しない
  const candidates = doc.entities.filter((e) => isEntityVisible(doc, e) && nearBounds(e, p, tolMm, k));
  for (const e of candidates) {
    const extra = options.perimeterStepDeg ? perimeterPoints(e, options.perimeterStepDeg) : [];
    for (const sp of [...entitySnapPoints(e), ...extra]) {
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
