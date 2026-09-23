import { FRAME_MARGIN_MM } from './papers.js';
import {
  distance, angleDegOf, distancePointToSegment, catmullRomPoints,
  lineEndPoint, round6,
} from './geometry.js';
import {
  balloonLayout, annotationLayout, dimAxis, textBoxHit,
} from './dims.js';
import { DEFAULT_TITLE_FIELDS } from './titleBlock.js';
import { boundaryBBox, pointInBoundary, translateBoundary } from './hatch.js';
import { bomLayout } from './bom.js';

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
  thinline: { label: '細実線',  lineType: 'thin',   layer: 'outline' }, // 印刷される細実線(ねじ谷など)
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

function todayString() {
  const d = new Date();
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
}

export function createDocument({ paperSize = 'A4', orientation = 'landscape' } = {}) {
  const titleFields = DEFAULT_TITLE_FIELDS.map((f) =>
    (f.label === '日付' ? { ...f, value: todayString() } : { ...f }));
  return {
    format: 'seizu-tool',
    version: 1,
    paper: { size: paperSize, orientation },
    scale: { ratio: [1, 1] },
    userOrigin: { x: FRAME_MARGIN_MM, y: FRAME_MARGIN_MM },
    grid: { mode: 'auto', manualMm: 1 },
    mirror45: null, // 45°ミラー線の通過点 {x,y}(実寸mm)。nullなら未設定
    titleBlock: { fields: titleFields },
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
    } else if (e.type === 'polyline' || e.type === 'spline') {
      e.points = e.points.map(([x, y]) => [x + dx, y + dy]);
    } else if (e.type === 'roughness' || e.type === 'fcf') {
      e.x += dx; e.y += dy;
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
    } else if (e.type === 'hatch') {
      translateBoundary(e.boundary, dx, dy);
    } else if (e.type === 'balloon') {
      e.at = [e.at[0] + dx, e.at[1] + dy];
      e.pos = [e.pos[0] + dx, e.pos[1] + dy];
    } else if (e.type === 'bom') {
      e.x += dx; e.y += dy;
    }
  }
}

const r6 = (v) => round6(v) || 0; // -0 を +0 に正規化
const norm360 = (a) => ((a % 360) + 360) % 360;

// 選択要素を center まわりに +90°(反時計回り)回転する
export function rotate90Entities(doc, ids, center) {
  rotateEntities(doc, ids, center, 90);
}

// 長さ寸法の値のずれ(textShift)を、変形前の向きのベクトルとして取り出し、
// 変形後の寸法線の向きに投影し直す。vecMap は向きベクトルの変換
function keepDimShift(e, transform, vecMap) {
  const shift = Number(e.textShift) || 0;
  const u0 = dimAxis(e);
  transform();
  if (!shift) return;
  const [vx, vy] = vecMap(u0.x * shift, u0.y * shift);
  const u1 = dimAxis(e);
  e.textShift = r6(vx * u1.x + vy * u1.y);
}

