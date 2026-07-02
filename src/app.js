import { paperDimensions } from './papers.js';
import * as vt from './viewTransform.js';
import { effectiveGridStep } from './gridCalc.js';
import * as geo from './geometry.js';
import {
  createDocument, addEntity, removeEntities, translateEntities,
  duplicateEntities, parseScale, formatScale,
  rotate90Entities, entityBounds, hitTestEntity, STYLE_PRESETS,
} from './model.js';
import { findSnap } from './snap.js';
import { saveBackup, loadBackup, clearBackup } from './snapshotStore.js';
import { serialize, deserialize } from './serializer.js';
import {
  createHistory, snapshot, pushSnapshot, undo, redo, applySnapshot,
} from './history.js';
import { draw } from './renderer.js';
import { createFileIO } from './fileio.js';

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const el = (id) => document.getElementById(id);

const state = {
  doc: createDocument(),
  view: null,
  history: createHistory(100),
  fileio: createFileIO(),
  fileName: '図面.json',
  dirty: false,
  tool: 'select',
  selection: new Set(),
  draft: null,
  gridSnap: true,
  osnap: true,
  snapHint: null,
  spaceDown: false,
  panDrag: null,   // { startScreen, startPanX, startPanY }
  moveDrag: null,  // { lastReal, snapshotPushed }
  mouseReal: null,
};

// ---- 座標ヘルパー ----
function eventScreen(ev) {
  const r = canvas.getBoundingClientRect();
  return { x: ev.clientX - r.left, y: ev.clientY - r.top };
}
function screenToReal(s) {
  return vt.paperToReal(vt.screenToPaper(s, state.view), state.doc.scale);
}
function pxPerRealMm() {
  return vt.scaleK(state.doc.scale) * state.view.pxPerMm;
}
function currentGridStep() {
  return effectiveGridStep(state.doc.grid, pxPerRealMm());
}
function snapReal(p) {
  const step = state.gridSnap ? currentGridStep() : null;
  return step ? geo.snapToGrid(p, step) : p;
}
function originToAbs(p) {
  return { x: p.x + state.doc.userOrigin.x, y: p.y + state.doc.userOrigin.y };
}
// オブジェクトスナップ優先、なければグリッドスナップ
function resolvePoint(s) {
  const raw = screenToReal(s);
  if (state.osnap) {
    const tolMm = 10 / pxPerRealMm();
    const hit = findSnap(state.doc, raw, tolMm, vt.scaleK(state.doc.scale));
    if (hit) {
      state.snapHint = hit;
      return { x: hit.x, y: hit.y };
    }
  }
  state.snapHint = null;
  return snapReal(raw);
}
// 作図中の線種プリセット → エンティティ属性
function styleProps() {
  const preset = STYLE_PRESETS[el('line-style').value] ?? STYLE_PRESETS.outline;
  return { lineType: preset.lineType, layer: preset.layer };
}

// ---- 描画・状態表示 ----
function render() {
  draw(ctx, state);
  updateStatus();
}
function updateStatus() {
  const o = state.doc.userOrigin;
  const m = state.mouseReal;
  const pos = m ? `X:${(m.x - o.x).toFixed(2)}  Y:${(m.y - o.y).toFixed(2)}` : 'X:--  Y:--';
  const step = currentGridStep();
  const grid = step ? `グリッド:${step}mm${state.doc.grid.mode === 'manual' ? '(手動)' : ''}` : 'グリッド:--';
  el('statusbar').textContent =
    `${pos}   ${grid}   縮尺 ${formatScale(state.doc.scale.ratio)}   表示 ${state.view.pxPerMm.toFixed(1)}px/mm   要素 ${state.doc.entities.length}`;
}
function updateTitle() {
  document.title = `${state.dirty ? '* ' : ''}${state.fileName} - 製図ツール`;
}
function markDirty() {
  state.dirty = true;
  updateTitle();
  scheduleBackup();
}

