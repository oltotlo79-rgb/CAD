// 選んだ図形の「つまみ」(グリップ)。端・角・辺の真ん中などの小さな四角をドラッグすると、
// その点だけを動かして形を変える(直線を延ばす、四角の大きさを変える、寸法の補助線を動かす など)。
import { round6 } from './geometry.js';
import { ellipsePoint, isEllipseArc } from './model.js';

const DEG = Math.PI / 180;
const r6 = (v) => round6(v) || 0;
const P = (x, y) => ({ x, y });

// 矩形の局所座標(回転前、左下が原点)⇔ 図面の座標
function rectFrame(e) {
  const rot = (e.rotation ?? 0) * DEG;
  const c = Math.cos(rot);
  const s = Math.sin(rot);
  return {
    toWorld: (lx, ly) => P(e.x + lx * c - ly * s, e.y + lx * s + ly * c),
    toLocal: (p) => P((p.x - e.x) * c + (p.y - e.y) * s, -(p.x - e.x) * s + (p.y - e.y) * c),
  };
}
const RECT_CORNERS = [[0, 0], [1, 0], [1, 1], [0, 1]];
const RECT_EDGES = [[0.5, 0], [1, 0.5], [0.5, 1], [0, 0.5]]; // 下・右・上・左

function dimLineEnds(e) {
  const [x1, y1] = e.p1;
  const [x2, y2] = e.p2;
  if (e.orient === 'h') return [P(x1, e.offset), P(x2, e.offset)];
  if (e.orient === 'v') return [P(e.offset, y1), P(e.offset, y2)];
  const len = Math.hypot(x2 - x1, y2 - y1) || 1;
  const nx = (-(y2 - y1) / len) * e.offset;
  const ny = ((x2 - x1) / len) * e.offset;
  return [P(x1 + nx, y1 + ny), P(x2 + nx, y2 + ny)];
}

// 図形のつまみの一覧 [{ key, x, y }]
export function gripPoints(e) {
  const out = [];
  const put = (key, p) => out.push({ key, x: r6(p.x), y: r6(p.y) });
  if (e.type === 'line') {
    put('p1', P(e.x1, e.y1));
    put('p2', P(e.x2, e.y2));
  } else if (e.type === 'rect') {
    const f = rectFrame(e);
    RECT_CORNERS.forEach(([u, v], i) => put(`c${i}`, f.toWorld(u * e.width, v * e.height)));
    RECT_EDGES.forEach(([u, v], i) => put(`e${i}`, f.toWorld(u * e.width, v * e.height)));
  } else if (e.type === 'polyline' || e.type === 'spline' || e.type === 'leader') {
    e.points.forEach(([x, y], i) => put(`v${i}`, P(x, y)));
  } else if (e.type === 'circle') {
    [0, 90, 180, 270].forEach((a, i) => put(`q${i}`, P(e.cx + e.r * Math.cos(a * DEG), e.cy + e.r * Math.sin(a * DEG))));
  } else if (e.type === 'arc') {
    const at = (a) => P(e.cx + e.r * Math.cos(a * DEG), e.cy + e.r * Math.sin(a * DEG));
    put('start', at(e.startAngle));
    put('end', at(e.endAngle));
    put('mid', at((e.startAngle + e.endAngle) / 2));
  } else if (e.type === 'ellipse' && !isEllipseArc(e)) {
    [0, 90, 180, 270].forEach((u, i) => put(`q${i}`, ellipsePoint(e, u)));
  } else if (e.type === 'dim' && e.dimType === 'linear') {
    put('p1', P(e.p1[0], e.p1[1]));
    put('p2', P(e.p2[0], e.p2[1]));
    const [a, b] = dimLineEnds(e);
    put('line1', a);
    put('line2', b);
  } else if (e.type === 'dim' && (e.dimType === 'dia' || e.dimType === 'rad')) {
    put('edge', P(e.cx + e.r * Math.cos(e.angleDeg * DEG), e.cy + e.r * Math.sin(e.angleDeg * DEG)));
  } else if (e.type === 'dim' && e.dimType === 'angle') {
    const [vx, vy] = e.vertex;
    const a1 = Math.atan2(e.p1[1] - vy, e.p1[0] - vx);
    let a2 = Math.atan2(e.p2[1] - vy, e.p2[0] - vx);
    while (a2 <= a1) a2 += Math.PI * 2;
    const m = (a1 + a2) / 2;
    put('arc', P(vx + e.radius * Math.cos(m), vy + e.radius * Math.sin(m)));
  } else if (e.type === 'dim' && e.dimType === 'chamfer') {
    put('tail', P(e.tail[0], e.tail[1]));
  } else if (e.type === 'balloon') {
    put('at', P(e.at[0], e.at[1]));
    put('pos', P(e.pos[0], e.pos[1]));
  }
  return out;
}