// 選択要素を center まわりに deg 度(反時計回り正)回転する。
// 注記の記号(粗さ・公差枠・部品表)は向きを保ったまま位置だけ回す
export function rotateEntities(doc, ids, center, deg) {
  const target = new Set(ids);
  const rad = deg * DEG;
  const quarter = Number.isInteger(deg / 90);
  const c = quarter ? Math.round(Math.cos(rad)) : Math.cos(rad);
  const s = quarter ? Math.round(Math.sin(rad)) : Math.sin(rad);
  const vec = (x, y) => [x * c - y * s, x * s + y * c];
  const pt = (x, y) => {
    const [vx, vy] = vec(x - center.x, y - center.y);
    return [r6(center.x + vx), r6(center.y + vy)];
  };
  const P = ([x, y]) => pt(x, y);
  for (const e of doc.entities) {
    if (!target.has(e.id)) continue;
    if (e.type === 'line') {
      [e.x1, e.y1] = pt(e.x1, e.y1);
      [e.x2, e.y2] = pt(e.x2, e.y2);
    } else if (e.type === 'rect') {
      // 剛体回転: 左下角(回転の基準)を回して rotation を加算
      [e.x, e.y] = pt(e.x, e.y);
      e.rotation = norm360((e.rotation ?? 0) + deg);
    } else if (e.type === 'polyline' || e.type === 'spline' || e.type === 'leader') {
      e.points = e.points.map(P);
    } else if (e.type === 'roughness' || e.type === 'fcf' || e.type === 'bom') {
      [e.x, e.y] = pt(e.x, e.y);
    } else if (e.type === 'circle') {
      [e.cx, e.cy] = pt(e.cx, e.cy);
    } else if (e.type === 'arc') {
      [e.cx, e.cy] = pt(e.cx, e.cy);
      e.startAngle += deg; e.endAngle += deg;
    } else if (e.type === 'ellipse' || e.type === 'text') {
      if (e.type === 'ellipse') [e.cx, e.cy] = pt(e.cx, e.cy);
      else [e.x, e.y] = pt(e.x, e.y);
      e.rotation = norm360((e.rotation ?? 0) + deg);
    } else if (e.type === 'balloon') {
      e.at = P(e.at);
      e.pos = P(e.pos);
    } else if (e.type === 'hatch') {
      e.boundary = rotateBoundary(e.boundary, pt, deg, quarter);
      e.angleDeg = ((e.angleDeg + deg) % 180 + 180) % 180;
    } else if (e.type === 'dim') {
      rotateDim(e, pt, vec, deg, quarter);
    }
  }
}

function rotateBoundary(b, pt, deg, quarter) {
  const odd = quarter && Math.abs(deg / 90) % 2 === 1;
  if (b.kind === 'circle') {
    const [cx, cy] = pt(b.cx, b.cy);
    return { ...b, cx, cy };
  }
  if (quarter && (b.kind === 'rect' || b.kind === 'ellipse')) {
    if (b.kind === 'ellipse') {
      const [cx, cy] = pt(b.cx, b.cy);
      return odd ? { ...b, cx, cy, rx: b.ry, ry: b.rx } : { ...b, cx, cy };
    }
    const [mx, my] = pt(b.x + b.width / 2, b.y + b.height / 2);
    const w = odd ? b.height : b.width;
    const h = odd ? b.width : b.height;
    return { kind: 'rect', x: r6(mx - w / 2), y: r6(my - h / 2), width: w, height: h };
  }
  // 斜めになる矩形・楕円は多角形(楕円は72角形で近似)にする
  let points;
  if (b.kind === 'rect') {
    points = [[b.x, b.y], [b.x + b.width, b.y], [b.x + b.width, b.y + b.height], [b.x, b.y + b.height]];
  } else if (b.kind === 'ellipse') {
    points = Array.from({ length: 72 }, (_, i) => [
      b.cx + b.rx * Math.cos(i * 5 * DEG), b.cy + b.ry * Math.sin(i * 5 * DEG),
    ]);
  } else {
    points = b.points;
  }
  return { kind: 'polyline', points: points.map(([x, y]) => pt(x, y)) };
}

function rotateDim(e, pt, vec, deg, quarter) {
  const P = ([x, y]) => pt(x, y);
  if (e.dimType === 'dia' || e.dimType === 'rad') {
    [e.cx, e.cy] = pt(e.cx, e.cy);
    e.angleDeg += deg;
  } else if (e.dimType === 'angle') {
    e.vertex = P(e.vertex); e.p1 = P(e.p1); e.p2 = P(e.p2);
  } else if (e.dimType === 'chamfer') {
    e.p1 = P(e.p1); e.p2 = P(e.p2); e.tail = P(e.tail);
  } else if (e.dimType === 'linear') {
    keepDimShift(e, () => rotateLinearDim(e, pt, vec, deg, quarter), vec);
  }
}