// ---- クラッシュ復元用の自動スナップショット ----
let backupTimer = null;
function scheduleBackup() {
  clearTimeout(backupTimer);
  backupTimer = setTimeout(() => {
    if (state.dirty) saveBackup(serialize(state.doc), state.fileName).catch(() => {});
  }, 2000);
}
function discardBackup() {
  clearTimeout(backupTimer);
  clearBackup().catch(() => {});
}
// 変更前スナップショットを積んでから mutator を実行する
function commit(mutator) {
  pushSnapshot(state.history, snapshot(state.doc));
  mutator();
  markDirty();
  render();
}

// ---- キャンバスサイズ・ビュー ----
function refitView() {
  const p = paperDimensions(state.doc.paper.size, state.doc.paper.orientation);
  state.view = vt.fitPaperView(p.width, p.height, canvas.clientWidth, canvas.clientHeight);
}
function resizeCanvas() {
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.clientWidth, h = canvas.clientHeight;
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  if (state.view) {
    state.view = { ...state.view, canvasWidth: w, canvasHeight: h };
  } else {
    refitView();
  }
  render();
}
window.addEventListener('resize', resizeCanvas);

// ---- パン・ズーム ----
canvas.addEventListener('wheel', (ev) => {
  ev.preventDefault();
  const factor = ev.deltaY < 0 ? 1.2 : 1 / 1.2;
  state.view = vt.zoomAt(state.view, eventScreen(ev), factor);
  render();
}, { passive: false });

function startPan(s) {
  state.panDrag = { startScreen: s, startPanX: state.view.panX, startPanY: state.view.panY };
}
function movePan(s) {
  const d = state.panDrag;
  state.view = {
    ...state.view,
    panX: d.startPanX - (s.x - d.startScreen.x) / state.view.pxPerMm,
    panY: d.startPanY + (s.y - d.startScreen.y) / state.view.pxPerMm,
  };
  render();
}

// ---- ツール ----
function setTool(tool) {
  state.tool = tool;
  state.draft = null;
  document.querySelectorAll('#toolbar .tool').forEach((b) =>
    b.classList.toggle('active', b.dataset.tool === tool));
  render();
}
document.querySelectorAll('#toolbar .tool').forEach((b) =>
  b.addEventListener('click', () => setTool(b.dataset.tool)));

function commitLine(a, b) {
  if (a.x === b.x && a.y === b.y) return;
  commit(() => addEntity(state.doc, {
    type: 'line', x1: a.x, y1: a.y, x2: b.x, y2: b.y, ...styleProps(),
  }));
}

function commitRect(a, b) {
  const width = Math.abs(b.x - a.x);
  const height = Math.abs(b.y - a.y);
  if (width === 0 || height === 0) return;
  commit(() => addEntity(state.doc, {
    type: 'rect', x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), width, height, ...styleProps(),
  }));
}

function finishPolyline() {
  const d = state.draft;
  if (d?.kind !== 'polyline') return;
  state.draft = null;
  // 連続する同一点(ダブルクリック等)を除去
  const pts = d.points.filter((p, i) =>
    i === 0 || p.x !== d.points[i - 1].x || p.y !== d.points[i - 1].y);
  if (pts.length >= 2) {
    commit(() => addEntity(state.doc, {
      type: 'polyline', points: pts.map((pt) => [pt.x, pt.y]), closed: false, ...styleProps(),
    }));
  } else {
    render();
  }
}
canvas.addEventListener('dblclick', () => finishPolyline());

// ---- ヒットテスト・範囲選択 ----
function hitTestScreen(s) {
  const real = screenToReal(s);
  const tolMm = 6 / pxPerRealMm();
  const k = vt.scaleK(state.doc.scale);
  for (let i = state.doc.entities.length - 1; i >= 0; i--) {
    if (hitTestEntity(state.doc.entities[i], real, tolMm, k)) return state.doc.entities[i];
  }
  return null;
}

function selectInBox(startScreen, endScreen) {
  const a = screenToReal(startScreen);
  const b = screenToReal(endScreen);
  const minX = Math.min(a.x, b.x), maxX = Math.max(a.x, b.x);
  const minY = Math.min(a.y, b.y), maxY = Math.max(a.y, b.y);
  const k = vt.scaleK(state.doc.scale);
  for (const e of state.doc.entities) {
    const bb = entityBounds(e, k);
    if (bb.minX >= minX && bb.maxX <= maxX && bb.minY >= minY && bb.maxY <= maxY) {
      state.selection.add(e.id);
    }
  }
}

