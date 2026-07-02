import { FRAME_MARGIN_MM } from './papers.js';
import {
  distance, angleDegOf, distancePointToSegment, rotate90Point,
} from './geometry.js';
import { dimLayout, DIM_TEXT_MM } from './dims.js';

// 線種ごとの描画スタイル。太さ・破線は用紙上mm(縮尺に依存しない)
export const LINE_STYLES = {
  solid:  { widthMm: 0.5,  dashMm: [] },
  dashed: { widthMm: 0.35, dashMm: [3, 1.5] },
  chain:  { widthMm: 0.25, dashMm: [8, 1.5, 1.5, 1.5] },
  chain2: { widthMm: 0.25, dashMm: [8, 1.5, 1.5, 1.5, 1.5, 1.5] },
  thin:   { widthMm: 0.25, dashMm: [] },
};

// 線種UIプリセット → lineType と配置レイヤー
export const STYLE_PRESETS = {
  outline: { label: '外形線',   lineType: 'solid',  layer: 'outline' },
  hidden:  { label: 'かくれ線', lineType: 'dashed', layer: 'hidden' },
  center:  { label: '中心線',   lineType: 'chain',  layer: 'center' },
  phantom: { label: '想像線',   lineType: 'chain2', layer: 'outline' },
  aux:     { label: '補助線',   lineType: 'thin',   layer: 'aux' },
};

export const DEFAULT_LAYERS = [
  { id: 'outline', name: '外形線', visible: true, printable: true },
  { id: 'hidden', name: 'かくれ線', visible: true, printable: true },
  { id: 'center', name: '中心線', visible: true, printable: true },
  { id: 'dim', name: '寸法', visible: true, printable: true },
  { id: 'note', name: '注記', visible: true, printable: true },
  { id: 'aux', name: '補助線', visible: true, printable: false },
];

export function createDocument({ paperSize = 'A3', orientation = 'landscape' } = {}) {
  return {
    format: 'seizu-tool',
    version: 1,
    paper: { size: paperSize, orientation },
    scale: { ratio: [1, 1] },
    userOrigin: { x: FRAME_MARGIN_MM, y: FRAME_MARGIN_MM },
    grid: { mode: 'auto', manualMm: 1 },
    mirror45: null, // 45°ミラー線の通過点 {x,y}(実寸mm)。nullなら未設定
    layers: DEFAULT_LAYERS.map((l) => ({ ...l })),
    nextId: 1,
    entities: [],
  };
}

export function addEntity(doc, props) {
  const entity = { layer: 'outline', lineType: 'solid', ...props, id: doc.nextId };
  doc.nextId += 1;
  doc.entities.push(entity);
  return entity;
}

export function removeEntities(doc, ids) {
  const drop = new Set(ids);
  doc.entities = doc.entities.filter((e) => !drop.has(e.id));
}

export function translateEntities(doc, ids, dx, dy) {
  const target = new Set(ids);
  for (const e of doc.entities) {
    if (!target.has(e.id)) continue;
    if (e.type === 'line') {
      e.x1 += dx; e.y1 += dy; e.x2 += dx; e.y2 += dy;
    } else if (e.type === 'rect') {
      e.x += dx; e.y += dy;
    } else if (e.type === 'polyline') {
      e.points = e.points.map(([x, y]) => [x + dx, y + dy]);
    } else if (e.type === 'circle' || e.type === 'arc' || e.type === 'ellipse') {
      e.cx += dx; e.cy += dy;
    } else if (e.type === 'text') {
      e.x += dx; e.y += dy;
    } else if (e.type === 'dim') {
      if (e.dimType === 'linear') {
        e.p1 = [e.p1[0] + dx, e.p1[1] + dy];
        e.p2 = [e.p2[0] + dx, e.p2[1] + dy];
        if (e.orient === 'h') e.offset += dy;
        else if (e.orient === 'v') e.offset += dx;
      } else if (e.dimType === 'dia' || e.dimType === 'rad') {
        e.cx += dx; e.cy += dy;
      } else if (e.dimType === 'chamfer') {
        e.p1 = [e.p1[0] + dx, e.p1[1] + dy];
        e.p2 = [e.p2[0] + dx, e.p2[1] + dy];
        e.tail = [e.tail[0] + dx, e.tail[1] + dy];
      }
    } else if (e.type === 'leader') {
      e.points = e.points.map(([x, y]) => [x + dx, y + dy]);
    }
  }
}

