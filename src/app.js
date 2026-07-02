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
import { dimText } from './dims.js';
import { projectionGuides, guideSnapCandidates } from './guides.js';
import { toSVG } from './svgExport.js';
import { titleBlockLayout } from './titleBlock.js';
import { boundaryFromEntity } from './hatch.js';
import { bomLayout, bomRowsFromBalloons } from './bom.js';
import { trimLine, extendLine, offsetEntity } from './editOps.js';
import { mirrorEntities } from './model.js';
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
  projGuides: true,
  show45: true,
  guides: { xs: [], ys: [] },
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
// 選択要素からの投影ガイド(投影ガイドONのとき)
function currentGuides() {
  if (!state.projGuides || state.selection.size === 0) return { xs: [], ys: [] };
  return projectionGuides(state.doc.entities.filter((e) => state.selection.has(e.id)));
}
// オブジェクトスナップ・ガイドスナップ優先、なければグリッドスナップ
function resolvePoint(s) {
  const raw = screenToReal(s);
  const tolMm = 10 / pxPerRealMm();
  const cands = [];
  if (state.osnap) {
    const hit = findSnap(state.doc, raw, tolMm, vt.scaleK(state.doc.scale));
    if (hit) cands.push(hit);
  }
  if (state.projGuides) {
    const m45 = state.show45 ? state.doc.mirror45 : null;
    cands.push(...guideSnapCandidates(state.guides, m45, raw, tolMm));
  }
  if (cands.length > 0) {
    cands.sort((a, b) => geo.distance(raw, a) - geo.distance(raw, b));
    state.snapHint = cands[0];
    return { x: cands[0].x, y: cands[0].y };
  }
  state.snapHint = null;
  return snapReal(raw);
}
// 作図中の線種プリセット → エンティティ属性
function styleProps() {
  const preset = STYLE_PRESETS[el('line-style').value] ?? STYLE_PRESETS.outline;
  return { lineType: preset.lineType, layer: preset.layer };
}
// 寸法の向きと配置: 2点が水平/垂直なら自動、斜めはカーソル位置で判定(Shiftで平行寸法)
function dimPlacement(p1, p2, c, aligned) {
  const eps = 1e-6;
  let orient;
  if (Math.abs(p1.y - p2.y) < eps) orient = 'h';
  else if (Math.abs(p1.x - p2.x) < eps) orient = 'v';
  else if (aligned) orient = 'aligned';
  else {
    const midX = (p1.x + p2.x) / 2;
    const midY = (p1.y + p2.y) / 2;
    orient = Math.abs(c.y - midY) >= Math.abs(c.x - midX) ? 'h' : 'v';
  }
  if (orient === 'h') return { orient, offset: c.y };
  if (orient === 'v') return { orient, offset: c.x };
  const len = Math.hypot(p2.x - p1.x, p2.y - p1.y) || 1;
  const nx = -(p2.y - p1.y) / len;
  const ny = (p2.x - p1.x) / len;
  return { orient, offset: (c.x - p1.x) * nx + (c.y - p1.y) * ny };
}