// ---- ツールのポインタ処理 ----
function handleToolPointerDown(s, ev) {
  const p = state.tool === 'select' ? snapReal(screenToReal(s)) : resolvePoint(s);
  if (state.tool === 'select') {
    const hit = hitTestScreen(s);
    if (hit) {
      if (ev.shiftKey) {
        state.selection.has(hit.id) ? state.selection.delete(hit.id) : state.selection.add(hit.id);
      } else if (!state.selection.has(hit.id)) {
        state.selection = new Set([hit.id]);
      }
      state.moveDrag = { lastReal: p, snapshotPushed: false };
    } else {
      if (!ev.shiftKey) state.selection.clear();
      state.draft = { kind: 'box', startScreen: s, currentScreen: s };
    }
    render();
  } else if (state.tool === 'line') {
    if (!state.draft) {
      state.draft = { kind: 'line', start: p, current: p };
      const o = state.doc.userOrigin;
      el('num-x').value = (p.x - o.x).toFixed(2);
      el('num-y').value = (p.y - o.y).toFixed(2);
    } else {
      commitLine(state.draft.start, p);
      state.draft = null;
    }
    render();
  } else if (state.tool === 'rect') {
    if (!state.draft) {
      state.draft = { kind: 'rect', start: p, current: p };
    } else {
      commitRect(state.draft.start, p);
      state.draft = null;
    }
    render();
  } else if (state.tool === 'polyline') {
    if (!state.draft) {
      state.draft = { kind: 'polyline', points: [p], current: p };
    } else {
      state.draft.points.push(p);
    }
    render();
  } else if (state.tool === 'circle') {
    if (!state.draft) {
      state.draft = { kind: 'circle', center: p, current: p };
    } else {
      const d = state.draft;
      state.draft = null;
      const r = geo.round6(geo.distance(d.center, p));
      if (r > 0) {
        commit(() => addEntity(state.doc, {
          type: 'circle', cx: d.center.x, cy: d.center.y, r, ...styleProps(),
        }));
      }
    }
    render();
  } else if (state.tool === 'arc') {
    if (!state.draft) {
      state.draft = { kind: 'arc', stage: 1, center: p, current: p };
    } else if (state.draft.stage === 1) {
      if (p.x !== state.draft.center.x || p.y !== state.draft.center.y) {
        state.draft.stage = 2;
        state.draft.startPoint = p;
      }
    } else {
      const d = state.draft;
      state.draft = null;
      const r = geo.round6(geo.distance(d.center, d.startPoint));
      const start = geo.round6(geo.angleDegOf(d.center, d.startPoint));
      let end = geo.angleDegOf(d.center, p);
      while (end <= start) end += 360;
      end = geo.round6(end);
      if (r > 0) {
        commit(() => addEntity(state.doc, {
          type: 'arc', cx: d.center.x, cy: d.center.y, r,
          startAngle: start, endAngle: end, ...styleProps(),
        }));
      }
    }
    render();
  } else if (state.tool === 'ellipse') {
    if (!state.draft) {
      state.draft = { kind: 'ellipse', center: p, current: p };
    } else {
      const d = state.draft;
      state.draft = null;
      const rx = Math.abs(p.x - d.center.x);
      const ry = Math.abs(p.y - d.center.y);
      if (rx > 0 && ry > 0) {
        commit(() => addEntity(state.doc, {
          type: 'ellipse', cx: d.center.x, cy: d.center.y, rx, ry, ...styleProps(),
        }));
      }
    }
    render();
  } else if (state.tool === 'text') {
    // canvasへのフォーカス移動(mousedown既定動作)が入力欄のフォーカスを奪うのを防ぐ
    ev.preventDefault();
    openTextEntry(s, p);
  } else if (state.tool === 'origin') {
    commit(() => { state.doc.userOrigin = p; });
    setTool('select');
  }
}

