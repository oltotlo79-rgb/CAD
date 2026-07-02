import { FRAME_MARGIN_MM } from './papers.js';

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