// ---- 描画・状態表示 ----
function render() {
  state.guides = currentGuides();
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
canvas.addEventListener('dblclick', (ev) => {
  if (state.tool === 'select') {
    const s = eventScreen(ev);
    const hit = hitTestScreen(s);
    if (hit && (hit.type === 'dim' || hit.type === 'leader' || hit.type === 'text' || hit.type === 'balloon')) {
      ev.preventDefault();
      const initial = hit.type === 'dim' ? dimText(hit)
        : hit.type === 'balloon' ? String(hit.number) : hit.content;
      openTextEntry(s, 'edit', { id: hit.id }, initial);
      return;
    }
    if (hit && hit.type === 'bom') {
      const real = screenToReal(s);
      const layout = bomLayout(hit, vt.scaleK(state.doc.scale));
      const cell = layout.cells.find((cl) =>
        real.x >= cl.rect.x && real.x <= cl.rect.x + cl.rect.width &&
        real.y >= cl.rect.y && real.y <= cl.rect.y + cl.rect.height);
      if (cell) {
        ev.preventDefault();
        openTextEntry(s, 'bomcell', { id: hit.id, rowIndex: cell.rowIndex, field: cell.field }, cell.text);
      }
      return;
    }
    // 表題欄のフィールド編集(bind項目は自動反映のため編集不可)
    const tb = titleBlockLayout(state.doc);
    if (tb) {
      const pp = vt.screenToPaper(s, state.view);
      const row = tb.rows.find((r) =>
        pp.x >= r.rect.x && pp.x <= r.rect.x + r.rect.width &&
        pp.y >= r.rect.y && pp.y <= r.rect.y + r.rect.height);
      if (row) {
        if (!row.field.bind) {
          ev.preventDefault();
          const index = state.doc.titleBlock.fields.indexOf(row.field);
          openTextEntry(s, 'titlefield', { index }, row.field.value ?? '');
        }
        return;
      }
    }
  }
  finishPolyline();
});

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
    openTextEntry(s, 'text', { pos: p });
  } else if (state.tool === 'dim') {
    if (!state.draft) {
      state.draft = { kind: 'dim', stage: 1, p1: p, current: p };
    } else if (state.draft.stage === 1) {
      if (p.x !== state.draft.p1.x || p.y !== state.draft.p1.y) {
        state.draft.stage = 2;
        state.draft.p2 = p;
      }
    } else {
      const d = state.draft;
      state.draft = null;
      const { orient, offset } = dimPlacement(d.p1, d.p2, p, ev.shiftKey);
      commit(() => addEntity(state.doc, {
        type: 'dim', dimType: 'linear', orient,
        p1: [d.p1.x, d.p1.y], p2: [d.p2.x, d.p2.y], offset,
        override: null, layer: 'dim', lineType: 'thin',
      }));
    }
    render();
  } else if (state.tool === 'dia' || state.tool === 'rad') {
    const hit = hitTestScreen(s);
    if (hit && (hit.type === 'circle' || hit.type === 'arc')) {
      const real = screenToReal(s);
      const angleDeg = geo.round6(geo.angleDegOf({ x: hit.cx, y: hit.cy }, real));
      const dimType = state.tool === 'dia' ? 'dia' : 'rad';
      commit(() => addEntity(state.doc, {
        type: 'dim', dimType, cx: hit.cx, cy: hit.cy, r: hit.r, angleDeg,
        override: null, layer: 'dim', lineType: 'thin',
      }));
    }
  } else if (state.tool === 'chamfer') {
    if (!state.draft) {
      const hit = hitTestScreen(s);
      if (hit && hit.type === 'line') {
        const size = Math.max(Math.abs(hit.x2 - hit.x1), Math.abs(hit.y2 - hit.y1));
        state.draft = {
          kind: 'chamfer',
          from: { x: (hit.x1 + hit.x2) / 2, y: (hit.y1 + hit.y2) / 2 },
          seg: { p1: [hit.x1, hit.y1], p2: [hit.x2, hit.y2] },
          size: geo.round6(size), current: p,
        };
      }
    } else {
      const d = state.draft;
      state.draft = null;
      commit(() => addEntity(state.doc, {
        type: 'dim', dimType: 'chamfer', p1: d.seg.p1, p2: d.seg.p2,
        tail: [p.x, p.y], size: d.size, override: null, layer: 'dim', lineType: 'thin',
      }));
    }
    render();
  } else if (state.tool === 'leader') {
    if (!state.draft) {
      state.draft = { kind: 'leaderDraft', from: p, current: p };
    } else {
      const d = state.draft;
      state.draft = null;
      ev.preventDefault();
      openTextEntry(s, 'leader', { from: d.from, elbow: p });
    }
    render();
  } else if (state.tool === 'hatch') {
    const hit = hitTestScreen(s);
    if (hit) {
      const boundary = boundaryFromEntity(hit);
      if (boundary) {
        commit(() => addEntity(state.doc, {
          type: 'hatch', boundary, angleDeg: 45, spacingMm: 3,
          layer: 'outline', lineType: 'thin',
        }));
      }
    }
  } else if (state.tool === 'balloon') {
    if (!state.draft) {
      state.draft = { kind: 'leaderDraft', from: p, current: p };
    } else {
      const d = state.draft;
      state.draft = null;
      const next = state.doc.entities
        .filter((en) => en.type === 'balloon')
        .reduce((m, en) => Math.max(m, Number(en.number) || 0), 0) + 1;
      commit(() => addEntity(state.doc, {
        type: 'balloon', number: next, at: [d.from.x, d.from.y], pos: [p.x, p.y],
        layer: 'note', lineType: 'thin',
      }));
    }
    render();
  } else if (state.tool === 'bom') {
    commit(() => addEntity(state.doc, {
      type: 'bom', x: p.x, y: p.y, rows: bomRowsFromBalloons(state.doc.entities),
      layer: 'note', lineType: 'thin',
    }));
    setTool('select');
  } else if (state.tool === 'trim') {
    const hit = hitTestScreen(s);
    if (hit && hit.type === 'line') {
      const others = state.doc.entities.filter((en) => en.id !== hit.id);
      const pieces = trimLine(hit, screenToReal(s), others);
      if (pieces) {
        commit(() => {
          removeEntities(state.doc, [hit.id]);
          for (const piece of pieces) addEntity(state.doc, piece);
        });
      }
    }
  } else if (state.tool === 'extend') {
    const hit = hitTestScreen(s);
    if (hit && hit.type === 'line') {
      const others = state.doc.entities.filter((en) => en.id !== hit.id);
      const next = extendLine(hit, screenToReal(s), others);
      if (next) {
        commit(() => Object.assign(hit, next));
      }
    }
  } else if (state.tool === 'offset') {
    const hit = hitTestScreen(s);
    if (hit) {
      const dist = Number(el('offset-dist').value);
      if (Number.isFinite(dist) && dist > 0) {
        const props = offsetEntity(hit, dist, screenToReal(s));
        if (props) commit(() => addEntity(state.doc, props));
      }
    }
  } else if (state.tool === 'mirror45') {
    state.doc.mirror45 = p;
    markDirty();
    setTool('select');
    render();
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
    } else if (state.draft.kind === 'dim' && state.draft.stage === 2) {
      const pl = dimPlacement(state.draft.p1, state.draft.p2, p, false);
      state.draft.orient = pl.orient;
      state.draft.offset = pl.offset;
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
  const center = selectionCenter();
  commit(() => rotate90Entities(state.doc, [...state.selection], center));
}
el('rotate').addEventListener('click', rotateSelection);