function handleToolPointerMove(s) {
  const p = state.mouseReal;
  if (state.moveDrag) {
    const dx = p.x - state.moveDrag.lastReal.x;
    const dy = p.y - state.moveDrag.lastReal.y;
    if (dx !== 0 || dy !== 0) {
      if (!state.moveDrag.snapshotPushed) {
        pushSnapshot(state.history, snapshot(state.doc));
        state.moveDrag.snapshotPushed = true;
        markDirty();
      }
      translateEntities(state.doc, [...state.selection], dx, dy);
      state.moveDrag.lastReal = p;
    }
    return;
  }
  if (state.draft?.kind === 'box') {
    state.draft.currentScreen = s;
    return;
  }
  if (state.draft) {
    state.draft.current = p;
    if (state.draft.kind === 'line') {
      el('num-len').value = geo.distance(state.draft.start, p).toFixed(2);
      el('num-ang').value = geo.angleDegOf(state.draft.start, p).toFixed(1);
    }
  }
}

function handleToolPointerUp() {
  if (state.moveDrag) {
    state.moveDrag = null;
    return;
  }
  if (state.draft?.kind === 'box') {
    selectInBox(state.draft.startScreen, state.draft.currentScreen);
    state.draft = null;
    render();
  }
}

// ---- ポインタイベント ----
canvas.addEventListener('pointerdown', (ev) => {
  const s = eventScreen(ev);
  canvas.setPointerCapture(ev.pointerId);
  if (ev.button === 1 || state.spaceDown) {
    startPan(s);
    return;
  }
  if (ev.button !== 0) return;
  handleToolPointerDown(s, ev);
});
canvas.addEventListener('pointermove', (ev) => {
  if (!state.view) return;
  const s = eventScreen(ev);
  if (state.panDrag) {
    state.mouseReal = screenToReal(s);
    movePan(s);
    return;
  }
  if (state.moveDrag || state.draft?.kind === 'box' || state.tool === 'select') {
    state.snapHint = null;
    state.mouseReal = snapReal(screenToReal(s));
  } else {
    state.mouseReal = resolvePoint(s);
  }
  handleToolPointerMove(s);
  render();
});
canvas.addEventListener('pointerup', (ev) => {
  if (state.panDrag) {
    state.panDrag = null;
    return;
  }
  handleToolPointerUp(eventScreen(ev));
});

// ---- Undo/Redo・削除・複製 ----
function doUndo() {
  const snap = undo(state.history, snapshot(state.doc));
  if (!snap) return;
  applySnapshot(state.doc, snap);
  state.selection.clear();
  markDirty();
  render();
}
function doRedo() {
  const snap = redo(state.history, snapshot(state.doc));
  if (!snap) return;
  applySnapshot(state.doc, snap);
  state.selection.clear();
  markDirty();
  render();
}
el('undo').addEventListener('click', doUndo);
el('redo').addEventListener('click', doRedo);

function deleteSelection() {
  if (state.selection.size === 0) return;
  commit(() => removeEntities(state.doc, [...state.selection]));
  state.selection.clear();
  render();
}
function duplicateSelection() {
  if (state.selection.size === 0) return;
  let clones;
  commit(() => { clones = duplicateEntities(state.doc, [...state.selection], 10, 10); });
  state.selection = new Set(clones.map((e) => e.id));
  render();
}
function rotateSelection() {
  if (state.selection.size === 0) return;
  const k = vt.scaleK(state.doc.scale);
  const b = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
  for (const e of state.doc.entities) {
    if (!state.selection.has(e.id)) continue;
    const eb = entityBounds(e, k);
    b.minX = Math.min(b.minX, eb.minX); b.minY = Math.min(b.minY, eb.minY);
    b.maxX = Math.max(b.maxX, eb.maxX); b.maxY = Math.max(b.maxY, eb.maxY);
  }
  const center = snapReal({ x: (b.minX + b.maxX) / 2, y: (b.minY + b.maxY) / 2 });
  commit(() => rotate90Entities(state.doc, [...state.selection], center));
}
el('rotate').addEventListener('click', rotateSelection);