function rotateLinearDim(e, pt, vec, deg, quarter) {
  const [x1, y1] = e.p1;
  const [x2, y2] = e.p2;
  if (e.orient === 'aligned') {
    e.p1 = pt(x1, y1); e.p2 = pt(x2, y2); // offset は寸法線の法線方向なので不変
    return;
  }
  const h = e.orient === 'h';
  const lineX = h ? x1 : e.offset; // 寸法線上の1点
  const lineY = h ? e.offset : y1;
  const [dx, dy] = pt(lineX, lineY);
  if (quarter) {
    const odd = Math.abs(deg / 90) % 2 === 1;
    e.p1 = pt(x1, y1); e.p2 = pt(x2, y2);
    const nowH = odd ? !h : h;
    e.orient = nowH ? 'h' : 'v';
    e.offset = nowH ? dy : dx;
    return;
  }
  // 斜めになる水平/垂直寸法は平行寸法にする。2点目は測る向きへの足
  // (水平なら (x2,y1)) に置き換えて、測っている長さを保つ
  const foot = h ? [x2, y1] : [x1, y2];
  const p1 = pt(x1, y1);
  const p2 = pt(foot[0], foot[1]);
  const len = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]);
  if (len === 0) return;
  const nx = -(p2[1] - p1[1]) / len;
  const ny = (p2[0] - p1[0]) / len;
  e.p1 = p1; e.p2 = p2;
  e.orient = 'aligned';
  e.offset = r6((dx - p1[0]) * nx + (dy - p1[1]) * ny);
}

