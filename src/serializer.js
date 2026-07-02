import { createDocument } from './model.js';

export function serialize(doc) {
  return JSON.stringify(doc, null, 2);
}

export function deserialize(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('JSONとして読み込めないファイルです');
  }
  if (data.format !== 'seizu-tool') throw new Error('製図ツールの図面ファイルではありません');
  if (data.version !== 1) throw new Error(`未対応のファイルバージョンです: ${data.version}`);

  const base = createDocument();
  const entities = Array.isArray(data.entities) ? data.entities : [];
  const maxId = entities.reduce((m, e) => Math.max(m, e.id ?? 0), 0);
  return {
    ...base,
    ...data,
    paper: { ...base.paper, ...data.paper },
    scale: { ...base.scale, ...data.scale },
    userOrigin: { ...base.userOrigin, ...data.userOrigin },
    grid: { ...base.grid, ...data.grid },
    layers: Array.isArray(data.layers) ? data.layers : base.layers,
    mirror45: data.mirror45 ?? null,
    entities,
    nextId: data.nextId ?? maxId + 1,
  };
}