// ---- 文字入力オーバーレイ ----
const textEntry = el('text-entry');
let textPos = null; // 実寸mm
function openTextEntry(s, p) {
  textPos = p;
  textEntry.style.left = `${s.x}px`;
  textEntry.style.top = `${s.y}px`;
  textEntry.style.display = 'block';
  textEntry.value = '';
  textEntry.focus();
  setTimeout(() => textEntry.focus(), 0);
}
function closeTextEntry() {
  textEntry.style.display = 'none';
  textPos = null;
}
textEntry.addEventListener('keydown', (ev) => {
  ev.stopPropagation();
  if (ev.key === 'Enter') {
    const content = textEntry.value.trim();
    if (content && textPos) {
      const pos = textPos;
      commit(() => addEntity(state.doc, {
        type: 'text', x: pos.x, y: pos.y, content, height: 3.5,
        layer: 'note', lineType: 'thin',
      }));
    }
    closeTextEntry();
  } else if (ev.key === 'Escape') {
    closeTextEntry();
  }
});

// ---- 数値入力パネル ----
function drawLineFromInputs() {
  const x = Number(el('num-x').value);
  const y = Number(el('num-y').value);
  const len = Number(el('num-len').value);
  const ang = Number(el('num-ang').value);
  if (![x, y, len, ang].every(Number.isFinite) || len <= 0) return;
  const start = originToAbs({ x, y });
  commitLine(start, geo.lineEndPoint(start, len, ang));
}
el('num-draw').addEventListener('click', drawLineFromInputs);

// 直線ドラフト中に長さ/角度欄でEnter → その数値で確定
for (const id of ['num-len', 'num-ang']) {
  el(id).addEventListener('keydown', (ev) => {
    if (ev.key !== 'Enter') return;
    if (state.draft?.kind === 'line') {
      const len = Number(el('num-len').value);
      const ang = Number(el('num-ang').value);
      if (Number.isFinite(len) && len > 0 && Number.isFinite(ang)) {
        commitLine(state.draft.start, geo.lineEndPoint(state.draft.start, len, ang));
        state.draft = null;
        render();
      }
    } else {
      drawLineFromInputs();
    }
  });
}

// ---- 設定UI ----
function syncSettingsUI() {
  el('paper-size').value = state.doc.paper.size;
  el('paper-orientation').value = state.doc.paper.orientation;
  el('scale-input').value = formatScale(state.doc.scale.ratio);
  el('grid-mode').value = state.doc.grid.mode;
  el('grid-step').value = String(state.doc.grid.manualMm);
  el('grid-step').disabled = state.doc.grid.mode !== 'manual';
}

el('paper-size').addEventListener('change', () => {
  state.doc.paper.size = el('paper-size').value;
  markDirty(); refitView(); render();
});
el('paper-orientation').addEventListener('change', () => {
  state.doc.paper.orientation = el('paper-orientation').value;
  markDirty(); refitView(); render();
});
el('scale-input').addEventListener('change', () => {
  const ratio = parseScale(el('scale-input').value);
  if (!ratio) {
    alert('縮尺は「1:5」の形式で入力してください');
    el('scale-input').value = formatScale(state.doc.scale.ratio);
    return;
  }
  state.doc.scale.ratio = ratio;
  markDirty(); render();
});
el('grid-mode').addEventListener('change', () => {
  state.doc.grid.mode = el('grid-mode').value;
  el('grid-step').disabled = state.doc.grid.mode !== 'manual';
  markDirty(); render();
});
el('grid-step').addEventListener('change', () => {
  state.doc.grid.manualMm = Number(el('grid-step').value);
  markDirty(); render();
});
el('grid-snap').addEventListener('change', () => {
  state.gridSnap = el('grid-snap').checked;
});
el('osnap').addEventListener('change', () => {
  state.osnap = el('osnap').checked;
  if (!state.osnap) state.snapHint = null;
});

// ---- ファイル操作 ----
function confirmDiscard() {
  return !state.dirty || confirm('未保存の変更があります。破棄して続行しますか?');
}

function loadDocText(text, name) {
  try {
    const doc = deserialize(text);
    state.doc = doc;
    state.history = createHistory(100);
    state.selection = new Set();
    state.draft = null;
    state.fileName = name;
    state.dirty = false;
    discardBackup();
    syncSettingsUI();
    refitView();
    updateTitle();
    render();
  } catch (err) {
    alert(err.message);
  }
}