// 選択要素を center を基準に f 倍する。文字・記号の大きさ(用紙mm)は変えない
export function scaleEntities(doc, ids, center, f) {
  const target = new Set(ids);
  const pt = (x, y) => [r6(center.x + (x - center.x) * f), r6(center.y + (y - center.y) * f)];
  const P = ([x, y]) => pt(x, y);
  const len = (v) => r6(v * f);
  for (const e of doc.entities) {
    if (!target.has(e.id)) continue;
    if (e.type === 'line') {
      [e.x1, e.y1] = pt(e.x1, e.y1);
      [e.x2, e.y2] = pt(e.x2, e.y2);
    } else if (e.type === 'rect') {
      [e.x, e.y] = pt(e.x, e.y);
      e.width = len(e.width); e.height = len(e.height);
    } else if (e.type === 'polyline' || e.type === 'spline' || e.type === 'leader') {
      e.points = e.points.map(P);
    } else if (e.type === 'roughness' || e.type === 'fcf' || e.type === 'bom' || e.type === 'text') {
      [e.x, e.y] = pt(e.x, e.y);
    } else if (e.type === 'circle' || e.type === 'arc') {
      [e.cx, e.cy] = pt(e.cx, e.cy);
      e.r = len(e.r);
    } else if (e.type === 'ellipse') {
      [e.cx, e.cy] = pt(e.cx, e.cy);
      e.rx = len(e.rx); e.ry = len(e.ry);
    } else if (e.type === 'balloon') {
      e.at = P(e.at);
      e.pos = P(e.pos);
    } else if (e.type === 'hatch') {
      const b = e.boundary;
      if (b.kind === 'rect') {
        [b.x, b.y] = pt(b.x, b.y);
        b.width = len(b.width); b.height = len(b.height);
      } else if (b.kind === 'circle') {
        [b.cx, b.cy] = pt(b.cx, b.cy);
        b.r = len(b.r);
      } else if (b.kind === 'ellipse') {
        [b.cx, b.cy] = pt(b.cx, b.cy);
        b.rx = len(b.rx); b.ry = len(b.ry);
      } else if (b.kind === 'polyline') {
        b.points = b.points.map(P);
      }
    } else if (e.type === 'dim') {
      if (e.dimType === 'linear') {
        e.p1 = P(e.p1); e.p2 = P(e.p2);
        if (e.orient === 'h') e.offset = r6(center.y + (e.offset - center.y) * f);
        else if (e.orient === 'v') e.offset = r6(center.x + (e.offset - center.x) * f);
        else e.offset = len(e.offset);
        if (e.textShift) e.textShift = len(e.textShift);
      } else if (e.dimType === 'dia' || e.dimType === 'rad') {
        [e.cx, e.cy] = pt(e.cx, e.cy);
        e.r = len(e.r);
      } else if (e.dimType === 'angle') {
        e.vertex = P(e.vertex); e.p1 = P(e.p1); e.p2 = P(e.p2);
        e.radius = len(e.radius);
      } else if (e.dimType === 'chamfer') {
        e.p1 = P(e.p1); e.p2 = P(e.p2); e.tail = P(e.tail);
        e.size = len(e.size);
      }
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
    // rotation は左下角(x,y)を中心とした回転
    const rot = ((e.rotation ?? 0) * Math.PI) / 180;
    const c = Math.cos(rot);
    const s = Math.sin(rot);
    const pt = (dx, dy) => ({ x: e.x + dx * c - dy * s, y: e.y + dx * s + dy * c });
    const p = [pt(0, 0), pt(e.width, 0), pt(e.width, e.height), pt(0, e.height)];
    return [[p[0], p[1]], [p[1], p[2]], [p[2], p[3]], [p[3], p[0]]];
  }
  if (e.type === 'polyline') {
    const pts = e.points.map(([x, y]) => ({ x, y }));
    const segs = [];
    for (let i = 0; i < pts.length - 1; i++) segs.push([pts[i], pts[i + 1]]);
    if (e.closed && pts.length > 2) segs.push([pts[pts.length - 1], pts[0]]);
    return segs;
  }
  if (e.type === 'spline') {
    const pts = catmullRomPoints(e.points, e.closed);
    const segs = [];
    for (let i = 0; i < pts.length - 1; i++) segs.push([pts[i], pts[i + 1]]);
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
      // 中心を鏡映し、回転角を反転(矩形は180°対称なので180-θ/-θで正しく写る)
      const rot0 = e.rotation ?? 0;
      const rad0 = rot0 * DEG;
      const cx0 = e.x + (e.width / 2) * Math.cos(rad0) - (e.height / 2) * Math.sin(rad0);
      const cy0 = e.y + (e.width / 2) * Math.sin(rad0) + (e.height / 2) * Math.cos(rad0);
      const [ncx, ncy] = mp(cx0, cy0);
      const rot = (((axis === 'x' ? 180 - rot0 : -rot0) % 360) + 360) % 360;
      const rad = rot * DEG;
      e.x = ncx - (e.width / 2) * Math.cos(rad) + (e.height / 2) * Math.sin(rad);
      e.y = ncy - (e.width / 2) * Math.sin(rad) - (e.height / 2) * Math.cos(rad);
      e.rotation = rot;
    } else if (e.type === 'polyline' || e.type === 'spline') {
      e.points = e.points.map(([x, y]) => mp(x, y));
    } else if (e.type === 'roughness' || e.type === 'fcf') {
      [e.x, e.y] = mp(e.x, e.y);
    } else if (e.type === 'circle') {
      [e.cx, e.cy] = mp(e.cx, e.cy);
    } else if (e.type === 'arc') {
      [e.cx, e.cy] = mp(e.cx, e.cy);
      [e.startAngle, e.endAngle] = mAngles(e.startAngle, e.endAngle);
    } else if (e.type === 'ellipse') {
      [e.cx, e.cy] = mp(e.cx, e.cy);
      const rot0 = e.rotation ?? 0;
      e.rotation = (((axis === 'x' ? 180 - rot0 : -rot0) % 360) + 360) % 360;
      if (isEllipseArc(e)) {
        // 鏡映でパラメータは u→-u(向き維持のため入替)
        [e.startAngle, e.endAngle] = [-e.endAngle || 0, -e.startAngle || 0];
      }
    } else if (e.type === 'text') {
      [e.x, e.y] = mp(e.x, e.y);
    } else if (e.type === 'dim') {
      if (e.dimType === 'linear') {
        keepDimShift(e, () => {
          e.p1 = mp(e.p1[0], e.p1[1]);
          e.p2 = mp(e.p2[0], e.p2[1]);
          if (e.orient === 'h' && axis === 'y') e.offset = my(e.offset);
          else if (e.orient === 'v' && axis === 'x') e.offset = mx(e.offset);
          else if (e.orient === 'aligned') e.offset = -e.offset;
        }, (vx, vy) => (axis === 'x' ? [-vx, vy] : [vx, -vy]));
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
    } else if (e.type === 'balloon') {
      e.at = mp(e.at[0], e.at[1]);
      e.pos = mp(e.pos[0], e.pos[1]);
    } else if (e.type === 'hatch') {
      const b = e.boundary;
      if (b.kind === 'rect') {
        const [nx, ny] = mp(b.x, b.y);
        b.x = axis === 'x' ? nx - b.width : nx;
        b.y = axis === 'y' ? ny - b.height : ny;
      } else if (b.kind === 'circle' || b.kind === 'ellipse') {
        [b.cx, b.cy] = mp(b.cx, b.cy);
      } else if (b.kind === 'polyline') {
        b.points = b.points.map(([x, y]) => mp(x, y));
      }
      e.angleDeg = (180 - e.angleDeg) % 180;
    } else if (e.type === 'bom') {
      [e.x, e.y] = mp(e.x, e.y);
    }
  }
}

const DEG = Math.PI / 180;

// ---- 楕円(回転・楕円弧対応)のヘルパー ----
export function isEllipseArc(e) {
  return e.startAngle != null && e.endAngle != null;
}
// 点pを楕円のローカル座標(回転前)へ
function ellipseLocal(e, p) {
  const rot = (e.rotation ?? 0) * DEG;
  const dx = p.x - e.cx;
  const dy = p.y - e.cy;
  const c = Math.cos(rot);
  const s = Math.sin(rot);
  return { x: dx * c + dy * s, y: -dx * s + dy * c };
}
// パラメータ角(度)の楕円上の点(回転込み)
export function ellipsePoint(e, paramDeg) {
  const rot = (e.rotation ?? 0) * DEG;
  const u = paramDeg * DEG;
  const lx = e.rx * Math.cos(u);
  const ly = e.ry * Math.sin(u);
  const c = Math.cos(rot);
  const s = Math.sin(rot);
  return { x: e.cx + lx * c - ly * s, y: e.cy + lx * s + ly * c };
}

// ---- 連続線/スプラインのセグメント編集 ----
export function polySegmentCount(e) {
  return e.closed ? e.points.length : e.points.length - 1;
}
export function polySegmentInfo(e, i) {
  const n = e.points.length;
  const start = { x: e.points[i][0], y: e.points[i][1] };
  const end = { x: e.points[(i + 1) % n][0], y: e.points[(i + 1) % n][1] };
  return { start, len: distance(start, end), ang: angleDegOf(start, end) };
}
// セグメントiを 始点+長さ+角度 で更新(始点基準: 終点側の頂点が動く)
export function setPolySegment(e, i, start, len, ang) {
  const n = e.points.length;
  const end = lineEndPoint(start, len, ang);
  e.points[i] = [start.x, start.y];
  e.points[(i + 1) % n] = [end.x, end.y];
}
export function nearestPolySegment(e, p) {
  let best = 0;
  let bestD = Infinity;
  const n = e.points.length;
  for (let i = 0; i < polySegmentCount(e); i++) {
    const a = { x: e.points[i][0], y: e.points[i][1] };
    const b = { x: e.points[(i + 1) % n][0], y: e.points[(i + 1) % n][1] };
    const d = distancePointToSegment(p, a, b);
    if (d < bestD) { bestD = d; best = i; }
  }
  return best;
}

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
  } else if (e.type === 'spline') {
    for (const [x, y] of e.points) push(x, y, 'end');
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
    if (isEllipseArc(e)) {
      const a = ellipsePoint(e, e.startAngle);
      const b = ellipsePoint(e, e.endAngle);
      push(a.x, a.y, 'end');
      push(b.x, b.y, 'end');
    } else {
      for (const u of [0, 90, 180, 270]) {
        const q = ellipsePoint(e, u);
        push(q.x, q.y, 'quad');
      }
    }
  } else if (e.type === 'text') {
    push(e.x, e.y, 'end');
  }
  return pts;
}

