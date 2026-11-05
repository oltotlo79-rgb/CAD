// クラッシュ復元用の自動スナップショット(IndexedDB)。
// ファイルへの保存とは別の、ブラウザ内の安全網。正式な保存は手動のまま。
const DB_NAME = 'seizu-tool';
const STORE = 'backup';
const KEY = 'latest';

// ブラウザの中のデータベースを開く(初めてなら控えの置き場を作る)
function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// 控えの置き場に読み書きして、結果を返す
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

// 図面の控えを保存する
export function saveBackup(text, name) {
  return withStore('readwrite', (s) => s.put({ text, name, savedAt: Date.now() }, KEY));
}

// 保存してある控えを読む(なければ undefined)
export function loadBackup() {
  return withStore('readonly', (s) => s.get(KEY));
}

// 控えを消す
export function clearBackup() {
  return withStore('readwrite', (s) => s.delete(KEY));
}