function selectionCenter() {
  const k = vt.scaleK(state.doc.scale);
  const b = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
  for (const e of state.doc.entities) {
    if (!state.selection.has(e.id)) continue;
    const eb = entityBounds(e, k);
    b.minX = Math.min(b.minX, eb.minX); b.minY = Math.min(b.minY, eb.minY);
    b.maxX = Math.max(b.maxX, eb.maxX); b.maxY = Math.max(b.maxY, eb.maxY);
  }
  return snapReal({ x: (b.minX + b.maxX) / 2, y: (b.minY + b.maxY) / 2 });
}
function mirrorSelection(axis) {
  if (state.selection.size === 0) return;
  const center = selectionCenter();
  commit(() => mirrorEntities(state.doc, [...state.selection], axis, center));
}
el('mirror-x').addEventListener('click', () => mirrorSelection('x'));
el('mirror-y').addEventListener('click', () => mirrorSelection('y'));

// ---- 文字入力オーバーレイ(注記/引出線/寸法値編集で共用) ----
const textEntry = el('text-entry');
let textEntryMode = 'text';
let textEntryCtx = null;
function openTextEntry(s, mode, ctx2, initial = '') {
  textEntryMode = mode;
  textEntryCtx = ctx2;
  textEntry.style.left = `${s.x}px`;
  textEntry.style.top = `${s.y}px`;
  textEntry.style.display = 'block';
  textEntry.value = initial;
  textEntry.focus();
  setTimeout(() => { textEntry.focus(); textEntry.select(); }, 0);
}
function closeTextEntry() {
  textEntry.style.display = 'none';
  textEntryCtx = null;
}
textEntry.addEventListener('keydown', (ev) => {
  ev.stopPropagation();
  if (ev.key === 'Escape') {
    closeTextEntry();
    return;
  }
  if (ev.key !== 'Enter') return;
  const value = textEntry.value.trim();
  const ctx2 = textEntryCtx;
  const mode = textEntryMode;
  closeTextEntry();
  if (mode === 'text' && value && ctx2) {
    commit(() => addEntity(state.doc, {
      type: 'text', x: ctx2.pos.x, y: ctx2.pos.y, content: value, height: 3.5,
      layer: 'note', lineType: 'thin',
    }));
  } else if (mode === 'leader' && value && ctx2) {
    commit(() => addEntity(state.doc, {
      type: 'leader', points: [[ctx2.from.x, ctx2.from.y], [ctx2.elbow.x, ctx2.elbow.y]],
      content: value, override: null, layer: 'dim', lineType: 'thin',
    }));
  } else if (mode === 'titlefield' && ctx2) {
    state.doc.titleBlock.fields[ctx2.index].value = value;
    markDirty();
    render();
  } else if (mode === 'bomcell' && ctx2) {
    const target = state.doc.entities.find((en) => en.id === ctx2.id);
    if (target) {
      commit(() => { target.rows[ctx2.rowIndex][ctx2.field] = value; });
    }
  } else if (mode === 'edit' && ctx2) {
    const target = state.doc.entities.find((en) => en.id === ctx2.id);
    if (target) {
      commit(() => {
        if (target.type === 'dim') target.override = value || null;
        else if (target.type === 'balloon') target.number = value || target.number;
        else if (value) target.content = value;
      });
    }
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
el('proj-guides').addEventListener('change', () => {
  state.projGuides = el('proj-guides').checked;
  render();
});
el('show45').addEventListener('change', () => {
  state.show45 = el('show45').checked;
  render();
});

// ---- レイヤーパネル ----
function buildLayerPanel() {
  const list = el('layer-list');
  list.innerHTML = '<span class="head">レイヤー</span><span class="head">表示</span><span class="head">印刷</span>';
  for (const layer of state.doc.layers) {
    const name = document.createElement('span');
    name.textContent = layer.name;
    const vis = document.createElement('input');
    vis.type = 'checkbox';
    vis.checked = layer.visible;
    vis.addEventListener('change', () => {
      layer.visible = vis.checked;
      markDirty();
      render();
    });
    const pr = document.createElement('input');
    pr.type = 'checkbox';
    pr.checked = layer.printable;
    pr.addEventListener('change', () => {
      layer.printable = pr.checked;
      markDirty();
    });
    list.append(name, vis, pr);
  }
}

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
    buildLayerPanel();
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
  buildLayerPanel();
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

// ---- SVG出力・印刷 ----
function exportSVG() {
  const svg = toSVG(state.doc);
  const name = state.fileName.replace(/\.json$/i, '') + '.svg';
  const blob = new Blob([svg], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
el('export-svg').addEventListener('click', exportSVG);

// 実寸印刷: 用紙サイズを@pageに指定したSVGを印刷ダイアログへ。
// 印刷時は倍率100%(実際のサイズ)を指定すること。
function printDrawing() {
  const svg = toSVG(state.doc);
  const paper = paperDimensions(state.doc.paper.size, state.doc.paper.orientation);
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '100%';
  document.body.appendChild(iframe);
  const idoc = iframe.contentDocument;
  idoc.open();
  idoc.write(`<!doctype html><html><head><meta charset="utf-8"><style>@page{size:${paper.width}mm ${paper.height}mm;margin:0}html,body{margin:0;padding:0}svg{display:block}</style></head><body>${svg}</body></html>`);
  idoc.close();
  iframe.contentWindow.focus();
  iframe.contentWindow.print();
  setTimeout(() => iframe.remove(), 60000);
}
el('print').addEventListener('click', printDrawing);

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
window.__seizu = state; // デバッグ・動作検証用(読み取り想定)
resizeCanvas();
syncSettingsUI();
buildLayerPanel();
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
