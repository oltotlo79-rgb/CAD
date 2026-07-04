import { paperDimensions } from './papers.js';
import * as vt from './viewTransform.js';
import { effectiveGridStep } from './gridCalc.js';
import * as geo from './geometry.js';
import {
  createDocument, addEntity, removeEntities, translateEntities,
  duplicateEntities, parseScale, formatScale,
  rotate90Entities, entityBounds, hitTestEntity, STYLE_PRESETS,
  polySegmentCount, polySegmentInfo, setPolySegment, nearestPolySegment,
  entitySegments,
} from './model.js';
import { findSnap } from './snap.js';
import { dimText } from './dims.js';
import { projectionGuides, guideSnapCandidates } from './guides.js';
import { toSVG } from './svgExport.js';
import { titleBlockLayout } from './titleBlock.js';
import { boundaryFromEntity } from './hatch.js';
import { bomLayout, bomRowsFromBalloons } from './bom.js';
import { threadHoleEntities } from './thread.js';
import {
  trimLine, extendLine, offsetEntity, filletLines, chamferLines,
} from './editOps.js';
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
  subSel: null, // 連続線/スプラインの選択中セグメント番号
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
  filletFirst: null, // フィレット1本目 { line, click }
  copyDrag: null,  // 右ドラッグ複製 { ids, startReal, current, bounds }
  clipboard: null, // Ctrl+C の内部クリップボード(エンティティのプロパティ配列)
  offsetPick: null, // オフセット1段階目で選んだ対象
  message: null,   // ステータスバーの操作ガイド
  midGuides: [],   // 中心線モードで表示する近傍の中点ガイド
  mouseReal: null,
};
let messageTimer = null;
function showMessage(text) {
  state.message = text;
  clearTimeout(messageTimer);
  messageTimer = setTimeout(() => {
    state.message = null;
    updateStatus();
  }, 5000);
  updateStatus();
}

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
// 中心線モード: カーソル近傍の線分の中点・円/楕円の中心をガイドとして集める
const DRAW_TOOLS = ['line', 'polyline', 'spline', 'rect', 'circle', 'arc', 'ellipse', 'earc'];
const MID_GUIDE_SKIP = ['dim', 'leader', 'bom', 'balloon', 'hatch', 'text', 'roughness', 'fcf'];
function centerMidGuides(cursor) {
  if (el('line-style').value !== 'center' || !DRAW_TOOLS.includes(state.tool)) return [];
  const k = vt.scaleK(state.doc.scale);
  const range = 60 / pxPerRealMm(); // カーソル周辺60px
  const out = [];
  for (const e of state.doc.entities) {
    if (MID_GUIDE_SKIP.includes(e.type)) continue;
    const b = entityBounds(e, k);
    if (cursor.x < b.minX - range || cursor.x > b.maxX + range
      || cursor.y < b.minY - range || cursor.y > b.maxY + range) continue;
    if (e.type === 'circle' || e.type === 'arc' || e.type === 'ellipse') {
      out.push({ x: e.cx, y: e.cy });
      continue;
    }
    for (const [a, c] of entitySegments(e)) {
      out.push({ x: (a.x + c.x) / 2, y: (a.y + c.y) / 2 });
    }
  }
  return out;
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
  const centerMode = el('line-style').value === 'center' && DRAW_TOOLS.includes(state.tool);
  // 中心線モード: 中点そのもの、または中点を通る水平/垂直の軸ガイドに吸着。
  // 軸上ならどこでも良い(=図形の外へはみ出して中心線を引ける)
  if (centerMode && state.midGuides.length > 0) {
    const tolMid = 12 / pxPerRealMm();
    const gridX = (pt) => (state.gridSnap && currentGridStep()
      ? geo.snapToGrid(pt, currentGridStep()) : pt);
    let best = null;
    let bd = tolMid;
    let kind = 'mid';
    for (const m of state.midGuides) {
      const d = geo.distance(raw, m);
      if (d <= bd) { best = { x: m.x, y: m.y }; bd = d; kind = 'mid'; }
    }
    if (!best) {
      for (const m of state.midGuides) {
        const dH = Math.abs(raw.y - m.y); // 水平軸: yを合わせxは自由(グリッド)
        if (dH <= bd) { best = { x: gridX(raw).x, y: m.y }; bd = dH; kind = 'guide'; }
        const dV = Math.abs(raw.x - m.x); // 垂直軸: xを合わせyは自由(グリッド)
        if (dV <= bd) { best = { x: m.x, y: gridX(raw).y }; bd = dV; kind = 'guide'; }
      }
    }
    if (best) {
      state.snapHint = { x: best.x, y: best.y, kind };
      return best;
    }
  }
  const cands = [];
  // 中心線モードでは端点・交点等への通常スナップを止める(角に吸われて
  // 図形の内側に閉じ込められるのを防ぐ)
  if (state.osnap && !centerMode) {
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
  syncNumPanel();
  updateScrollbars();
}

// ---- 数値パネル(選択種別ごとの動的フィールド) §7 ----
let lastPanelKey = null;
const PANEL_EDITABLE = ['line', 'circle', 'arc', 'rect', 'ellipse', 'polyline', 'spline', 'text'];
function selectedEditable() {
  if (state.selection.size !== 1) return null;
  const sel = state.doc.entities.find((e) => state.selection.has(e.id));
  return sel && PANEL_EDITABLE.includes(sel.type) ? sel : null;
}
const DRAW_FIELDS = [
  { id: 'num-x', label: '始点X' },
  { id: 'num-y', label: 'Y' },
  { id: 'num-len', label: '長さ' },
  { id: 'num-ang', label: '角度', value: '0' },
];
function buildFields(defs) {
  const wrap = el('np-fields');
  wrap.innerHTML = '';
  for (const d of defs) {
    const label = document.createElement('label');
    const cap = document.createElement('span');
    cap.textContent = d.label;
    const input = document.createElement('input');
    input.id = d.id;
    input.size = 7;
    input.value = d.value ?? '';
    label.append(cap, input);
    wrap.append(label);
  }
}
// 選択エンティティのパネル定義(タイトルとフィールド)
function editSchema(sel) {
  const o = state.doc.userOrigin;
  const F = (key, label, value) => ({ id: `np-${key}`, label, value });
  const f2 = (v) => Number(v).toFixed(2);
  const f1 = (v) => Number(v).toFixed(1);
  if (sel.type === 'polyline' || sel.type === 'spline') {
    const name = sel.type === 'polyline' ? '連続線' : 'スプライン';
    if (state.subSel != null && state.subSel < polySegmentCount(sel)) {
      const info = polySegmentInfo(sel, state.subSel);
      return {
        title: `${name} 線分${state.subSel + 1}/${polySegmentCount(sel)}:`,
        fields: [
          F('x', '始点X', f2(info.start.x - o.x)), F('y', 'Y', f2(info.start.y - o.y)),
          F('len', '長さ', f2(info.len)), F('ang', '角度', f1(info.ang)),
        ],
      };
    }
    return {
      title: `${name}(もう一度クリックで線分選択):`,
      fields: [
        F('x', '始点X', f2(sel.points[0][0] - o.x)),
        F('y', 'Y', f2(sel.points[0][1] - o.y)),
      ],
    };
  }
  if (sel.type === 'line') {
    const a = { x: sel.x1, y: sel.y1 };
    const b = { x: sel.x2, y: sel.y2 };
    return { title: '直線:', fields: [
      F('x', '始点X', f2(a.x - o.x)), F('y', 'Y', f2(a.y - o.y)),
      F('len', '長さ', f2(geo.distance(a, b))), F('ang', '角度', f1(geo.angleDegOf(a, b))),
    ] };
  }
  if (sel.type === 'circle') {
    return { title: '円:', fields: [
      F('x', '中心X', f2(sel.cx - o.x)), F('y', 'Y', f2(sel.cy - o.y)),
      F('dia', '直径', f2(sel.r * 2)),
    ] };
  }
  if (sel.type === 'arc') {
    return { title: '円弧:', fields: [
      F('x', '中心X', f2(sel.cx - o.x)), F('y', 'Y', f2(sel.cy - o.y)),
      F('r', '半径', f2(sel.r)),
      F('start', '開始角', f1(sel.startAngle)), F('end', '終了角', f1(sel.endAngle)),
    ] };
  }
  if (sel.type === 'rect') {
    return { title: '矩形:', fields: [
      F('x', '左下X', f2(sel.x - o.x)), F('y', 'Y', f2(sel.y - o.y)),
      F('w', '幅', f2(sel.width)), F('h', '高さ', f2(sel.height)),
      F('rot', '回転', f1(sel.rotation ?? 0)),
    ] };
  }
  if (sel.type === 'ellipse') {
    const fields = [
      F('x', '中心X', f2(sel.cx - o.x)), F('y', 'Y', f2(sel.cy - o.y)),
      F('rx', '半径X', f2(sel.rx)), F('ry', '半径Y', f2(sel.ry)),
      F('rot', '回転', f1(sel.rotation ?? 0)),
    ];
    const isArc = sel.startAngle != null;
    if (isArc) {
      fields.push(F('start', '開始角', f1(sel.startAngle)), F('end', '終了角', f1(sel.endAngle)));
    }
    return { title: isArc ? '楕円弧:' : '楕円:', fields };
  }
  if (sel.type === 'text') {
    return { title: '文字:', fields: [
      F('x', '位置X', f2(sel.x - o.x)), F('y', 'Y', f2(sel.y - o.y)),
      F('rot', '回転', f1(sel.rotation ?? 0)),
    ] };
  }
  return null;
}
function syncNumPanel() {
  const sel = state.tool === 'select' ? selectedEditable() : null;
  const key = sel ? `${sel.type}:${sel.id}:${state.subSel ?? ''}` : `draw:${state.tool}`;
  if (key === lastPanelKey) return;
  lastPanelKey = key;
  if (sel) {
    const schema = editSchema(sel);
    el('np-title').textContent = schema.title;
    buildFields(schema.fields);
    el('num-draw').textContent = '更新';
  } else {
    el('np-title').textContent = '数値入力:';
    buildFields(DRAW_FIELDS);
    el('num-draw').textContent = '作図';
  }
}
function updateStatus() {
  const o = state.doc.userOrigin;
  const m = state.mouseReal;
  const pos = m ? `X:${(m.x - o.x).toFixed(2)}  Y:${(m.y - o.y).toFixed(2)}` : 'X:--  Y:--';
  const step = currentGridStep();
  const grid = step ? `グリッド:${step}mm${state.doc.grid.mode === 'manual' ? '(手動)' : ''}` : 'グリッド:--';
  const msg = state.message ? `【${state.message}】   ` : '';
  el('statusbar').textContent =
    `${msg}${pos}   ${grid}   縮尺 ${formatScale(state.doc.scale.ratio)}   表示 ${state.view.pxPerMm.toFixed(1)}px/mm   要素 ${state.doc.entities.length}`;
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
  lastPanelKey = null; // 数値パネルを最新値で再同期
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
// スクロール=上下パン / Shift+スクロール・Ctrl+スクロール=拡大縮小
// 左右の移動は横スクロールバー(またはチルトホイール/トラックパッド)
canvas.addEventListener('wheel', (ev) => {
  ev.preventDefault();
  const z = state.view.pxPerMm;
  if (ev.ctrlKey || ev.shiftKey) {
    // Shift押下時はブラウザが deltaY を deltaX に振り替えることがある
    const dy = ev.deltaY !== 0 ? ev.deltaY : ev.deltaX;
    const factor = dy < 0 ? 1.2 : 1 / 1.2;
    state.view = vt.zoomAt(state.view, eventScreen(ev), factor);
  } else {
    state.view = {
      ...state.view,
      panX: state.view.panX + ev.deltaX / z,
      panY: state.view.panY - ev.deltaY / z,
    };
  }
  render();
}, { passive: false });

// ---- スクロールバー(用紙±半分の範囲と現在の表示範囲を合わせた世界で表示) ----
function scrollWorld() {
  const paper = paperDimensions(state.doc.paper.size, state.doc.paper.orientation);
  const v = state.view;
  const spanX = v.canvasWidth / v.pxPerMm;
  const spanY = v.canvasHeight / v.pxPerMm;
  const mx = paper.width * 0.5;
  const my = paper.height * 0.5;
  return {
    x0: Math.min(-mx, v.panX),
    x1: Math.max(paper.width + mx, v.panX + spanX),
    y0: Math.min(-my, v.panY),
    y1: Math.max(paper.height + my, v.panY + spanY),
    spanX, spanY,
  };
}
function updateScrollbars() {
  if (!state.view) return;
  const w = scrollWorld();
  const trackW = el('hscroll').clientWidth;
  const thumbW = Math.max(24, (w.spanX / (w.x1 - w.x0)) * trackW);
  const left = ((state.view.panX - w.x0) / (w.x1 - w.x0)) * trackW;
  const ht = el('hthumb');
  ht.style.width = `${thumbW}px`;
  ht.style.left = `${Math.max(0, Math.min(left, trackW - thumbW))}px`;

  const trackH = el('vscroll').clientHeight;
  const thumbH = Math.max(24, (w.spanY / (w.y1 - w.y0)) * trackH);
  const top = ((w.y1 - (state.view.panY + w.spanY)) / (w.y1 - w.y0)) * trackH;
  const vth = el('vthumb');
  vth.style.height = `${thumbH}px`;
  vth.style.top = `${Math.max(0, Math.min(top, trackH - thumbH))}px`;
}
let sbDrag = null; // { axis, start, pan, mmPerPx }
el('hthumb').addEventListener('pointerdown', (ev) => {
  ev.preventDefault();
  ev.stopPropagation();
  const w = scrollWorld();
  sbDrag = {
    axis: 'x', start: ev.clientX, pan: state.view.panX,
    mmPerPx: (w.x1 - w.x0) / el('hscroll').clientWidth,
  };
  try { ev.target.setPointerCapture(ev.pointerId); } catch { /* noop */ }
});
el('vthumb').addEventListener('pointerdown', (ev) => {
  ev.preventDefault();
  ev.stopPropagation();
  const w = scrollWorld();
  sbDrag = {
    axis: 'y', start: ev.clientY, pan: state.view.panY,
    mmPerPx: (w.y1 - w.y0) / el('vscroll').clientHeight,
  };
  try { ev.target.setPointerCapture(ev.pointerId); } catch { /* noop */ }
});
window.addEventListener('pointermove', (ev) => {
  if (!sbDrag) return;
  if (sbDrag.axis === 'x') {
    state.view = { ...state.view, panX: sbDrag.pan + (ev.clientX - sbDrag.start) * sbDrag.mmPerPx };
  } else {
    state.view = { ...state.view, panY: sbDrag.pan - (ev.clientY - sbDrag.start) * sbDrag.mmPerPx };
  }
  render();
});
window.addEventListener('pointerup', () => { sbDrag = null; });
// トラックの空き部分クリックでその位置へジャンプ
el('hscroll').addEventListener('pointerdown', (ev) => {
  if (ev.target !== el('hscroll')) return;
  const w = scrollWorld();
  const rect = el('hscroll').getBoundingClientRect();
  const frac = (ev.clientX - rect.left) / rect.width;
  const cx = w.x0 + frac * (w.x1 - w.x0);
  state.view = { ...state.view, panX: cx - w.spanX / 2 };
  render();
});
el('vscroll').addEventListener('pointerdown', (ev) => {
  if (ev.target !== el('vscroll')) return;
  const w = scrollWorld();
  const rect = el('vscroll').getBoundingClientRect();
  const frac = (ev.clientY - rect.top) / rect.height;
  const cy = w.y1 - frac * (w.y1 - w.y0);
  state.view = { ...state.view, panY: cy - w.spanY / 2 };
  render();
});

function zoomCenter(factor) {
  state.view = vt.zoomAt(state.view, {
    x: state.view.canvasWidth / 2, y: state.view.canvasHeight / 2,
  }, factor);
  render();
}
el('zoom-in').addEventListener('click', () => zoomCenter(1.25));
el('zoom-out').addEventListener('click', () => zoomCenter(1 / 1.25));
el('zoom-fit').addEventListener('click', () => { refitView(); render(); });

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
  state.filletFirst = null;
  state.offsetPick = null;
  state.subSel = null;
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
  if (d?.kind !== 'polyline' && d?.kind !== 'spline') return;
  state.draft = null;
  // 連続する同一点(ダブルクリック等)を除去
  const pts = d.points.filter((p, i) =>
    i === 0 || p.x !== d.points[i - 1].x || p.y !== d.points[i - 1].y);
  const minPts = d.kind === 'spline' ? 3 : 2;
  if (pts.length >= minPts) {
    commit(() => addEntity(state.doc, {
      type: d.kind, points: pts.map((pt) => [pt.x, pt.y]), closed: false, ...styleProps(),
    }));
  } else {
    render();
  }
}
canvas.addEventListener('dblclick', (ev) => {
  if (state.tool === 'select') {
    const s = eventScreen(ev);
    const hit = hitTestScreen(s);
    if (hit && ['dim', 'leader', 'text', 'balloon', 'roughness', 'fcf'].includes(hit.type)) {
      ev.preventDefault();
      const initial = hit.type === 'dim' ? dimText(hit)
        : hit.type === 'balloon' ? String(hit.number)
        : hit.type === 'roughness' ? hit.value
        : hit.type === 'fcf' ? hit.cells.join('|')
        : hit.content;
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
        state.subSel = null;
      } else if (!state.selection.has(hit.id)) {
        state.selection = new Set([hit.id]);
        state.subSel = null;
      } else if (state.selection.size === 1
        && (hit.type === 'polyline' || hit.type === 'spline')) {
        // 選択済みの連続線/スプラインをもう一度クリック → 最寄りの線分を選択
        state.subSel = nearestPolySegment(hit, screenToReal(s));
      }
      state.moveDrag = { lastReal: p, snapshotPushed: false };
    } else {
      if (!ev.shiftKey) {
        state.selection.clear();
        state.subSel = null;
      }
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
  } else if (state.tool === 'polyline' || state.tool === 'spline') {
    if (!state.draft) {
      state.draft = { kind: state.tool, points: [p], current: p };
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
  } else if (state.tool === 'earc') {
    // 楕円弧: 中心 → コーナー(半径XY) → 開始点 → 終了点
    const eparam = (d, q) => geo.round6(
      (Math.atan2((q.y - d.center.y) / d.ry, (q.x - d.center.x) / d.rx) * 180) / Math.PI);
    if (!state.draft) {
      state.draft = { kind: 'earc', stage: 1, center: p, current: p };
    } else if (state.draft.stage === 1) {
      const rx = Math.abs(p.x - state.draft.center.x);
      const ry = Math.abs(p.y - state.draft.center.y);
      if (rx > 0 && ry > 0) {
        state.draft.stage = 2;
        state.draft.rx = rx;
        state.draft.ry = ry;
      }
    } else if (state.draft.stage === 2) {
      state.draft.stage = 3;
      state.draft.startParam = eparam(state.draft, p);
    } else {
      const d = state.draft;
      state.draft = null;
      const start = d.startParam;
      let end = eparam(d, p);
      while (end <= start) end += 360;
      commit(() => addEntity(state.doc, {
        type: 'ellipse', cx: d.center.x, cy: d.center.y, rx: d.rx, ry: d.ry,
        rotation: 0, startAngle: start, endAngle: geo.round6(end), ...styleProps(),
      }));
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
  } else if (state.tool === 'angle') {
    if (!state.draft) {
      state.draft = { kind: 'angle', vertex: p, current: p };
    } else if (!state.draft.p1) {
      if (p.x !== state.draft.vertex.x || p.y !== state.draft.vertex.y) {
        state.draft.p1 = p;
      }
    } else {
      const d = state.draft;
      state.draft = null;
      const radius = geo.round6(geo.distance(d.vertex, p));
      if (radius > 0) {
        commit(() => addEntity(state.doc, {
          type: 'dim', dimType: 'angle',
          vertex: [d.vertex.x, d.vertex.y], p1: [d.p1.x, d.p1.y], p2: [p.x, p.y],
          radius, override: null, layer: 'dim', lineType: 'thin',
        }));
      }
    }
    render();
  } else if (state.tool === 'fillet' || state.tool === 'chamferEdit') {
    const toolName = state.tool === 'fillet' ? 'フィレット' : '面取り';
    const hit = hitTestScreen(s);
    if (!hit) {
      showMessage(`${toolName}: 1本目の直線をクリックしてください`);
    } else if (hit.type !== 'line') {
      showMessage(`${toolName}: 対象は直線のみです(矩形・連続線は先に「分解」)`);
    } else {
      if (!state.filletFirst) {
        state.filletFirst = { line: hit, click: screenToReal(s) };
        state.selection = new Set([hit.id]);
        showMessage(`${toolName}: 2本目の直線をクリックしてください`);
        render();
      } else if (hit.id !== state.filletFirst.line.id) {
        const r = Number(el('fillet-r').value);
        const first = state.filletFirst;
        state.filletFirst = null;
        state.selection.clear();
        if (!(r > 0)) {
          showMessage(`${toolName}: サイズ(mm)を正の数で入力してください`);
        } else {
          const style = { layer: first.line.layer, lineType: first.line.lineType };
          if (state.tool === 'fillet') {
            const f = filletLines(first.line, first.click, hit, screenToReal(s), r);
            if (f) {
              commit(() => {
                Object.assign(first.line, f.l1);
                Object.assign(hit, f.l2);
                addEntity(state.doc, { type: 'arc', ...f.arc, ...style });
              });
            } else {
              showMessage('フィレット: 平行な直線同士には適用できません');
            }
          } else {
            const c = chamferLines(first.line, first.click, hit, screenToReal(s), r);
            if (c) {
              commit(() => {
                Object.assign(first.line, c.l1);
                Object.assign(hit, c.l2);
                addEntity(state.doc, { type: 'line', ...c.line, ...style });
              });
            } else {
              showMessage('面取り: 平行な直線同士には適用できません');
            }
          }
        }
        render();
      }
    }
  } else if (state.tool === 'roughness') {
    commit(() => addEntity(state.doc, {
      type: 'roughness', x: p.x, y: p.y, value: 'Ra 6.3',
      layer: 'note', lineType: 'thin',
    }));
  } else if (state.tool === 'fcf') {
    commit(() => addEntity(state.doc, {
      type: 'fcf', x: p.x, y: p.y, cells: ['//', '0.05', 'A'],
      layer: 'note', lineType: 'thin',
    }));
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
        const angleDeg = Number(el('hatch-angle').value) || 45;
        const spacingMm = Math.max(0.5, Number(el('hatch-space').value) || 3);
        commit(() => addEntity(state.doc, {
          type: 'hatch', boundary, angleDeg, spacingMm,
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
  } else if (state.tool === 'thread') {
    // ねじ穴: クリック位置に 下穴円+谷3/4円弧+中心線十字 を一括生成
    const parts = threadHoleEntities(p, el('thread-size').value, 3 / vt.scaleK(state.doc.scale));
    if (parts) {
      commit(() => {
        for (const props of parts) addEntity(state.doc, props);
      });
    }
  } else if (state.tool === 'trim') {
    const hit = hitTestScreen(s);
    if (!hit) {
      showMessage('トリム: 削除したい区間の直線上をクリックしてください');
    } else if (hit.type !== 'line') {
      showMessage('トリム: 対象は直線のみです(矩形・連続線は先に「分解」)');
    } else {
      const others = state.doc.entities.filter((en) => en.id !== hit.id);
      const pieces = trimLine(hit, screenToReal(s), others);
      if (pieces) {
        commit(() => {
          removeEntities(state.doc, [hit.id]);
          for (const piece of pieces) addEntity(state.doc, piece);
        });
      } else {
        showMessage('トリム: 他の要素との交点がありません');
      }
    }
  } else if (state.tool === 'extend') {
    const hit = hitTestScreen(s);
    if (!hit) {
      showMessage('延長: 伸ばしたい側の直線上をクリックしてください');
    } else if (hit.type !== 'line') {
      showMessage('延長: 対象は直線のみです(矩形・連続線は先に「分解」)');
    } else {
      const others = state.doc.entities.filter((en) => en.id !== hit.id);
      const next = extendLine(hit, screenToReal(s), others);
      if (next) {
        commit(() => Object.assign(hit, next));
      } else {
        showMessage('延長: 延長方向に他の要素がありません');
      }
    }
  } else if (state.tool === 'offset') {
    // 2段階: ①対象をクリック → ②ずらす側をクリック(上下左右どこでも)
    if (!state.offsetPick) {
      const hit = hitTestScreen(s);
      if (!hit) {
        showMessage('オフセット: 対象(直線/円/円弧/矩形)をクリックしてください');
      } else if (!['line', 'circle', 'arc', 'rect'].includes(hit.type)) {
        showMessage('オフセット: 直線・円・円弧・矩形が対象です');
      } else {
        state.offsetPick = hit;
        state.selection = new Set([hit.id]);
        showMessage('オフセット: ずらす側をクリックしてください');
        render();
      }
    } else {
      const target = state.offsetPick;
      state.offsetPick = null;
      state.selection.clear();
      const dist = Number(el('offset-dist').value);
      if (!(dist > 0)) {
        showMessage('オフセット: 距離(mm)を正の数で入力してください');
      } else {
        const props = offsetEntity(target, dist, screenToReal(s));
        if (props) {
          commit(() => addEntity(state.doc, props));
        } else {
          showMessage('オフセット: この距離では作れません(内側に距離が大きすぎる等)');
        }
      }
      render();
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
    if (state.moveDrag.snapshotPushed) lastPanelKey = null; // ドラッグ移動後に値を更新
    state.moveDrag = null;
    render();
    return;
  }
  if (state.draft?.kind === 'box') {
    selectInBox(state.draft.startScreen, state.draft.currentScreen);
    state.draft = null;
    render();
  }
}

// ---- ポインタイベント ----
canvas.addEventListener('contextmenu', (ev) => ev.preventDefault());
canvas.addEventListener('pointerdown', (ev) => {
  const s = eventScreen(ev);
  try { canvas.setPointerCapture(ev.pointerId); } catch { /* 合成イベント等 */ }
  if (ev.button === 1 || state.spaceDown) {
    startPan(s);
    return;
  }
  if (ev.button === 2) {
    // 右ドラッグ: 図形を掴んで離した位置に複製
    const hit = hitTestScreen(s);
    if (hit) {
      const ids = state.selection.has(hit.id) ? [...state.selection] : [hit.id];
      const p = snapReal(screenToReal(s));
      state.copyDrag = {
        ids, startReal: p, current: p,
        bounds: unionBounds(state.doc.entities.filter((e) => ids.includes(e.id))),
      };
      render();
    }
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
  if (state.copyDrag) {
    state.copyDrag.current = snapReal(screenToReal(s));
    state.mouseReal = state.copyDrag.current;
    render();
    return;
  }
  if (state.moveDrag || state.draft?.kind === 'box' || state.tool === 'select') {
    state.snapHint = null;
    state.midGuides = [];
    state.mouseReal = snapReal(screenToReal(s));
  } else {
    state.midGuides = centerMidGuides(screenToReal(s));
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
  if (state.copyDrag) {
    const d = state.copyDrag;
    state.copyDrag = null;
    const dx = d.current.x - d.startReal.x;
    const dy = d.current.y - d.startReal.y;
    if (dx !== 0 || dy !== 0) {
      let clones;
      commit(() => { clones = duplicateEntities(state.doc, d.ids, dx, dy); });
      state.selection = new Set(clones.map((e) => e.id));
    }
    render();
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
  state.subSel = null;
  markDirty();
  render();
}
function doRedo() {
  const snap = redo(state.history, snapshot(state.doc));
  if (!snap) return;
  applySnapshot(state.doc, snap);
  state.selection.clear();
  state.subSel = null;
  markDirty();
  render();
}
el('undo').addEventListener('click', doUndo);
el('redo').addEventListener('click', doRedo);

function deleteSelection() {
  if (state.selection.size === 0) return;
  commit(() => removeEntities(state.doc, [...state.selection]));
  state.selection.clear();
  state.subSel = null;
  render();
}
function duplicateSelection() {
  if (state.selection.size === 0) return;
  let clones;
  commit(() => { clones = duplicateEntities(state.doc, [...state.selection], 10, 10); });
  state.selection = new Set(clones.map((e) => e.id));
  render();
}

// ---- コピー & ペースト ----
function copySelection() {
  if (state.selection.size === 0) return;
  state.clipboard = state.doc.entities
    .filter((e) => state.selection.has(e.id))
    .map((e) => {
      const { id, ...rest } = e;
      return structuredClone(rest);
    });
}
function unionBounds(items) {
  const k = vt.scaleK(state.doc.scale);
  const b = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
  for (const e of items) {
    const eb = entityBounds(e, k);
    b.minX = Math.min(b.minX, eb.minX); b.minY = Math.min(b.minY, eb.minY);
    b.maxX = Math.max(b.maxX, eb.maxX); b.maxY = Math.max(b.maxY, eb.maxY);
  }
  return b;
}
function pasteClipboard() {
  if (!state.clipboard || state.clipboard.length === 0) return;
  // 貼り付け位置: マウスがキャンバス上ならその位置(バウンディング中心)、なければ+10mmずらし
  const b = unionBounds(state.clipboard);
  const center = { x: (b.minX + b.maxX) / 2, y: (b.minY + b.maxY) / 2 };
  const target = state.mouseReal;
  const dx = target ? target.x - center.x : 10;
  const dy = target ? target.y - center.y : 10;
  const ids = [];
  commit(() => {
    for (const props of state.clipboard) {
      ids.push(addEntity(state.doc, structuredClone(props)).id);
    }
    translateEntities(state.doc, ids, dx, dy);
  });
  state.selection = new Set(ids);
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

// 矩形・連続線を個別の直線に分解(トリム/フィレット/面取りの前処理に使う)
function explodeSelection() {
  const targets = state.doc.entities.filter((e) =>
    state.selection.has(e.id) && (e.type === 'rect' || e.type === 'polyline'));
  if (targets.length === 0) {
    showMessage('分解: 矩形または連続線を選択してから押してください');
    return;
  }
  const ids = [];
  commit(() => {
    for (const e of targets) {
      for (const [a, b] of entitySegments(e)) {
        ids.push(addEntity(state.doc, {
          type: 'line', layer: e.layer, lineType: e.lineType,
          x1: a.x, y1: a.y, x2: b.x, y2: b.y,
        }).id);
      }
    }
    removeEntities(state.doc, targets.map((e) => e.id));
  });
  state.selection = new Set(ids);
  state.subSel = null;
  showMessage(`分解: ${targets.length}個の図形を${ids.length}本の直線にしました`);
  render();
}
el('explode').addEventListener('click', explodeSelection);

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
        else if (target.type === 'roughness') target.value = value;
        else if (target.type === 'fcf') target.cells = value.split('|').map((c) => c.trim());
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
// 選択中なら数値でプロパティを更新、未選択なら新規作図
function applyNumPanel() {
  const sel = state.tool === 'select' ? selectedEditable() : null;
  if (!sel) {
    drawLineFromInputs();
    return;
  }
  const v = (key) => Number(document.getElementById(`np-${key}`)?.value);
  const x = v('x');
  const y = v('y');
  if (!Number.isFinite(x) || !Number.isFinite(y)) return;
  const p = originToAbs({ x, y });
  lastPanelKey = null; // 更新後の正規化値で再同期させる

  const normEnd = (start, end) => {
    while (end <= start) end += 360;
    return end;
  };
  if ((sel.type === 'polyline' || sel.type === 'spline') && state.subSel != null) {
    // セグメント単位: 始点基準で終点側の頂点が動く
    const len = v('len');
    const ang = v('ang');
    if (!(len > 0) || !Number.isFinite(ang)) return;
    const i = state.subSel;
    commit(() => setPolySegment(sel, i, p, len, ang));
  } else if (sel.type === 'polyline' || sel.type === 'spline') {
    const dx = p.x - sel.points[0][0];
    const dy = p.y - sel.points[0][1];
    if (dx === 0 && dy === 0) return;
    commit(() => translateEntities(state.doc, [sel.id], dx, dy));
  } else if (sel.type === 'line') {
    const len = v('len');
    const ang = v('ang');
    if (!(len > 0) || !Number.isFinite(ang)) return;
    const end = geo.lineEndPoint(p, len, ang);
    commit(() => {
      sel.x1 = p.x; sel.y1 = p.y; sel.x2 = end.x; sel.y2 = end.y;
    });
  } else if (sel.type === 'circle') {
    const dia = v('dia');
    if (!(dia > 0)) return;
    commit(() => { sel.cx = p.x; sel.cy = p.y; sel.r = dia / 2; });
  } else if (sel.type === 'arc') {
    const r = v('r');
    const start = v('start');
    let end = v('end');
    if (!(r > 0) || !Number.isFinite(start) || !Number.isFinite(end)) return;
    end = normEnd(start, end);
    commit(() => {
      sel.cx = p.x; sel.cy = p.y; sel.r = r;
      sel.startAngle = start; sel.endAngle = end;
    });
  } else if (sel.type === 'rect') {
    const w = v('w');
    const h = v('h');
    const rot = v('rot');
    if (!(w > 0) || !(h > 0) || !Number.isFinite(rot)) return;
    commit(() => {
      sel.x = p.x; sel.y = p.y; sel.width = w; sel.height = h; sel.rotation = rot;
    });
  } else if (sel.type === 'ellipse') {
    const rx = v('rx');
    const ry = v('ry');
    const rot = v('rot');
    if (!(rx > 0) || !(ry > 0) || !Number.isFinite(rot)) return;
    const isArc = sel.startAngle != null;
    let start = null;
    let end = null;
    if (isArc) {
      start = v('start');
      end = v('end');
      if (!Number.isFinite(start) || !Number.isFinite(end)) return;
      end = normEnd(start, end);
    }
    commit(() => {
      sel.cx = p.x; sel.cy = p.y; sel.rx = rx; sel.ry = ry; sel.rotation = rot;
      if (isArc) { sel.startAngle = start; sel.endAngle = end; }
    });
  } else if (sel.type === 'text') {
    const rot = v('rot');
    if (!Number.isFinite(rot)) return;
    commit(() => { sel.x = p.x; sel.y = p.y; sel.rotation = rot; });
  }
}
el('num-draw').addEventListener('click', applyNumPanel);

// どの欄でも Enter で反映。直線ドラフト中はその数値で確定。
// 選択要素の編集中は、欄からフォーカスが外れた時(change)にも自動反映する。
el('np-fields').addEventListener('keydown', (ev) => {
  if (ev.key !== 'Enter') return;
  if (state.draft?.kind === 'line') {
    const len = Number(document.getElementById('num-len')?.value);
    const ang = Number(document.getElementById('num-ang')?.value);
    if (Number.isFinite(len) && len > 0 && Number.isFinite(ang)) {
      commitLine(state.draft.start, geo.lineEndPoint(state.draft.start, len, ang));
      state.draft = null;
      render();
    }
  } else {
    applyNumPanel();
  }
});
el('np-fields').addEventListener('change', () => {
  if (state.tool === 'select' && selectedEditable()) applyNumPanel();
});

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
    state.subSel = null;
    state.filletFirst = null;
    state.offsetPick = null;
    closeTextEntry();
    render();
    return;
  }
  if (isTyping(ev)) return;
  // 矢印キーでパン
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(ev.key)) {
    ev.preventDefault();
    const step = 60 / state.view.pxPerMm; // 60px相当
    state.view = {
      ...state.view,
      panX: state.view.panX
        + (ev.key === 'ArrowRight' ? step : ev.key === 'ArrowLeft' ? -step : 0),
      panY: state.view.panY
        + (ev.key === 'ArrowUp' ? step : ev.key === 'ArrowDown' ? -step : 0),
    };
    render();
    return;
  }
  if (ev.key === 'Enter') finishPolyline();
  if (ev.key === 'Delete' || ev.key === 'Backspace') deleteSelection();
  if (ev.ctrlKey && ev.key.toLowerCase() === 'z' && !ev.shiftKey) { ev.preventDefault(); doUndo(); }
  if ((ev.ctrlKey && ev.key.toLowerCase() === 'y') ||
      (ev.ctrlKey && ev.shiftKey && ev.key.toLowerCase() === 'z')) { ev.preventDefault(); doRedo(); }
  if (ev.ctrlKey && ev.key.toLowerCase() === 'd') { ev.preventDefault(); duplicateSelection(); }
  if (ev.ctrlKey && ev.key.toLowerCase() === 'c') { ev.preventDefault(); copySelection(); }
  if (ev.ctrlKey && ev.key.toLowerCase() === 'v') { ev.preventDefault(); pasteClipboard(); }
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
