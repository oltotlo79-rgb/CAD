export function createHistory(limit = 100) {
  return { limit, undoStack: [], redoStack: [] };
}

// 元に戻す対象: 図形に加えて、用紙・縮尺・方眼・レイヤー・表題欄・線種の間隔・45°線・原点の設定
const UNDO_KEYS = [
  'entities', 'nextId', 'userOrigin', 'paper', 'scale', 'grid', 'layers',
  'titleBlock', 'dashPatterns', 'mirror45',
];

export function snapshot(doc) {
  return JSON.stringify(Object.fromEntries(UNDO_KEYS.map((k) => [k, doc[k]])));
}

export function pushSnapshot(history, snap) {
  history.undoStack.push(snap);
  if (history.undoStack.length > history.limit) history.undoStack.shift();
  history.redoStack.length = 0;
}

export function undo(history, currentSnap) {
  if (history.undoStack.length === 0) return null;
  history.redoStack.push(currentSnap);
  return history.undoStack.pop();
}

export function redo(history, currentSnap) {
  if (history.redoStack.length === 0) return null;
  history.undoStack.push(currentSnap);
  return history.redoStack.pop();
}

export function applySnapshot(doc, snap) {
  const data = JSON.parse(snap);
  for (const k of UNDO_KEYS) {
    if (k in data) doc[k] = data[k];
  }
}