// 実寸mmでのバウンディングボックス。kは縮尺係数(文字高さは用紙mmのため)
export function entityBounds(e, k = 1) {
  if (e.type === 'hatch') return boundaryBBox(e.boundary);
  if (e.type === 'balloon') {
    const { r } = balloonLayout(e, k).circle;
    return {
      minX: Math.min(e.pos[0] - r, e.at[0]), minY: Math.min(e.pos[1] - r, e.at[1]),
      maxX: Math.max(e.pos[0] + r, e.at[0]), maxY: Math.max(e.pos[1] + r, e.at[1]),
    };
  }
  if (e.type === 'bom') {
    const rect = bomLayout(e, k).rect;
    return { minX: rect.x, minY: rect.y, maxX: rect.x + rect.width, maxY: rect.y + rect.height };
  }
  if (e.type === 'dim' || e.type === 'leader' || e.type === 'roughness' || e.type === 'fcf') {
    const pts = annotationLayout(e, k).lines.flat();
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
    // 回転楕円の正確な軸平行バウンディング
    const rot = (e.rotation ?? 0) * DEG;
    const c = Math.cos(rot);
    const s = Math.sin(rot);
    const dx = Math.hypot(e.rx * c, e.ry * s);
    const dy = Math.hypot(e.rx * s, e.ry * c);
    return { minX: e.cx - dx, minY: e.cy - dy, maxX: e.cx + dx, maxY: e.cy + dy };
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
  if (e.type === 'hatch') {
    return pointInBoundary(e.boundary, p);
  }
  if (e.type === 'balloon') {
    const layout = balloonLayout(e, k);
    if (distance(p, layout.circle.c) <= layout.circle.r + tolMm) return true;
    for (const [a, b] of layout.lines) {
      if (distancePointToSegment(p, a, b) <= tolMm) return true;
    }
    return false;
  }
  if (e.type === 'bom') {
    const b = entityBounds(e, k);
    return p.x >= b.minX - tolMm && p.x <= b.maxX + tolMm &&
           p.y >= b.minY - tolMm && p.y <= b.maxY + tolMm;
  }
  if (e.type === 'dim' || e.type === 'leader' || e.type === 'roughness' || e.type === 'fcf') {
    const layout = annotationLayout(e, k);
    for (const [a, b] of layout.lines) {
      if (distancePointToSegment(p, a, b) <= tolMm) return true;
    }
    const textH = layout.textMm / k;
    for (const t of layout.texts) {
      if (textBoxHit(t, textH, p, tolMm)) return true;
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
    const l = ellipseLocal(e, p);
    const t = Math.hypot(l.x / e.rx, l.y / e.ry);
    if (Math.abs(t - 1) * Math.min(e.rx, e.ry) > tolMm) return false;
    if (!isEllipseArc(e)) return true;
    let sweep = e.endAngle - e.startAngle;
    while (sweep < 0) sweep += 360;
    let rel = Math.atan2(l.y / e.ry, l.x / e.rx) / DEG - e.startAngle;
    while (rel < 0) rel += 360;
    return rel <= sweep + 1e-9;
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
