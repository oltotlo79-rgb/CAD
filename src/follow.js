// 寸法・引出線・バルーン・粗さ記号・ハッチ・中心線を、くっついている図形の変更に追従させる。
// 編集の前の図形(before)と編集の後(doc)を比べ、形が変わった図形の
// 「端・真ん中・中心」や「線の上の同じ位置」にぴったり付いていた点を、新しい位置へ移す。
// 付いているかどうかは座標の一致で調べるので、これまでに描いた図面にもそのまま効く。
import { entitySegments, ellipsePoint, isEllipseArc } from './model.js';
import { boundaryFromEntity } from './hatch.js';
import {
  distance, distancePointToSegment, polygonCentroid, round6,
} from './geometry.js';

const EPS = 1e-5; // 座標は小数6桁に丸めているので、これ以下の差は同じ点とみなす
const DEG = Math.PI / 180;
const SHAPES = ['line', 'rect', 'polyline', 'spline', 'circle', 'arc', 'ellipse'];
const isShape = (e) => SHAPES.includes(e.type);
const isCenterLine = (e) => e.type === 'line' && e.lineType === 'chain';
const pt = ([x, y]) => ({ x, y });
const arr = (p) => [round6(p.x) || 0, round6(p.y) || 0];
const add = (p, d) => ({ x: p.x + d.x, y: p.y + d.y });
const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y });
const same = (a, b) => distance(a, b) <= EPS;