// 選択要素を center まわりに +90°(反時計回り)回転する
export function rotate90Entities(doc, ids, center) {
  const target = new Set(ids);
  for (const e of doc.entities) {
    if (!target.has(e.id)) continue;
    if (e.type === 'line') {
      const p1 = rotate90Point({ x: e.x1, y: e.y1 }, center);
      const p2 = rotate90Point({ x: e.x2, y: e.y2 }, center);
      e.x1 = p1.x; e.y1 = p1.y; e.x2 = p2.x; e.y2 = p2.y;
    } else if (e.type === 'rect') {
      const c = rotate90Point({ x: e.x + e.width / 2, y: e.y + e.height / 2 }, center);
      const w = e.height, h = e.width;
      e.x = c.x - w / 2; e.y = c.y - h / 2; e.width = w; e.height = h;
    } else if (e.type === 'polyline') {
      e.points = e.points.map(([x, y]) => {
        const p = rotate90Point({ x, y }, center);
        return [p.x, p.y];
      });
    } else if (e.type === 'circle') {
      const c = rotate90Point({ x: e.cx, y: e.cy }, center);
      e.cx = c.x; e.cy = c.y;
    } else if (e.type === 'arc') {
      const c = rotate90Point({ x: e.cx, y: e.cy }, center);
      e.cx = c.x; e.cy = c.y;
      e.startAngle += 90; e.endAngle += 90;
    } else if (e.type === 'ellipse') {
      const c = rotate90Point({ x: e.cx, y: e.cy }, center);
      e.cx = c.x; e.cy = c.y;
      const rx = e.ry; e.ry = e.rx; e.rx = rx;
    } else if (e.type === 'text') {
      const p = rotate90Point({ x: e.x, y: e.y }, center);
      e.x = p.x; e.y = p.y;
    }
  }
}

export function duplicateEntities(doc, ids, dx, dy) {
  const clones = [];
  for (const e of doc.entities.filter((en) => ids.includes(en.id))) {
    const { id, ...rest } = e;
    clones.push(addEntity(doc, structuredClone(rest)));
  }
  translateEntities(doc, clones.map((e) => e.id), dx, dy);
  return clones;
}

export function entitySegments(e) {
  if (e.type === 'line') {
    return [[{ x: e.x1, y: e.y1 }, { x: e.x2, y: e.y2 }]];
  }
  if (e.type === 'rect') {
    const p = [
      { x: e.x, y: e.y },
      { x: e.x + e.width, y: e.y },
      { x: e.x + e.width, y: e.y + e.height },
      { x: e.x, y: e.y + e.height },
    ];
    return [[p[0], p[1]], [p[1], p[2]], [p[2], p[3]], [p[3], p[0]]];
  }
  if (e.type === 'polyline') {
    const pts = e.points.map(([x, y]) => ({ x, y }));
    const segs = [];
    for (let i = 0; i < pts.length - 1; i++) segs.push([pts[i], pts[i + 1]]);
    if (e.closed && pts.length > 2) segs.push([pts[pts.length - 1], pts[0]]);
    return segs;
  }
  return [];
}