// Shift で向きをそろえるときの基準点(直線は反対の端、連続線は1つ前の点)。なければ null
export function gripAnchor(e, key) {
  if (e.type === 'line') return key === 'p1' ? P(e.x2, e.y2) : P(e.x1, e.y1);
  if ((e.type === 'polyline' || e.type === 'spline' || e.type === 'leader') && key.startsWith('v')) {
    const i = Number(key.slice(1));
    const j = i > 0 ? i - 1 : (e.points.length > 1 ? 1 : null);
    return j == null ? null : P(e.points[j][0], e.points[j][1]);
  }
  return null;
}

// つまみ key を点 p へ動かして形を変える。変えられない(大きさが0になる等)なら false
export function moveGrip(e, key, p) {
  const A = (q) => [r6(q.x), r6(q.y)];
  if (e.type === 'line') {
    if (key === 'p1') { e.x1 = r6(p.x); e.y1 = r6(p.y); } else { e.x2 = r6(p.x); e.y2 = r6(p.y); }
    return true;
  }
  if (e.type === 'rect') {
    const f = rectFrame(e);
    const n = f.toLocal(p);
    let x0 = 0;
    let y0 = 0;
    let x1 = e.width;
    let y1 = e.height;
    if (key.startsWith('c')) {
      // 反対の角を残して、つまんだ角を p へ
      const [u, v] = RECT_CORNERS[Number(key.slice(1))];
      if (u) x1 = n.x; else x0 = n.x;
      if (v) y1 = n.y; else y0 = n.y;
    } else {
      const i = Number(key.slice(1));
      if (i === 0) y0 = n.y; else if (i === 1) x1 = n.x; else if (i === 2) y1 = n.y; else x0 = n.x;
    }
    const w = Math.abs(x1 - x0);
    const h = Math.abs(y1 - y0);
    if (w < 1e-9 || h < 1e-9) return false;
    const o = f.toWorld(Math.min(x0, x1), Math.min(y0, y1));
    e.x = r6(o.x); e.y = r6(o.y); e.width = r6(w); e.height = r6(h);
    return true;
  }
  if (e.type === 'polyline' || e.type === 'spline' || e.type === 'leader') {
    e.points[Number(key.slice(1))] = A(p);
    return true;
  }
  if (e.type === 'circle') {
    const r = Math.hypot(p.x - e.cx, p.y - e.cy);
    if (r < 1e-9) return false;
    e.r = r6(r);
    return true;
  }
  if (e.type === 'arc') {
    const ang = Math.atan2(p.y - e.cy, p.x - e.cx) / DEG;
    if (key === 'mid') {
      const r = Math.hypot(p.x - e.cx, p.y - e.cy);
      if (r < 1e-9) return false;
      e.r = r6(r);
      return true;
    }
    const start = key === 'start' ? r6(ang) : e.startAngle;
    let end = key === 'end' ? r6(ang) : e.endAngle;
    while (end <= start) end += 360;
    while (end - start > 360) end -= 360;
    e.startAngle = start;
    e.endAngle = r6(end);
    return true;
  }
  if (e.type === 'ellipse') {
    const rot = (e.rotation ?? 0) * DEG;
    const dx = p.x - e.cx;
    const dy = p.y - e.cy;
    const lx = Math.abs(dx * Math.cos(rot) + dy * Math.sin(rot));
    const ly = Math.abs(-dx * Math.sin(rot) + dy * Math.cos(rot));
    const i = Number(key.slice(1));
    if (i % 2 === 0) { if (lx < 1e-9) return false; e.rx = r6(lx); } else { if (ly < 1e-9) return false; e.ry = r6(ly); }
    return true;
  }
  if (e.type === 'dim' && e.dimType === 'linear') {
    if (key === 'p1' || key === 'p2') {
      e[key] = A(p);
      return true;
    }
    // 寸法線をつまんだ: 水平は上下、垂直は左右、平行は2点を結ぶ線から離す向きに動かす
    if (e.orient === 'h') e.offset = r6(p.y);
    else if (e.orient === 'v') e.offset = r6(p.x);
    else {
      const len = Math.hypot(e.p2[0] - e.p1[0], e.p2[1] - e.p1[1]) || 1;
      const nx = -(e.p2[1] - e.p1[1]) / len;
      const ny = (e.p2[0] - e.p1[0]) / len;
      e.offset = r6((p.x - e.p1[0]) * nx + (p.y - e.p1[1]) * ny);
    }
    return true;
  }
  if (e.type === 'dim' && (e.dimType === 'dia' || e.dimType === 'rad')) {
    if (p.x === e.cx && p.y === e.cy) return false;
    e.angleDeg = r6(Math.atan2(p.y - e.cy, p.x - e.cx) / DEG);
    return true;
  }
  if (e.type === 'dim' && e.dimType === 'angle') {
    const r = Math.hypot(p.x - e.vertex[0], p.y - e.vertex[1]);
    if (r < 1e-9) return false;
    e.radius = r6(r);
    return true;
  }
  if (e.type === 'dim' && e.dimType === 'chamfer') {
    e.tail = A(p);
    return true;
  }
  if (e.type === 'balloon') {
    e[key] = A(p);
    return true;
  }
  return false;
}
