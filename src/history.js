export function createHistory(limit = 100) {
  return { limit, undoStack: [], redoStack: [] };
}

export function snapshot(doc) {
  return JSON.stringify({
    entities: doc.entities,
    nextId: doc.nextId,
    userOrigin: doc.userOrigin,
  });
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
  doc.entities = data.entities;
  doc.nextId = data.nextId;
  doc.userOrigin = data.userOrigin;
}