async function saveFile(saveAs = false) {
  const text = serialize(state.doc);
  const name = saveAs
    ? await state.fileio.saveAs(text, state.fileName)
    : await state.fileio.save(text, state.fileName);
  if (name) {
    state.fileName = name;
    state.dirty = false;
    discardBackup();
    updateTitle();
  }
}

el('file-new').addEventListener('click', () => {
  if (!confirmDiscard()) return;
  discardBackup();
  state.fileio.reset();
  state.doc = createDocument();
  state.history = createHistory(100);
  state.selection = new Set();
  state.draft = null;
  state.fileName = '図面.json';
  state.dirty = false;
  syncSettingsUI();
  refitView();
  updateTitle();
  render();
});
el('file-open').addEventListener('click', async () => {
  if (!confirmDiscard()) return;
  const res = await state.fileio.open();
  if (res) loadDocText(res.text, res.name);
});
el('file-save').addEventListener('click', () => saveFile(false));
el('file-saveas').addEventListener('click', () => saveFile(true));

// ---- ドラッグ&ドロップで開く ----
window.addEventListener('dragover', (ev) => ev.preventDefault());
window.addEventListener('drop', async (ev) => {
  ev.preventDefault();
  const item = ev.dataTransfer.items?.[0];
  const file = ev.dataTransfer.files?.[0];
  if (!file) return;
  if (!confirmDiscard()) return;
  // 可能なら書込ハンドルも取得(Chromium)。awaitより先に取ること
  let handlePromise = null;
  if (item?.getAsFileSystemHandle) handlePromise = item.getAsFileSystemHandle();
  const text = await file.text();
  state.fileio.reset();
  if (handlePromise) {
    try {
      const h = await handlePromise;
      if (h?.kind === 'file') state.fileio.adoptHandle(h);
    } catch { /* ハンドルが取れなくても読み込みは続行 */ }
  }
  loadDocText(text, file.name);
});

// ---- 離脱警告 ----
window.addEventListener('beforeunload', (ev) => {
  if (state.dirty) ev.preventDefault();
});

// ---- キーボード ----
function isTyping(ev) {
  return ev.target instanceof HTMLInputElement || ev.target instanceof HTMLSelectElement;
}
window.addEventListener('keydown', (ev) => {
  if (ev.code === 'Space' && !isTyping(ev)) {
    state.spaceDown = true;
    ev.preventDefault();
    return;
  }
  if (ev.key === 'Escape') {
    state.draft = null;
    state.selection.clear();
    closeTextEntry();
    render();
    return;
  }
  if (isTyping(ev)) return;
  if (ev.key === 'Enter') finishPolyline();
  if (ev.key === 'Delete' || ev.key === 'Backspace') deleteSelection();
  if (ev.ctrlKey && ev.key.toLowerCase() === 'z' && !ev.shiftKey) { ev.preventDefault(); doUndo(); }
  if ((ev.ctrlKey && ev.key.toLowerCase() === 'y') ||
      (ev.ctrlKey && ev.shiftKey && ev.key.toLowerCase() === 'z')) { ev.preventDefault(); doRedo(); }
  if (ev.ctrlKey && ev.key.toLowerCase() === 'd') { ev.preventDefault(); duplicateSelection(); }
  if (ev.ctrlKey && ev.key.toLowerCase() === 's') { ev.preventDefault(); saveFile(ev.shiftKey); }
  if (ev.ctrlKey && ev.key.toLowerCase() === 'o') { ev.preventDefault(); el('file-open').click(); }
});
window.addEventListener('keyup', (ev) => {
  if (ev.code === 'Space') state.spaceDown = false;
});

// ---- 起動 ----
resizeCanvas();
syncSettingsUI();
updateTitle();

// クラッシュ後の復元確認(非モーダルのバナーで提示)
loadBackup().then((b) => {
  if (!b || !b.text) return;
  const banner = el('restore-banner');
  banner.style.display = 'flex';
  el('restore-yes').onclick = () => {
    banner.style.display = 'none';
    loadDocText(b.text, b.name ?? '復元図面.json');
    markDirty();
  };
  el('restore-no').onclick = () => {
    banner.style.display = 'none';
    discardBackup();
  };
}).catch(() => {});