// 図形の特徴点。key は編集の後に同じ点を求め直すための名前、kind は end/mid/center
function features(e) {
  const out = [];
  const put = (key, kind, p) => out.push({ key, kind, x: p.x, y: p.y });
  if (e.type === 'line') {
    put('p1', 'end', { x: e.x1, y: e.y1 });
    put('p2', 'end', { x: e.x2, y: e.y2 });
    put('mid', 'mid', { x: (e.x1 + e.x2) / 2, y: (e.y1 + e.y2) / 2 });
  } else if (e.type === 'rect' || e.type === 'polyline') {
    const segs = entitySegments(e);
    segs.forEach(([a, b], i) => {
      put(`v${i}`, 'end', a);
      put(`m${i}`, 'mid', { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
    });
    if (e.type === 'polyline' && !e.closed && e.points.length > 0) {
      put(`v${e.points.length - 1}`, 'end', pt(e.points[e.points.length - 1]));
    }
    if (e.type === 'rect') {
      put('center', 'center', { x: (segs[0][0].x + segs[1][1].x) / 2, y: (segs[0][0].y + segs[1][1].y) / 2 });
    } else if (e.closed && e.points.length >= 3) {
      put('center', 'center', polygonCentroid(e.points));
    }
  } else if (e.type === 'spline') {
    e.points.forEach((p, i) => put(`v${i}`, 'end', pt(p)));
  } else if (e.type === 'circle') {
    put('center', 'center', { x: e.cx, y: e.cy });
  } else if (e.type === 'arc') {
    put('center', 'center', { x: e.cx, y: e.cy });
    put('start', 'end', { x: e.cx + e.r * Math.cos(e.startAngle * DEG), y: e.cy + e.r * Math.sin(e.startAngle * DEG) });
    put('end', 'end', { x: e.cx + e.r * Math.cos(e.endAngle * DEG), y: e.cy + e.r * Math.sin(e.endAngle * DEG) });
  } else if (e.type === 'ellipse') {
    put('center', 'center', { x: e.cx, y: e.cy });
    if (isEllipseArc(e)) {
      put('start', 'end', ellipsePoint(e, e.startAngle));
      put('end', 'end', ellipsePoint(e, e.endAngle));
    }
  }
  return out;
}
const featureOf = (e, key) => features(e).find((f) => f.key === key) ?? null;

// 点 p が図形の線の上にあれば、その位置(線分の番号と割合、円の角度、楕円のパラメータ)
function curveParam(e, p) {
  if (e.type === 'line' || e.type === 'rect' || e.type === 'polyline') {
    const segs = entitySegments(e);
    for (let i = 0; i < segs.length; i++) {
      const [a, b] = segs[i];
      if (distancePointToSegment(p, a, b) > EPS) continue;
      const len2 = (b.x - a.x) ** 2 + (b.y - a.y) ** 2;
      const t = len2 === 0 ? 0 : ((p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y)) / len2;
      return { seg: i, t: Math.max(0, Math.min(1, t)) };
    }
    return null;
  }
  if (e.type === 'circle' || e.type === 'arc') {
    if (Math.abs(distance(p, { x: e.cx, y: e.cy }) - e.r) > EPS) return null;
    const ang = Math.atan2(p.y - e.cy, p.x - e.cx) / DEG;
    if (e.type === 'arc') {
      let sweep = e.endAngle - e.startAngle;
      while (sweep < 0) sweep += 360;
      let rel = ang - e.startAngle;
      while (rel < 0) rel += 360;
      if (rel > sweep + 1e-9) return null;
    }
    return { ang };
  }
  if (e.type === 'ellipse' && e.rx > 0 && e.ry > 0) {
    const rot = (e.rotation ?? 0) * DEG;
    const dx = p.x - e.cx;
    const dy = p.y - e.cy;
    const lx = dx * Math.cos(rot) + dy * Math.sin(rot);
    const ly = -dx * Math.sin(rot) + dy * Math.cos(rot);
    if (Math.abs(Math.hypot(lx / e.rx, ly / e.ry) - 1) * Math.min(e.rx, e.ry) > EPS) return null;
    return { u: Math.atan2(ly / e.ry, lx / e.rx) / DEG };
  }
  return null;
}
function pointAtParam(e, param) {
  if (param.seg != null) {
    if (e.type !== 'line' && e.type !== 'rect' && e.type !== 'polyline') return null;
    const seg = entitySegments(e)[param.seg];
    if (!seg) return null;
    const [a, b] = seg;
    return { x: a.x + (b.x - a.x) * param.t, y: a.y + (b.y - a.y) * param.t };
  }
  if (param.ang != null) {
    if (e.type !== 'circle' && e.type !== 'arc') return null;
    return { x: e.cx + e.r * Math.cos(param.ang * DEG), y: e.cy + e.r * Math.sin(param.ang * DEG) };
  }
  if (param.u != null && e.type === 'ellipse') return ellipsePoint(e, param.u);
  return null;
}

// 点 p が付いている、形の変わった図形の新しい位置。特徴点を線の上より優先。付いていなければ null
function followPoint(p, changed) {
  for (const { old, now } of changed) {
    const f = features(old).find((g) => same(g, p));
    const nf = f && featureOf(now, f.key);
    if (nf) return { x: nf.x, y: nf.y };
  }
  for (const { old, now } of changed) {
    const param = curveParam(old, p);
    const np = param && pointAtParam(now, param);
    if (np) return np;
  }
  return null;
}

// 点 p が、形の変わっていない図形のどれかに付いているか
function attachedTo(p, shapes) {
  return shapes.some((e) => features(e).some((f) => same(f, p)) || curveParam(e, p) != null);
}

// 水平・垂直の寸法は、測る点が動いても寸法線と図形の間隔を保つ
function keepDimLineGap(old, dim) {
  if (dim.orient !== 'h' && dim.orient !== 'v') return;
  const i = dim.orient === 'h' ? 1 : 0;
  const o = [old.p1[i], old.p2[i]];
  const n = [dim.p1[i], dim.p2[i]];
  if (old.offset >= Math.max(...o)) dim.offset = round6(old.offset + Math.max(...n) - Math.max(...o));
  else if (old.offset <= Math.min(...o)) dim.offset = round6(old.offset + Math.min(...n) - Math.min(...o));
  else dim.offset = round6(old.offset + (n[0] - o[0] + n[1] - o[1]) / 2);
}

// 形の変わった図形に付いている点を動かす。動かしたら true
function followAnnotation(old, e, changed) {
  const move = (p) => followPoint(pt(p), changed);
  if (e.type === 'dim' && (e.dimType === 'dia' || e.dimType === 'rad')) {
    const hit = changed.find(({ old: s, now }) => (s.type === 'circle' || s.type === 'arc')
      && (now.type === 'circle' || now.type === 'arc')
      && same({ x: s.cx, y: s.cy }, { x: old.cx, y: old.cy }) && Math.abs(s.r - old.r) <= EPS);
    if (!hit) return false;
    e.cx = hit.now.cx; e.cy = hit.now.cy; e.r = hit.now.r;
    return true;
  }
  if (e.type === 'dim' && (e.dimType === 'linear' || e.dimType === 'chamfer' || e.dimType === 'angle')) {
    const keys = e.dimType === 'angle' ? ['vertex', 'p1', 'p2'] : ['p1', 'p2'];
    const moved = keys.map((k) => move(old[k]));
    if (moved.every((m) => !m)) return false;
    keys.forEach((k, i) => { if (moved[i]) e[k] = arr(moved[i]); });
    if (e.dimType === 'linear') keepDimLineGap(old, e);
    if (e.dimType === 'chamfer') {
      // 文字の位置は、測る斜めの線の真ん中と同じだけ動く
      const mid = (d) => ({ x: (d.p1[0] + d.p2[0]) / 2, y: (d.p1[1] + d.p2[1]) / 2 });
      e.tail = arr(add(pt(old.tail), sub(mid(e), mid(old))));
    }
    return true;
  }
  if (e.type === 'leader' || e.type === 'balloon') {
    // 矢印の先が付いていき、折れ点・文字・丸は同じだけ動く
    const tip = e.type === 'leader' ? old.points[0] : old.at;
    const n = move(tip);
    if (!n) return false;
    const d = sub(n, pt(tip));
    if (e.type === 'leader') e.points = old.points.map((p, i) => (i === 0 ? arr(n) : arr(add(pt(p), d))));
    else { e.at = arr(n); e.pos = arr(add(pt(old.pos), d)); }
    return true;
  }
  if (e.type === 'roughness') {
    const n = move([old.x, old.y]);
    if (!n) return false;
    [e.x, e.y] = arr(n);
    return true;
  }
  if (e.type === 'hatch') {
    const hit = changed.find(({ old: s }) => sameBoundary(boundaryFromEntity(s), old.boundary));
    const b = hit && boundaryFromEntity(hit.now);
    if (!b) return false;
    e.boundary = b;
    return true;
  }
  return false;
}

function sameBoundary(a, b) {
  if (!a || !b || a.kind !== b.kind) return false;
  if (a.kind === 'polyline') {
    return a.points.length === b.points.length && a.points.every((p, i) => same(pt(p), pt(b.points[i])));
  }
  return ['x', 'y', 'width', 'height', 'cx', 'cy', 'r', 'rx', 'ry']
    .every((k) => (a[k] == null && b[k] == null) || Math.abs(a[k] - b[k]) <= EPS);
}

// 中心線(一点鎖線の直線)は、線の上にあるほかの図形の中心・辺の真ん中に付いていく。
// 両端はそれぞれ近いほうの点と同じだけ動く。円の中心なら、円の外へのはみ出しを保つ
function followCenterLine(old, line, beforeShapes, nowById, changedIds) {
  const a = { x: old.x1, y: old.y1 };
  const b = { x: old.x2, y: old.y2 };
  const on = [];
  for (const s of beforeShapes) {
    if (s.id === old.id || isCenterLine(s)) continue;
    for (const f of features(s)) {
      if (f.kind !== 'end' && distancePointToSegment(f, a, b) <= EPS) on.push({ s, f });
    }
  }
  if (!on.some(({ s }) => changedIds.has(s.id))) return false;
  const moveEnd = (p) => {
    const { s, f } = on.reduce((m, o) => (distance(p, o.f) < distance(p, m.f) ? o : m));
    const now = nowById.get(s.id);
    const nf = now && featureOf(now, f.key);
    if (!nf) return p;
    if (f.key === 'center' && (s.type === 'circle' || s.type === 'arc') && (now.type === 'circle' || now.type === 'arc')) {
      const v = sub(p, f);
      const len = Math.hypot(v.x, v.y);
      if (len > s.r) return add(nf, { x: (v.x * (len - s.r + now.r)) / len, y: (v.y * (len - s.r + now.r)) / len });
    }
    return add(p, sub(nf, f));
  };
  const na = moveEnd(a);
  const nb = moveEnd(b);
  if (same(na, a) && same(nb, b)) return false;
  [line.x1, line.y1] = arr(na);
  [line.x2, line.y2] = arr(nb);
  return true;
}

// 寸法・引出線などを自分だけで動かした(ownMove)とき: 図形に付いている点はそのまま残し、
// 寸法線・折れ点・文字・丸だけを動かす(付いていない注記は全体が動く)
function keepAttachedOnOwnMove(old, e, stillShapes) {
  const anchors = e.type === 'dim' && (e.dimType === 'linear' || e.dimType === 'chamfer') ? ['p1', 'p2']
    : e.type === 'leader' ? ['tip'] : e.type === 'balloon' ? ['at'] : null;
  if (!anchors) return false;
  const get = (d, k) => pt(k === 'tip' ? d.points[0] : d[k]);
  if (!anchors.every((k) => attachedTo(get(old, k), stillShapes))) return false;
  if (e.type === 'dim' && e.orient === 'aligned') {
    // 平行寸法は、動かした量のうち寸法線に直角な分だけ寸法線を離す
    const d = sub(pt(e.p1), pt(old.p1));
    const len = distance(pt(old.p1), pt(old.p2)) || 1;
    const nx = -(old.p2[1] - old.p1[1]) / len;
    const ny = (old.p2[0] - old.p1[0]) / len;
    e.offset = round6(old.offset + d.x * nx + d.y * ny);
  }
  for (const k of anchors) {
    if (k === 'tip') e.points[0] = [...old.points[0]];
    else e[k] = [...old[k]];
  }
  return true;
}

// before: 編集の前の図形(コピー)。編集の後の doc の注記・中心線を追従させ、動かした数を返す。
// options.ownMove: 選んだ図形を平行移動した操作(ドラッグ)なら true
export function followEdits(before, doc, options = {}) {
  const beforeById = new Map(before.map((e) => [e.id, e]));
  const nowById = new Map(doc.entities.map((e) => [e.id, e]));
  const jsonBefore = new Map(before.map((e) => [e.id, JSON.stringify(e)]));
  const changedNow = (e) => jsonBefore.has(e.id) && jsonBefore.get(e.id) !== JSON.stringify(e);
  const beforeShapes = before.filter(isShape);
  let count = 0;

  // 1) 中心線(自分は変わっていないもの)を、線の上の中心・辺の真ん中に合わせる
  const changedIds = new Set(doc.entities.filter((e) => isShape(e) && changedNow(e)).map((e) => e.id));
  if (changedIds.size > 0) {
    for (const e of doc.entities) {
      if (!isCenterLine(e) || changedIds.has(e.id) || !beforeById.has(e.id)) continue;
      if (followCenterLine(beforeById.get(e.id), e, beforeShapes, nowById, changedIds)) count++;
    }
  }

  // 2) 寸法・引出線など(中心線の動きも含めて、形の変わった図形に合わせる)
  const changed = doc.entities
    .filter((e) => isShape(e) && changedNow(e))
    .map((now) => ({ old: beforeById.get(now.id), now }));
  const stillShapes = beforeShapes.filter((s) => nowById.has(s.id) && !changedNow(nowById.get(s.id)));
  for (const e of doc.entities) {
    if (isShape(e) || !beforeById.has(e.id)) continue;
    const old = beforeById.get(e.id);
    if (changedNow(e)) {
      // 注記そのものを動かした
      if (options.ownMove && keepAttachedOnOwnMove(old, e, stillShapes)) count++;
      continue;
    }
    if (changed.length > 0 && followAnnotation(old, e, changed)) count++;
  }
  return count;
}
