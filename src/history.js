// 元に戻す・やり直しの履歴。変更する前の図面(図形と設定)を文字にして積んでおく
// 履歴を作る(limit 回分まで覚える)
export function createHistory(limit = 100) {
  return { limit, undoStack: [], redoStack: [] };
}

// 元に戻す対象: 図形に加えて、用紙・縮尺・方眼・レイヤー・表題欄・線種の間隔・45°線・原点の設定
const UNDO_KEYS = [
  'entities', 'nextId', 'userOrigin', 'paper', 'scale', 'grid', 'layers',
  'titleBlock', 'dashPatterns', 'mirror45',
];

// 今の図面のうち、元に戻す対象の部分を文字にする
export function snapshot(doc) {
  return JSON.stringify(Object.fromEntries(UNDO_KEYS.map((k) => [k, doc[k]])));
}

// 変更する前の状態を積む(新しく変更したら、やり直しの履歴は消える)
export function pushSnapshot(history, snap) {
  history.undoStack.push(snap);
  if (history.undoStack.length > history.limit) history.undoStack.shift();
  history.redoStack.length = 0;
}

// 1つ前の状態を取り出す(今の状態はやり直し用に積む)
export function undo(history, currentSnap) {
  if (history.undoStack.length === 0) return null;
  history.redoStack.push(currentSnap);
  return history.undoStack.pop();
}

// 元に戻した状態を、もう一度取り出す
export function redo(history, currentSnap) {
  if (history.redoStack.length === 0) return null;
  history.undoStack.push(currentSnap);
  return history.redoStack.pop();
}

// 取り出した状態を図面に戻す
export function applySnapshot(doc, snap) {
  const data = JSON.parse(snap);
  for (const k of UNDO_KEYS) {
    if (k in data) doc[k] = data[k];
  }
}