// 選択要素を鏡映反転する。axis='x'は左右反転(x=center.xの縦軸)、'y'は上下反転
export function mirrorEntities(doc, ids, axis, center) {
  const target = new Set(ids);
  const mx = (x) => 2 * center.x - x;
  const my = (y) => 2 * center.y - y;
  const mp = (x, y) => (axis === 'x' ? [mx(x), y] : [x, my(y)]);
  // 円弧などの角度: 左右反転はθ→180-θ、上下反転はθ→-θ(掃引の向きを保つためstart/endを入替)
  const mAngles = (start, end) => (axis === 'x'
    ? [180 - end, 180 - start]
    : [-end || 0, -start || 0]); // `|| 0` は -0 を +0 に正規化
  for (const e of doc.entities) {
    if (!target.has(e.id)) continue;
    if (e.type === 'line') {
      [e.x1, e.y1] = mp(e.x1, e.y1);
      [e.x2, e.y2] = mp(e.x2, e.y2);
    } else if (e.type === 'rect') {
      const [nx, ny] = mp(e.x, e.y);
      e.x = axis === 'x' ? nx - e.width : nx;
      e.y = axis === 'y' ? ny - e.height : ny;
    } else if (e.type === 'polyline') {
      e.points = e.points.map(([x, y]) => mp(x, y));
    } else if (e.type === 'circle') {
      [e.cx, e.cy] = mp(e.cx, e.cy);
    } else if (e.type === 'arc') {
      [e.cx, e.cy] = mp(e.cx, e.cy);
      [e.startAngle, e.endAngle] = mAngles(e.startAngle, e.endAngle);
    } else if (e.type === 'ellipse') {
      [e.cx, e.cy] = mp(e.cx, e.cy);
    } else if (e.type === 'text') {
      [e.x, e.y] = mp(e.x, e.y);
    } else if (e.type === 'dim') {
      if (e.dimType === 'linear') {
        e.p1 = mp(e.p1[0], e.p1[1]);
        e.p2 = mp(e.p2[0], e.p2[1]);
        if (e.orient === 'h' && axis === 'y') e.offset = my(e.offset);
        else if (e.orient === 'v' && axis === 'x') e.offset = mx(e.offset);
        else if (e.orient === 'aligned') e.offset = -e.offset;
      } else if (e.dimType === 'dia' || e.dimType === 'rad') {
        [e.cx, e.cy] = mp(e.cx, e.cy);
        e.angleDeg = axis === 'x' ? 180 - e.angleDeg : -e.angleDeg;
      } else if (e.dimType === 'chamfer') {
        e.p1 = mp(e.p1[0], e.p1[1]);
        e.p2 = mp(e.p2[0], e.p2[1]);
        e.tail = mp(e.tail[0], e.tail[1]);
      }
    } else if (e.type === 'leader') {
      e.points = e.points.map(([x, y]) => mp(x, y));
    }
  }
}

const DEG = Math.PI / 180;

// オブジェクトスナップの候補点(端点・中点・中心・四半点)
export function entitySnapPoints(e) {
  const pts = [];
  const push = (x, y, kind) => pts.push({ x, y, kind });
  if (e.type === 'line') {
    push(e.x1, e.y1, 'end');
    push(e.x2, e.y2, 'end');
    push((e.x1 + e.x2) / 2, (e.y1 + e.y2) / 2, 'mid');
  } else if (e.type === 'rect' || e.type === 'polyline') {
    for (const [a, b] of entitySegments(e)) {
      push(a.x, a.y, 'end');
      push((a.x + b.x) / 2, (a.y + b.y) / 2, 'mid');
    }
    if (e.type === 'polyline' && !e.closed && e.points.length > 0) {
      const last = e.points[e.points.length - 1];
      push(last[0], last[1], 'end');
    }
  } else if (e.type === 'circle') {
    push(e.cx, e.cy, 'center');
    push(e.cx + e.r, e.cy, 'quad'); push(e.cx - e.r, e.cy, 'quad');
    push(e.cx, e.cy + e.r, 'quad'); push(e.cx, e.cy - e.r, 'quad');
  } else if (e.type === 'arc') {
    push(e.cx, e.cy, 'center');
    push(e.cx + e.r * Math.cos(e.startAngle * DEG), e.cy + e.r * Math.sin(e.startAngle * DEG), 'end');
    push(e.cx + e.r * Math.cos(e.endAngle * DEG), e.cy + e.r * Math.sin(e.endAngle * DEG), 'end');
  } else if (e.type === 'ellipse') {
    push(e.cx, e.cy, 'center');
    push(e.cx + e.rx, e.cy, 'quad'); push(e.cx - e.rx, e.cy, 'quad');
    push(e.cx, e.cy + e.ry, 'quad'); push(e.cx, e.cy - e.ry, 'quad');
  } else if (e.type === 'text') {
    push(e.x, e.y, 'end');
  }
  return pts;
}

