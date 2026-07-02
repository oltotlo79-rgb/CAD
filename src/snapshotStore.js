// クラッシュ復元用の自動スナップショット(IndexedDB)。
// ファイルへの保存とは別の、ブラウザ内の安全網。正式な保存は手動のまま。
const DB_NAME = 'seizu-tool';
const STORE = 'backup';
const KEY = 'latest';

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function withStore(mode, fn) {
  const db = await openDb();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const req = fn(tx.objectStore(STORE));
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  } finally {
    db.close();
  }
}

export function saveBackup(text, name) {
  return withStore('readwrite', (s) => s.put({ text, name, savedAt: Date.now() }, KEY));
}

export function loadBackup() {
  return withStore('readonly', (s) => s.get(KEY));
}

export function clearBackup() {
  return withStore('readwrite', (s) => s.delete(KEY));
}