// 実寸mmでのバウンディングボックス。kは縮尺係数(文字高さは用紙mmのため)
export function entityBounds(e, k = 1) {
  if (e.type === 'dim' || e.type === 'leader') {
    const pts = dimLayout(e, k).lines.flat();
    const b = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
    for (const p of pts) {
      b.minX = Math.min(b.minX, p.x); b.minY = Math.min(b.minY, p.y);
      b.maxX = Math.max(b.maxX, p.x); b.maxY = Math.max(b.maxY, p.y);
    }
    return b;
  }
  if (e.type === 'circle' || e.type === 'arc') {
    return { minX: e.cx - e.r, minY: e.cy - e.r, maxX: e.cx + e.r, maxY: e.cy + e.r };
  }
  if (e.type === 'ellipse') {
    return { minX: e.cx - e.rx, minY: e.cy - e.ry, maxX: e.cx + e.rx, maxY: e.cy + e.ry };
  }
  if (e.type === 'text') {
    const h = e.height / k;
    const w = e.content.length * h;
    return { minX: e.x, minY: e.y, maxX: e.x + w, maxY: e.y + h };
  }
  const pts = entitySegments(e).flat();
  const b = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
  for (const p of pts) {
    b.minX = Math.min(b.minX, p.x); b.minY = Math.min(b.minY, p.y);
    b.maxX = Math.max(b.maxX, p.x); b.maxY = Math.max(b.maxY, p.y);
  }
  return b;
}

// 点pが要素の線上(tolMm以内)にあるか
export function hitTestEntity(e, p, tolMm, k = 1) {
  if (e.type === 'dim' || e.type === 'leader') {
    const layout = dimLayout(e, k);
    for (const [a, b] of layout.lines) {
      if (distancePointToSegment(p, a, b) <= tolMm) return true;
    }
    const textH = DIM_TEXT_MM / k;
    for (const t of layout.texts) {
      const w = t.content.length * textH;
      const x0 = t.align === 'center' ? t.x - w / 2 : t.align === 'right' ? t.x - w : t.x;
      if (p.x >= x0 - tolMm && p.x <= x0 + w + tolMm &&
          p.y >= t.y - tolMm && p.y <= t.y + textH + tolMm) return true;
    }
    return false;
  }
  if (e.type === 'circle') {
    return Math.abs(distance(p, { x: e.cx, y: e.cy }) - e.r) <= tolMm;
  }
  if (e.type === 'arc') {
    const c = { x: e.cx, y: e.cy };
    if (Math.abs(distance(p, c) - e.r) > tolMm) return false;
    let sweep = e.endAngle - e.startAngle;
    while (sweep < 0) sweep += 360;
    let rel = angleDegOf(c, p) - e.startAngle;
    while (rel < 0) rel += 360;
    return rel <= sweep + 1e-9;
  }
  if (e.type === 'ellipse') {
    if (e.rx <= 0 || e.ry <= 0) return false;
    const t = Math.hypot((p.x - e.cx) / e.rx, (p.y - e.cy) / e.ry);
    return Math.abs(t - 1) * Math.min(e.rx, e.ry) <= tolMm;
  }
  if (e.type === 'text') {
    const b = entityBounds(e, k);
    return p.x >= b.minX - tolMm && p.x <= b.maxX + tolMm &&
           p.y >= b.minY - tolMm && p.y <= b.maxY + tolMm;
  }
  for (const [a, b] of entitySegments(e)) {
    if (distancePointToSegment(p, a, b) <= tolMm) return true;
  }
  return false;
}

export function parseScale(text) {
  const m = String(text).trim().match(/^(\d+(?:\.\d+)?)\s*[:：]\s*(\d+(?:\.\d+)?)$/);
  if (!m) return null;
  const num = Number(m[1]);
  const den = Number(m[2]);
  if (num <= 0 || den <= 0) return null;
  return [num, den];
}

export function formatScale(ratio) {
  return `${ratio[0]}:${ratio[1]}`;
}
