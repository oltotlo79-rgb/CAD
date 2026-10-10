import { paperDimensions } from './papers.js';
import * as vt from './viewTransform.js';
import { effectiveGridStep } from './gridCalc.js';
import * as geo from './geometry.js';
import {
  createDocument, addEntity, removeEntities, translateEntities,
  duplicateEntities, parseScale, formatScale,
  rotateEntities, scaleEntities, entityBounds, hitTestEntity, STYLE_PRESETS,
  polySegmentCount, polySegmentInfo, setPolySegment, nearestPolySegment,
  entitySegments, isEntityVisible, parseNumber,
} from './model.js';
import { findSnap } from './snap.js';
import {
  dimText, DIM_TEXT_MM, dimTextHit, dimShiftAt, fmtMm,
} from './dims.js';
import {
  WIDTH_CHOICES_MM, TEXT_CHOICES_MM, hasStroke, hasText, widthSettingMm, textHeightMm,
  applyWidth, applyTextHeight, commonValue, strokeStyleOf,
  hasLineType, presetOf, applyPreset,
} from './entityStyle.js';
import {
  toolForKey, tooltipText, guideFor, toolAccepts,
} from './toolInfo.js';
import { buildContextMenu } from './menuModel.js';
import { createPopupMenu } from './popupMenu.js';
import { createHelp, helpTopicForTool } from './helpView.js';
import { projectionGuides, guideSnapCandidates } from './guides.js';
import { toSVG } from './svgExport.js';
import { titleBlockLayout } from './titleBlock.js';
import { boundaryFromEntity } from './hatch.js';
import { bomLayout, bomRowsFromBalloons } from './bom.js';
import { threadHoleEntities } from './thread.js';
import {
  POLYGON_SIZE_MODES, parseSides, regularPolygonPoints, polygonFromCursor,
} from './polygon.js';
import {
  nextGroupId, withGroupMembers, groupsFullyInside, ungroupEntities, renumberGroups,
} from './groups.js';
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
// 日本語入力の変換中(変換を確定する Enter など)か。古いブラウザは keyCode 229 で分かる
const isComposing = (ev) => ev.isComposing || ev.keyCode === 229;

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
  hover: null,       // マウスを乗せている(クリックできる)図形のid
  hoverGroup: null,  // 選択ツールでマウスを乗せた図形のまとまり(グループ番号)。全体を強調する
  hoverDimText: false, // 選択ツールで寸法の値の上にマウスがあるか
  polygonMode: 'side', // 正多角形の大きさの決め方(side=二面幅 / corner=対角 / edge=一辺)
  mouseScreen: null, // キャンバス上のマウス位置(操作ガイドの表示位置)
  dimTextDrag: null, // 寸法の値のドラッグ { id, snapshotPushed }
  rightPress: null,  // 右ボタンを押した画面位置(動かさずに離したらメニュー)
  showGuide: true,   // カーソル横の操作ガイド
  // 次に作る図形の線種・線の太さ・文字高さ(用紙mm)。ツールの種類ごとに覚える(widthMm:null=標準)
  pen: {
    shape: { preset: 'outline', widthMm: null },  // 直線・円などの図形
    text: { textMm: DIM_TEXT_MM },                // 文字
    anno: { widthMm: null, textMm: DIM_TEXT_MM }, // 寸法・記号・バルーン・部品表・ハッチ
  },
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
const DRAW_TOOLS = ['line', 'polyline', 'spline', 'rect', 'polygon', 'circle', 'arc', 'ellipse', 'earc'];
const MID_GUIDE_SKIP = ['dim', 'leader', 'bom', 'balloon', 'hatch', 'text', 'roughness', 'fcf'];
function centerMidGuides(cursor) {
  if (state.pen.shape.preset !== 'center' || !DRAW_TOOLS.includes(state.tool)) return [];
  const k = vt.scaleK(state.doc.scale);
  const range = 60 / pxPerRealMm(); // カーソル周辺60px
  const out = [];
  for (const e of state.doc.entities) {
    if (MID_GUIDE_SKIP.includes(e.type) || !isEntityVisible(state.doc, e)) continue;
    const b = entityBounds(e, k);
    if (cursor.x < b.minX - range || cursor.x > b.maxX + range
      || cursor.y < b.minY - range || cursor.y > b.maxY + range) continue;
    if (e.type === 'circle' || e.type === 'arc' || e.type === 'ellipse') {
      out.push({ x: e.cx, y: e.cy });
      continue;
    }
    if (e.type === 'polyline' && e.closed && e.points.length >= 3) {
      out.push(geo.polygonCentroid(e.points)); // 正多角形などの中心
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
  const centerMode = state.pen.shape.preset === 'center' && DRAW_TOOLS.includes(state.tool);
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
    // 引出線・バルーンの矢印の先(1点目)は、円・円弧の上下左右に加えて斜め45°の点にも吸い付く
    const leaderTip = (state.tool === 'leader' || state.tool === 'balloon') && !state.draft;
    const hit = findSnap(state.doc, raw, tolMm, vt.scaleK(state.doc.scale),
      leaderTip ? { perimeterStepDeg: 45 } : {});
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
// 作図中の線種プリセット・太さ → エンティティ属性
const widthProp = (pen) => (pen.widthMm ? { widthMm: pen.widthMm } : {});
function styleProps() {
  const preset = STYLE_PRESETS[state.pen.shape.preset] ?? STYLE_PRESETS.outline;
  return { lineType: preset.lineType, layer: preset.layer, ...widthProp(state.pen.shape) };
}
// 寸法・記号・部品表の属性(細線。太さ・文字高さは注記ツールの設定、3.5mmは既定なので省略)
function annoProps(layer) {
  const { textMm } = state.pen.anno;
  return {
    layer, lineType: 'thin', ...widthProp(state.pen.anno),
    ...(textMm !== DIM_TEXT_MM ? { textMm } : {}),
  };
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
  syncStyleUI();
  updateScrollbars();
  updateCursorTip();
}

// ---- 数値パネル(選択種別ごとの動的フィールド) §7 ----
let lastPanelKey = null;
let cancelPanelEdit = false; // Esc で欄を離れる時は、打ちかけの値を図形に反映しない
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
// 正多角形ツールの数値入力: 中心・大きさ・向き。大きさの欄の名前は、決め方を選ぶメニューを兼ねる
function polygonFields() {
  return [
    { id: 'num-x', label: '中心X' },
    { id: 'num-y', label: 'Y' },
    { id: 'num-len', caption: polygonModeSelect },
    { id: 'num-ang', label: '角度', value: '90' },
  ];
}
function polygonModeSelect() {
  const select = document.createElement('select');
  select.id = 'polygon-mode';
  select.title = '正多角形の大きさの決め方\n二面幅＝向かい合う辺と辺の間（2回目のクリックは辺の真ん中）\n'
    + '対角＝向かい合う角と角の間（2回目のクリックは角）\n一辺＝1つの辺の長さ（2回目のクリックは角）';
  for (const [value, mode] of Object.entries(POLYGON_SIZE_MODES)) select.add(new Option(mode.label, value));
  select.value = state.polygonMode;
  return select;
}
function buildFields(defs) {
  const wrap = el('np-fields');
  wrap.innerHTML = '';
  for (const d of defs) {
    const label = document.createElement('label');
    const cap = d.caption ? d.caption() : document.createElement('span');
    if (!d.caption) cap.textContent = d.label;
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
    const name = sel.type === 'spline' ? 'スプライン' : sel.closed ? '多角形' : '連続線';
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
  } else if (state.tool === 'polygon') {
    el('np-title').textContent = '正多角形:';
    buildFields(polygonFields());
    el('num-draw').textContent = '作図';
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
// 画面に表示されているキャンバスの大きさ(小数まで。拡大表示の125%などでも正確に)
function canvasCssSize() {
  const r = canvas.getBoundingClientRect();
  return { w: r.width, h: r.height };
}
function refitView() {
  const p = paperDimensions(state.doc.paper.size, state.doc.paper.orientation);
  const { w, h } = canvasCssSize();
  state.view = vt.fitPaperView(p.width, p.height, w, h);
}
function resizeCanvas() {
  const dpr = window.devicePixelRatio || 1;
  const { w, h } = canvasCssSize();
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
// タブの切り替えでボタンが2段になる・数値入力の欄が折り返す・復元の帯が出るなど、ウィンドウの
// 大きさが同じでもキャンバスの大きさは変わる。古い大きさのまま計算すると、絵が引き伸ばされて
// マウスの位置と図形の見た目がずれる(クリックした所と違う所が選ばれる)ので、必ず追従する
new ResizeObserver(resizeCanvas).observe(canvas);

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

// ---- ツールバーのタブ ----
function activateTab(name) {
  // 以前のバージョンで保存されたタブ名など、存在しないタブなら「作図」に戻す
  const panels = [...document.querySelectorAll('#ribbon .panel')];
  if (!panels.some((p) => p.dataset.panel === name)) name = 'draw';
  document.querySelectorAll('#tabs .tab').forEach((t) =>
    t.classList.toggle('active', t.dataset.tab === name));
  document.querySelectorAll('#ribbon .panel').forEach((p) =>
    p.classList.toggle('active', p.dataset.panel === name));
  try { localStorage.setItem('seizu.tab', name); } catch { /* 保存できなくても動作は続ける */ }
}
document.querySelectorAll('#tabs .tab').forEach((t) =>
  t.addEventListener('click', () => activateTab(t.dataset.tab)));

// ---- ツール ----
function setTool(tool) {
  state.tool = tool;
  state.draft = null;
  state.filletFirst = null;
  state.offsetPick = null;
  state.subSel = null;
  state.hover = null;
  state.hoverGroup = null;
  document.querySelectorAll('#toolbar .tool').forEach((b) =>
    b.classList.toggle('active', b.dataset.tool === tool));
  // キー操作で選んだツールも見えるよう、そのボタンがあるタブを開く
  const panel = document.querySelector(`#ribbon .panel [data-tool="${tool}"]`)?.closest('.panel');
  if (panel) activateTab(panel.dataset.panel);
  render();
}
document.querySelectorAll('#toolbar .tool').forEach((b) => {
  b.title = tooltipText(b.dataset.tool);
  b.addEventListener('click', () => setTool(b.dataset.tool));
});

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

// ---- 正多角形(できあがりは閉じた連続線) ----
// 角数の欄の値。正しくなければ理由を表示して null
function polygonSides() {
  const n = parseSides(el('polygon-sides').value);
  if (n == null) showMessage('正多角形: 角数は 3〜64 の整数で入れてください（六角形なら 6）');
  return n;
}
function polygonModeLabel() {
  return POLYGON_SIZE_MODES[state.polygonMode].label;
}
function commitPolygon(center, size, angleDeg) {
  const sides = polygonSides();
  if (!sides || !(size > 0)) return;
  commit(() => addEntity(state.doc, {
    type: 'polyline', closed: true,
    points: regularPolygonPoints(center, sides, size, angleDeg, state.polygonMode),
    ...styleProps(),
  }));
}
// 作図中: マウスの位置から形を決め、プレビューと数値入力の欄に出す。
// 点スナップで吸い付いた点ならその点に合わせ、そうでなければ向きを15°刻みにする
function updatePolygonDraft() {
  const d = state.draft;
  if (d?.kind !== 'polygon') return;
  const sides = parseSides(el('polygon-sides').value);
  d.fit = sides ? polygonFromCursor(d.center, d.current, sides, state.polygonMode, !!state.snapHint) : null;
  d.points = null;
  if (!d.fit) return;
  d.points = regularPolygonPoints(d.center, sides, d.fit.size, d.fit.angleDeg, state.polygonMode);
  // 大きさの基準の円(二面幅=辺に接する円、対角・一辺=角を通る円)と、2回目のクリック点
  const [p0, p1] = d.points;
  const target = POLYGON_SIZE_MODES[state.polygonMode].target === 'side'
    ? { x: (p0[0] + p1[0]) / 2, y: (p0[1] + p1[1]) / 2 } : { x: p0[0], y: p0[1] };
  d.circleR = geo.distance(d.center, target);
  d.handle = target;
  const active = document.activeElement;
  if (active !== el('num-len') && active !== el('num-ang')) {
    el('num-len').value = d.fit.size.toFixed(2);
    el('num-ang').value = d.fit.angleDeg.toFixed(1);
  }
}
// 数値入力だけで描く(中心X・Y、大きさ、角度)
function drawPolygonFromInputs() {
  const x = parseNumber(el('num-x').value);
  const y = parseNumber(el('num-y').value);
  const size = parseNumber(el('num-len').value);
  const ang = parseNumber(el('num-ang').value);
  if (![x, y, ang].every(Number.isFinite) || !(size > 0)) {
    showMessage(`正多角形: 中心X・Y、${polygonModeLabel()}、角度を数字で入れてください`);
    return;
  }
  commitPolygon(originToAbs({ x, y }), size, ang);
}
el('polygon-sides').addEventListener('input', () => {
  updatePolygonDraft();
  render();
});

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
// 寸法値・文字・バルーン番号などの書き換え入力を開く
const VALUE_EDITABLE = ['dim', 'leader', 'text', 'balloon', 'roughness', 'fcf'];
function openValueEditor(hit, s) {
  const initial = hit.type === 'dim' ? dimText(hit)
    : hit.type === 'balloon' ? String(hit.number)
    : hit.type === 'roughness' ? hit.value
    : hit.type === 'fcf' ? hit.cells.join('|')
    : hit.content;
  openTextEntry(s, 'edit', { id: hit.id }, initial);
}
canvas.addEventListener('dblclick', (ev) => {
  if (state.tool === 'select') {
    const s = eventScreen(ev);
    const hit = hitTestScreen(s);
    if (hit && VALUE_EDITABLE.includes(hit.type)) {
      ev.preventDefault();
      openValueEditor(hit, s);
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
  // 上に描かれた図形を優先。非表示レイヤーの図形は見えないのでクリックできない
  for (let i = state.doc.entities.length - 1; i >= 0; i--) {
    const e = state.doc.entities[i];
    if (isEntityVisible(state.doc, e) && hitTestEntity(e, real, tolMm, k)) return e;
  }
  return null;
}

function selectInBox(startScreen, endScreen) {
  const a = screenToReal(startScreen);
  const b = screenToReal(endScreen);
  const minX = Math.min(a.x, b.x), maxX = Math.max(a.x, b.x);
  const minY = Math.min(a.y, b.y), maxY = Math.max(a.y, b.y);
  const k = vt.scaleK(state.doc.scale);
  const inside = [];
  for (const e of state.doc.entities) {
    if (!isEntityVisible(state.doc, e)) continue;
    const bb = entityBounds(e, k);
    if (bb.minX >= minX && bb.maxX <= maxX && bb.minY >= minY && bb.maxY <= maxY) {
      inside.push(e.id);
    }
  }
  // ねじ穴などのまとまり(グループ)は、見えている部分がすべて枠に入った時だけまとめて選ぶ
  const visible = (e) => isEntityVisible(state.doc, e);
  for (const id of groupsFullyInside(state.doc.entities, inside, visible)) state.selection.add(id);
}

// ---- ツールのポインタ処理 ----
function handleToolPointerDown(s, ev) {
  const p = state.tool === 'select' ? snapReal(screenToReal(s)) : resolvePoint(s);
  if (state.tool === 'select') {
    const hit = hitTestScreen(s);
    if (hit) {
      // ねじ穴などのまとまり(グループ)は、どれか1つをクリックすると全体を選ぶ
      const ids = withGroupMembers(state.doc.entities, [hit.id]);
      if (ev.shiftKey) {
        const add = !state.selection.has(hit.id);
        for (const id of ids) {
          if (add) state.selection.add(id);
          else state.selection.delete(id);
        }
        state.subSel = null;
      } else if (!state.selection.has(hit.id)) {
        state.selection = ids;
        state.subSel = null;
      } else if (state.selection.size === 1
        && (hit.type === 'polyline' || hit.type === 'spline')) {
        // 選択済みの連続線/スプラインをもう一度クリック → 最寄りの線分を選択
        state.subSel = nearestPolySegment(hit, screenToReal(s));
      }
      if (!ev.shiftKey && isOverDimText(hit, s)) {
        // 長さ寸法の値を掴んだら、値だけを寸法線に沿って動かす
        state.selection = new Set([hit.id]);
        state.dimTextDrag = { id: hit.id, snapshotPushed: false };
      } else {
        state.moveDrag = { lastReal: p, startReal: p, snapshotPushed: false };
      }
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
  } else if (state.tool === 'polygon') {
    // 正多角形: 中心 → 辺の真ん中(二面幅)または角(対角・一辺)
    if (!state.draft) {
      if (polygonSides()) {
        state.draft = { kind: 'polygon', center: p, current: p };
        const o = state.doc.userOrigin;
        el('num-x').value = (p.x - o.x).toFixed(2);
        el('num-y').value = (p.y - o.y).toFixed(2);
      }
    } else {
      state.draft.current = p;
      updatePolygonDraft();
      const d = state.draft;
      if (d.fit) {
        state.draft = null;
        commitPolygon(d.center, d.fit.size, d.fit.angleDeg);
      } else {
        polygonSides(); // 角数の欄が正しくなければ理由を表示
      }
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
        override: null, ...annoProps('dim'),
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
        override: null, ...annoProps('dim'),
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
          radius, override: null, ...annoProps('dim'),
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
        const r = parseNumber(el('fillet-r').value);
        const first = state.filletFirst;
        state.filletFirst = null;
        state.selection.clear();
        if (!(r > 0)) {
          showMessage(`${toolName}: サイズ(mm)を正の数で入力してください`);
        } else {
          const style = strokeStyleOf(first.line);
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
      type: 'roughness', x: p.x, y: p.y, value: 'Ra 6.3', ...annoProps('note'),
    }));
  } else if (state.tool === 'fcf') {
    commit(() => addEntity(state.doc, {
      type: 'fcf', x: p.x, y: p.y, cells: ['//', '0.05', 'A'], ...annoProps('note'),
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
        tail: [p.x, p.y], size: d.size, override: null, ...annoProps('dim'),
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
        // 角度は 0° も有効。空欄や数字でない時だけ既定値にする
        const angle = parseNumber(el('hatch-angle').value);
        const space = parseNumber(el('hatch-space').value);
        const angleDeg = Number.isFinite(angle) ? angle : 45;
        const spacingMm = Math.max(0.5, Number.isFinite(space) ? space : 3);
        commit(() => addEntity(state.doc, {
          type: 'hatch', boundary, angleDeg, spacingMm,
          layer: 'outline', lineType: 'thin', ...widthProp(state.pen.anno),
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
        ...annoProps('note'),
      }));
    }
    render();
  } else if (state.tool === 'bom') {
    commit(() => addEntity(state.doc, {
      type: 'bom', x: p.x, y: p.y, rows: bomRowsFromBalloons(state.doc.entities),
      ...annoProps('note'),
    }));
    setTool('select');
  } else if (state.tool === 'thread') {
    // ねじ穴: クリック位置に 下穴円+谷3/4円弧+中心線十字 を一括生成。
    // 1つのまとまり(グループ)にして、まとめて選んで動かせるようにする(「分解」で別々に戻る)
    const parts = threadHoleEntities(p, el('thread-size').value, 3 / vt.scaleK(state.doc.scale));
    if (parts) {
      const group = nextGroupId(state.doc.entities);
      commit(() => {
        for (const props of parts) addEntity(state.doc, { ...props, group });
      });
    }
  } else if (state.tool === 'trim') {
    const hit = hitTestScreen(s);
    if (!hit) {
      showMessage('トリム: 削除したい区間の直線上をクリックしてください');
    } else if (hit.type !== 'line') {
      showMessage('トリム: 対象は直線のみです(矩形・連続線は先に「分解」)');
    } else {
      // 見えている図形だけを切る相手にする
      const others = state.doc.entities.filter((en) => en.id !== hit.id && isEntityVisible(state.doc, en));
      const pieces = trimLine(hit, screenToReal(s), others);
      if (pieces) {
        commit(() => {
          removeEntities(state.doc, [hit.id]);
          // 切った残りは、元の線のまとまり(ねじ穴の中心線など)に残す
          const group = hit.group != null ? { group: hit.group } : {};
          for (const piece of pieces) addEntity(state.doc, { ...piece, ...group });
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
      const others = state.doc.entities.filter((en) => en.id !== hit.id && isEntityVisible(state.doc, en));
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
      const dist = parseNumber(el('offset-dist').value);
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

function isOverDimText(e, s) {
  return dimTextHit(e, screenToReal(s), 3 / pxPerRealMm(), vt.scaleK(state.doc.scale));
}

// 寸法の値のドラッグ: マウス位置を寸法線の向きに投影した位置へ。中央付近は中央に吸着
function moveDimText(s) {
  const drag = state.dimTextDrag;
  const e = state.doc.entities.find((en) => en.id === drag.id);
  if (!e) return;
  let shift = dimShiftAt(e, screenToReal(s));
  if (Math.abs(shift) < 8 / pxPerRealMm()) shift = 0;
  shift = Math.round(shift * 100) / 100;
  if (shift === (Number(e.textShift) || 0)) return;
  if (!drag.snapshotPushed) {
    pushSnapshot(state.history, snapshot(state.doc));
    drag.snapshotPushed = true;
    markDirty();
  }
  if (shift) e.textShift = shift;
  else delete e.textShift;
}

function handleToolPointerMove(s) {
  const p = state.mouseReal;
  if (state.dimTextDrag) {
    moveDimText(s);
    return;
  }
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
      // 長さ・角度を打ち込み中の欄は上書きしない
      const active = document.activeElement;
      if (active !== el('num-len') && active !== el('num-ang')) {
        el('num-len').value = geo.distance(state.draft.start, p).toFixed(2);
        el('num-ang').value = geo.angleDegOf(state.draft.start, p).toFixed(1);
      }
    } else if (state.draft.kind === 'dim' && state.draft.stage === 2) {
      const pl = dimPlacement(state.draft.p1, state.draft.p2, p, false);
      state.draft.orient = pl.orient;
      state.draft.offset = pl.offset;
    } else if (state.draft.kind === 'polygon') {
      updatePolygonDraft();
    }
  }
}

function handleToolPointerUp() {
  if (state.dimTextDrag) {
    state.dimTextDrag = null;
    render();
    return;
  }
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
    // 右ボタン: 動かさずに離せばメニュー、図形を掴んでドラッグすれば離した位置に複製
    state.rightPress = { screen: s };
    const hit = hitTestScreen(s);
    if (hit) {
      const ids = state.selection.has(hit.id) ? [...state.selection]
        : [...withGroupMembers(state.doc.entities, [hit.id])];
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
// マウスを乗せた図形のうち、今のツールでクリックできるものを強調する
function updateHover(s) {
  const busy = state.moveDrag || state.dimTextDrag || state.copyDrag || state.draft?.kind === 'box';
  const hit = busy ? null : hitTestScreen(s);
  state.hover = hit && toolAccepts(state.tool, hit) ? hit.id : null;
  // 選択ツールでは、まとまり(ねじ穴など)全体を強調して、まとめて選ばれることを示す
  state.hoverGroup = state.hover != null && state.tool === 'select' ? (hit.group ?? null) : null;
  state.hoverDimText = !!hit && state.tool === 'select' && isOverDimText(hit, s);
}

canvas.addEventListener('pointermove', (ev) => {
  if (!state.view) return;
  const s = eventScreen(ev);
  state.mouseScreen = s;
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
  updateHover(s);
  render();
});
canvas.addEventListener('pointerleave', () => {
  state.mouseScreen = null;
  state.hover = null;
  state.hoverGroup = null;
  render();
});
canvas.addEventListener('pointerup', (ev) => {
  if (state.panDrag) {
    state.panDrag = null;
    return;
  }
  const press = state.rightPress;
  state.rightPress = null;
  if (ev.button === 2 && press) {
    const s = eventScreen(ev);
    if (Math.hypot(s.x - press.screen.x, s.y - press.screen.y) < 5) {
      state.copyDrag = null;
      openCanvasMenu(s, ev);
      render();
      return;
    }
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
    const items = state.clipboard.map((props) => structuredClone(props));
    // 貼り付けたねじ穴などは、元とは別のまとまりにする
    renumberGroups(items, nextGroupId(state.doc.entities));
    for (const props of items) ids.push(addEntity(state.doc, props).id);
    translateEntities(state.doc, ids, dx, dy);
  });
  state.selection = new Set(ids);
  render();
}
// ---- 回転・拡大縮小(選択範囲の中心が基準) ----
function rotateSelectionBy(deg) {
  if (state.selection.size === 0) {
    showMessage('回転: 先に回したい図形をクリックして選んでください');
    return;
  }
  if (!Number.isFinite(deg) || deg === 0) {
    showMessage('回転: 角度を数字で入れてください（例: 90 で左回り、-45 で右回り）');
    return;
  }
  const center = selectionCenter();
  commit(() => rotateEntities(state.doc, [...state.selection], center, deg));
}
function scaleSelectionBy(f) {
  if (state.selection.size === 0) {
    showMessage('拡大縮小: 先に図形をクリックして選んでください');
    return;
  }
  if (!(f > 0)) {
    showMessage('拡大縮小: 倍率を0より大きい数字で入れてください（例: 2 で2倍、0.5 で半分）');
    return;
  }
  if (f === 1) return;
  const center = selectionCenter();
  commit(() => scaleEntities(state.doc, [...state.selection], center, f));
}
el('rotate').addEventListener('click', () => rotateSelectionBy(parseNumber(el('rotate-angle').value)));
el('scale').addEventListener('click', () => scaleSelectionBy(parseNumber(el('scale-factor').value)));
// 角度・倍率の欄で Enter でも実行(日本語入力の変換を確定する Enter は除く)
const enterRuns = (buttonId) => (ev) => {
  if (ev.key === 'Enter' && !isComposing(ev)) el(buttonId).click();
};
el('rotate-angle').addEventListener('keydown', enterRuns('rotate'));
el('scale-factor').addEventListener('keydown', enterRuns('scale'));

function selectAll() {
  if (state.tool !== 'select') setTool('select');
  const visible = new Map(state.doc.layers.map((l) => [l.id, l.visible]));
  // 見えている図形と、それとまとまり(グループ)になっている図形
  state.selection = withGroupMembers(state.doc.entities, state.doc.entities
    .filter((e) => visible.get(e.layer) !== false).map((e) => e.id));
  state.subSel = null;
  render();
}

function selectionCenter() {
  const k = vt.scaleK(state.doc.scale);
  const b = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
  for (const e of state.doc.entities) {
    if (!state.selection.has(e.id)) continue;
    const eb = entityBounds(e, k);
    b.minX = Math.min(b.minX, eb.minX); b.minY = Math.min(b.minY, eb.minY);
    b.maxX = Math.max(b.maxX, eb.maxX); b.maxY = Math.max(b.maxY, eb.maxY);
  }
  // グリッドに丸めず正確な中心を使う(丸めると回転・反転のたびに図形の位置がずれる)
  return { x: geo.round6((b.minX + b.maxX) / 2), y: geo.round6((b.minY + b.maxY) / 2) };
}
function mirrorSelection(axis) {
  if (state.selection.size === 0) return;
  const center = selectionCenter();
  commit(() => mirrorEntities(state.doc, [...state.selection], axis, center));
}
el('mirror-x').addEventListener('click', () => mirrorSelection('x'));
el('mirror-y').addEventListener('click', () => mirrorSelection('y'));

// 分解: 矩形・連続線(正多角形を含む)を個別の直線に(トリム/フィレット/面取りの前処理)、
// ねじ穴などのまとまり(グループ)を別々の図形に戻す
function explodeSelection() {
  const selected = state.doc.entities.filter((e) => state.selection.has(e.id));
  const grouped = selected.filter((e) => e.group != null);
  const targets = selected.filter((e) =>
    e.group == null && (e.type === 'rect' || e.type === 'polyline'));
  if (grouped.length === 0 && targets.length === 0) {
    showMessage('分解: 矩形・連続線・正多角形・ねじ穴を選択してから押してください');
    return;
  }
  const ids = [];
  let groups = 0;
  commit(() => {
    groups = ungroupEntities(state.doc.entities, grouped.map((e) => e.id));
    for (const e of targets) {
      for (const [a, b] of entitySegments(e)) {
        ids.push(addEntity(state.doc, {
          type: 'line', ...strokeStyleOf(e),
          x1: a.x, y1: a.y, x2: b.x, y2: b.y,
        }).id);
      }
    }
    removeEntities(state.doc, targets.map((e) => e.id));
  });
  // 分けた図形は選んだままにする(どれが分かれたか見えるように)
  state.selection = new Set([...grouped.map((e) => e.id), ...ids]);
  state.subSel = null;
  const done = [];
  if (groups > 0) done.push(`${groups}個のまとまり（ねじ穴など）を${grouped.length}個の図形に分けました`);
  if (targets.length > 0) done.push(`${targets.length}個の図形を${ids.length}本の直線にしました`);
  showMessage(`分解: ${done.join('、')}`);
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
  if (isComposing(ev)) return; // 日本語入力の変換中の Enter/Esc は入力欄に任せる
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
      type: 'text', x: ctx2.pos.x, y: ctx2.pos.y, content: value, height: state.pen.text.textMm,
      layer: 'note', lineType: 'thin',
    }));
  } else if (mode === 'leader' && value && ctx2) {
    commit(() => addEntity(state.doc, {
      type: 'leader', points: [[ctx2.from.x, ctx2.from.y], [ctx2.elbow.x, ctx2.elbow.y]],
      content: value, override: null, ...annoProps('dim'),
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
  const x = parseNumber(el('num-x').value);
  const y = parseNumber(el('num-y').value);
  const len = parseNumber(el('num-len').value);
  const ang = parseNumber(el('num-ang').value);
  if (![x, y, len, ang].every(Number.isFinite) || len <= 0) return;
  const start = originToAbs({ x, y });
  commitLine(start, geo.lineEndPoint(start, len, ang));
}
// 選択中なら数値でプロパティを更新、未選択なら新規作図
function applyNumPanel() {
  const sel = state.tool === 'select' ? selectedEditable() : null;
  if (!sel) {
    if (state.tool === 'polygon') drawPolygonFromInputs();
    else drawLineFromInputs();
    return;
  }
  const v = (key) => parseNumber(document.getElementById(`np-${key}`)?.value ?? '');
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

// どの欄でも Enter で反映。直線・正多角形の作図中はその数値で確定。
// 選択要素の編集中は、欄からフォーカスが外れた時(change)にも自動反映する。
el('np-fields').addEventListener('keydown', (ev) => {
  if (ev.key !== 'Enter' || isComposing(ev)) return;
  if (state.draft?.kind === 'line' || state.draft?.kind === 'polygon') {
    const len = parseNumber(document.getElementById('num-len')?.value ?? '');
    const ang = parseNumber(document.getElementById('num-ang')?.value ?? '');
    if (Number.isFinite(len) && len > 0 && Number.isFinite(ang)) {
      const d = state.draft;
      state.draft = null;
      if (d.kind === 'line') commitLine(d.start, geo.lineEndPoint(d.start, len, ang));
      else commitPolygon(d.center, len, ang);
      render();
    }
  } else {
    applyNumPanel();
  }
});
el('np-fields').addEventListener('change', (ev) => {
  if (ev.target.id === 'polygon-mode') {
    // 正多角形の大きさの決め方を変えた(欄の名前も変わる)
    state.polygonMode = ev.target.value;
    ev.target.blur(); // すぐに数字のキー入力などが図面に効くように
    updatePolygonDraft();
    render();
    return;
  }
  if (cancelPanelEdit) return;
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

el('show-guide').addEventListener('change', () => {
  state.showGuide = el('show-guide').checked;
  try { localStorage.setItem('seizu.showGuide', state.showGuide ? '1' : '0'); } catch { /* 無視 */ }
  render();
});

// ---- 線種・線の太さ・文字高さ ----
// 選択ツールで図形を選択中は「選択図形の値」を表示・変更し、
// それ以外は「そのツールで次に作る図形の設定」を表示・変更する(ツールの種類ごとに記憶)
const ANNO_TOOLS = ['dim', 'dia', 'rad', 'angle', 'chamfer', 'leader', 'roughness', 'fcf', 'balloon', 'bom'];
function toolPen(tool) {
  if (DRAW_TOOLS.includes(tool)) return { pen: state.pen.shape, width: true, text: false, lineType: true };
  if (tool === 'text') return { pen: state.pen.text, width: false, text: true };
  if (ANNO_TOOLS.includes(tool)) return { pen: state.pen.anno, width: true, text: true };
  if (tool === 'hatch') return { pen: state.pen.anno, width: true, text: false };
  return null; // トリム・原点設定など(新しく作る線は元の図形の太さを引き継ぐ)
}
function editingSelection() {
  return state.tool === 'select' && state.selection.size > 0;
}
function buildStyleOptions() {
  const add = (select, label, value, hidden = false) => {
    const opt = new Option(label, value);
    opt.hidden = hidden;
    select.add(opt);
  };
  for (const select of [el('line-style'), el('line-width'), el('text-size')]) {
    add(select, '—', 'none', true);    // 対象外(無効)のときの表示
    add(select, '混在', 'mixed', true); // 選択図形で値がばらばらのときの表示
  }
  add(el('line-width'), '標準', '');
  for (const mm of WIDTH_CHOICES_MM) add(el('line-width'), `${mm}mm`, String(mm));
  for (const mm of TEXT_CHOICES_MM) add(el('text-size'), `${mm}mm`, String(mm));
}
// info: null=対象なし(無効) / {mixed:true} / {value}(太さの null は標準)
function showStyleValue(select, info) {
  select.disabled = !info;
  let v = 'none';
  if (info) v = info.mixed ? 'mixed' : info.value == null ? '' : String(info.value);
  if (![...select.options].some((o) => o.value === v)) {
    // 選択肢にない値(ファイルを手で編集した場合など)も表示できるよう昇順の位置に足す
    const before = [...select.options].find((o) => Number(o.value) > Number(v));
    select.add(new Option(`${v}mm`, v), before ?? null);
  }
  if (select.value !== v) select.value = v;
}
function syncStyleUI() {
  let lineType = null;
  let width = null;
  let text = null;
  if (editingSelection()) {
    const sel = state.doc.entities.filter((e) => state.selection.has(e.id));
    lineType = commonValue(sel.filter(hasLineType), presetOf);
    // 線種メニューにない組み合わせの図形は「混在」扱い
    if (lineType && !lineType.mixed && lineType.value == null) lineType = { value: null, mixed: true };
    width = commonValue(sel.filter(hasStroke), widthSettingMm);
    text = commonValue(sel.filter(hasText), textHeightMm);
  } else {
    const t = toolPen(state.tool);
    if (t?.lineType) lineType = { value: t.pen.preset, mixed: false };
    if (t?.width) width = { value: t.pen.widthMm, mixed: false };
    if (t?.text) text = { value: t.pen.textMm, mixed: false };
  }
  showStyleValue(el('line-style'), lineType);
  showStyleValue(el('line-width'), width);
  showStyleValue(el('text-size'), text);
}
// 選択図形に線種(kind='lineType')・太さ('width')・文字高さ('text')を適用。対象がなければ false
const STYLE_APPLY = {
  lineType: [hasLineType, applyPreset],
  width: [hasStroke, applyWidth],
  text: [hasText, applyTextHeight],
};
function applyStyleToSelection(kind, value) {
  const [applies, apply] = STYLE_APPLY[kind];
  const targets = state.doc.entities.filter((e) => state.selection.has(e.id) && applies(e));
  if (targets.length === 0) return false;
  commit(() => { for (const e of targets) apply(e, value); });
  return true;
}
const PEN_PROP = { lineType: 'preset', width: 'widthMm', text: 'textMm' };
function changeStyle(kind, select) {
  const raw = select.value;
  select.blur(); // 変更後すぐ Delete・Ctrl+Z などのキー操作が図面に効くように
  if (raw === 'none' || raw === 'mixed') return;
  const value = kind === 'lineType' ? raw : raw === '' ? null : Number(raw);
  if (editingSelection()) {
    if (applyStyleToSelection(kind, value)) return;
  } else {
    const t = toolPen(state.tool);
    if (t?.[kind]) t.pen[PEN_PROP[kind]] = value;
  }
  render();
}
el('line-style').addEventListener('change', (ev) => changeStyle('lineType', ev.target));
el('line-width').addEventListener('change', (ev) => changeStyle('width', ev.target));
el('text-size').addEventListener('change', (ev) => changeStyle('text', ev.target));

// ---- 右クリックメニュー ----
let menuScreen = null; // メニューを開いた位置(書き換え入力の表示位置に使う)
const popup = createPopupMenu(runMenuAction);
function inProgress() {
  return !!(state.draft && state.draft.kind !== 'box') || !!state.filletFirst || !!state.offsetPick;
}
function openCanvasMenu(s, ev) {
  const hit = hitTestScreen(s);
  if (hit && !state.selection.has(hit.id)) {
    state.selection = withGroupMembers(state.doc.entities, [hit.id]);
    state.subSel = null;
  }
  const entities = hit ? state.doc.entities.filter((e) => state.selection.has(e.id)) : [];
  menuScreen = s;
  const drafting = inProgress() ? (state.draft?.kind ?? 'pick') : null;
  popup.open(buildContextMenu({
    entities, hasClipboard: !!state.clipboard?.length, tool: state.tool, drafting,
  }), ev.clientX, ev.clientY);
}
// 図形の種類 → 説明するツール(ヘルプの項目選び)
function toolOfEntity(e) {
  if (e.type === 'dim') return e.dimType === 'linear' ? 'dim' : e.dimType;
  if (e.type === 'ellipse' && e.startAngle != null) return 'earc';
  return e.type;
}
function focusInput(input, message) {
  activateTab('edit');
  input.focus();
  input.select();
  showMessage(message);
}
function runMenuAction(id) {
  const [cmd, arg] = id.split(':');
  const selected = state.doc.entities.filter((e) => state.selection.has(e.id));
  switch (cmd) {
    case 'finishDraft': finishPolyline(); break;
    case 'cancelDraft': cancelInProgress(); break;
    case 'paste': pasteClipboard(); break;
    case 'undo': doUndo(); break;
    case 'redo': doRedo(); break;
    case 'selectAll': selectAll(); break;
    case 'fit': refitView(); render(); break;
    case 'toSelect': setTool('select'); break;
    case 'help': openHelp(selected.length ? helpTopicForTool(toolOfEntity(selected[0])) : null); break;
    case 'copy': copySelection(); break;
    case 'duplicate': duplicateSelection(); break;
    case 'delete': deleteSelection(); break;
    case 'rotateLeft': rotateSelectionBy(90); break;
    case 'rotateRight': rotateSelectionBy(-90); break;
    case 'rotateBy':
      focusInput(el('rotate-angle'), '回転: 角度を入れて Enter（＋で左回り、－で右回り）');
      break;
    case 'scaleBy':
      focusInput(el('scale-factor'), '拡大縮小: 倍率を入れて Enter（2で2倍、0.5で半分）');
      break;
    case 'mirrorX': mirrorSelection('x'); break;
    case 'mirrorY': mirrorSelection('y'); break;
    case 'explode': explodeSelection(); break;
    case 'lineType': applyStyleToSelection('lineType', arg); break;
    case 'width': applyStyleToSelection('width', arg === '' ? null : Number(arg)); break;
    case 'textSize': applyStyleToSelection('text', Number(arg)); break;
    case 'editText':
      if (selected[0] && menuScreen) openValueEditor(selected[0], menuScreen);
      break;
    case 'resetDimText':
      commit(() => {
        for (const e of selected) if (e.type === 'dim') delete e.textShift;
      });
      break;
    default: break;
  }
}

// ---- ヘルプ ----
const help = createHelp();
function openHelp(topicId) {
  popup.close();
  help.open(topicId ?? undefined);
}
el('help-open').addEventListener('click', () => {
  openHelp(state.tool === 'select' ? null : helpTopicForTool(state.tool));
});

// ---- カーソル横の操作ガイド ----
// 作図の段階(何回クリックしたか)
function draftStage() {
  if (state.tool === 'offset') return state.offsetPick ? 1 : 0;
  if (state.tool === 'fillet' || state.tool === 'chamferEdit') return state.filletFirst ? 1 : 0;
  const d = state.draft;
  if (!d || d.kind === 'box') return 0;
  if (d.kind === 'polyline' || d.kind === 'spline') return d.points.length;
  if (d.stage) return d.stage;
  if (d.kind === 'angle') return d.p1 ? 2 : 1;
  return 1;
}
// 作図中・移動中の長さなどの値
function liveValues() {
  const p = state.mouseReal;
  const f = (v) => Math.abs(v).toFixed(2);
  const lenAng = (a) => `長さ ${geo.distance(a, p).toFixed(2)}  角度 ${geo.angleDegOf(a, p).toFixed(1)}°`;
  if (state.dimTextDrag) {
    const e = state.doc.entities.find((en) => en.id === state.dimTextDrag.id);
    const shift = Number(e?.textShift) || 0;
    return shift ? `値の位置: 中央から ${fmtMm(shift)}` : '値の位置: 中央';
  }
  if (state.moveDrag?.snapshotPushed && p) {
    return `移動 X ${(p.x - state.moveDrag.startReal.x).toFixed(2)}  Y ${(p.y - state.moveDrag.startReal.y).toFixed(2)}`;
  }
  const d = state.draft;
  if (!d || !p) return '';
  if (d.kind === 'line') return lenAng(d.start);
  if ((d.kind === 'polyline' || d.kind === 'spline') && d.points.length) return lenAng(d.points[d.points.length - 1]);
  if (d.kind === 'rect') return `幅 ${f(p.x - d.start.x)}  高さ ${f(p.y - d.start.y)}`;
  if (d.kind === 'circle') return `直径 ${(geo.distance(d.center, p) * 2).toFixed(2)}`;
  if (d.kind === 'polygon' && d.fit) {
    return `${d.points.length}角形  ${polygonModeLabel()} ${d.fit.size.toFixed(2)}  角度 ${d.fit.angleDeg.toFixed(1)}°`;
  }
  if (d.kind === 'arc' && d.stage === 1) return `半径 ${geo.distance(d.center, p).toFixed(2)}`;
  if (d.kind === 'arc' && d.stage === 2) {
    let sweep = geo.angleDegOf(d.center, p) - geo.angleDegOf(d.center, d.startPoint);
    while (sweep <= 0) sweep += 360;
    return `角度 ${sweep.toFixed(1)}°`;
  }
  if (d.kind === 'ellipse' || (d.kind === 'earc' && d.stage === 1)) {
    return `横の半径 ${f(p.x - d.center.x)}  縦の半径 ${f(p.y - d.center.y)}`;
  }
  if (d.kind === 'dim' && d.stage === 1) return `長さ ${geo.distance(d.p1, p).toFixed(2)}`;
  if (d.kind === 'dim' && d.stage === 2 && d.orient) {
    return `寸法 ${dimText({ type: 'dim', dimType: 'linear', orient: d.orient, p1: [d.p1.x, d.p1.y], p2: [d.p2.x, d.p2.y] })}`;
  }
  return '';
}
function updateCursorTip() {
  const tip = el('cursor-tip');
  const s = state.mouseScreen;
  const busy = popup.isOpen() || help.isOpen() || textEntry.style.display === 'block' || state.panDrag;
  if (!state.showGuide || !s || busy) {
    tip.hidden = true;
    return;
  }
  let guide = guideFor(state.tool, draftStage());
  if (state.tool === 'polygon' && draftStage() === 1) {
    // 2回目のクリックの場所は、大きさの決め方で変わる
    const mode = POLYGON_SIZE_MODES[state.polygonMode];
    guide = `正多角形: ${mode.target === 'side' ? '辺の真ん中' : '角'}の位置をクリック（数字を打つと${mode.label}を指定）`;
  }
  if (state.tool === 'select') {
    guide = state.dimTextDrag ? '寸法の値を移動中（離すと確定）'
      : state.hoverDimText ? '寸法の値: 押したまま動かすと寸法線に沿って移動' : null;
  }
  const values = liveValues();
  if (!guide && !values) {
    tip.hidden = true;
    return;
  }
  tip.replaceChildren();
  if (guide) tip.append(Object.assign(document.createElement('div'), { textContent: guide }));
  if (values) tip.append(Object.assign(document.createElement('div'), { className: 'values', textContent: values }));
  tip.hidden = false;
  // カーソルの右下に表示。はみ出す場合は左・上へ
  const wrap = el('canvas-wrap');
  const x = s.x + 18 + tip.offsetWidth > wrap.clientWidth - 16 ? s.x - tip.offsetWidth - 12 : s.x + 18;
  const y = s.y + 20 + tip.offsetHeight > wrap.clientHeight - 16 ? s.y - tip.offsetHeight - 12 : s.y + 20;
  tip.style.left = `${Math.max(0, x)}px`;
  tip.style.top = `${Math.max(0, y)}px`;
}

// 作図の途中・2段階の操作を取り消す
function cancelInProgress() {
  state.draft = null;
  state.filletFirst = null;
  state.offsetPick = null;
  render();
}
// Esc: 途中の操作を取り消す → 何もなければ選択ツールへ → 選択ツールなら選択解除
function handleEscape() {
  popup.close();
  closeTextEntry();
  const active = document.activeElement;
  if (active?.closest?.('#numpanel, #ribbon')) {
    // 欄を離れると change で値が反映されるので、Esc の間は反映を止めて元の値に戻す。
    // 欄の入力をやめただけなので、選択の解除までは進めない
    cancelPanelEdit = true;
    active.blur();
    cancelPanelEdit = false;
    lastPanelKey = null;
    render();
    return;
  }
  if (inProgress()) {
    cancelInProgress();
  } else if (state.tool !== 'select') {
    setTool('select');
  } else {
    state.selection.clear();
    state.subSel = null;
    render();
  }
}

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
      if (!layer.visible) {
        // 見えなくなった図形は選択から外す(見えないまま動かしたり消したりしないように)。
        // ただし、ねじ穴などのまとまりは一部が見えていれば、隠れた部分も一緒に選んだままにする
        // (中心線だけ置き去りにして動かすと、形がばらばらになるため)
        const keep = state.doc.entities
          .filter((e) => state.selection.has(e.id) && isEntityVisible(state.doc, e)).map((e) => e.id);
        state.selection = withGroupMembers(state.doc.entities, keep);
        if (state.selection.size === 0) state.subSel = null;
        state.hover = null;
        state.hoverGroup = null;
      }
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

// 図面を入れ替える時に、前の図面に紐づく選択・途中の操作をすべて消す
function resetInteraction() {
  state.selection = new Set();
  state.subSel = null;
  state.draft = null;
  state.hover = null;
  state.hoverGroup = null;
  state.hoverDimText = false;
  state.filletFirst = null;
  state.offsetPick = null;
  state.copyDrag = null;
  state.dimTextDrag = null;
  state.moveDrag = null;
  state.rightPress = null;
  state.snapHint = null;
  state.midGuides = [];
  closeTextEntry();
  popup.close();
  lastPanelKey = null;
}

function loadDocText(text, name) {
  try {
    const doc = deserialize(text);
    state.doc = doc;
    state.history = createHistory(100);
    resetInteraction();
    state.fileName = name;
    state.dirty = false;
    discardBackup();
    syncSettingsUI();
    buildLayerPanel();
    refitView();
    updateTitle();
    render();
  } catch (err) {
    alert(`ファイルを読み込めませんでした: ${err?.message ?? err}`);
  }
}

async function saveFile(saveAs = false) {
  try {
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
  } catch (err) {
    // 黙って失敗すると保存できたと思い込んでしまうので、必ず知らせる
    alert(`保存できませんでした: ${err?.message ?? err}`);
  }
}

el('file-new').addEventListener('click', () => {
  if (!confirmDiscard()) return;
  discardBackup();
  state.fileio.reset();
  state.doc = createDocument();
  state.history = createHistory(100);
  resetInteraction();
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
  try {
    const res = await state.fileio.open();
    if (res) loadDocText(res.text, res.name);
  } catch (err) {
    alert(`ファイルを開けませんでした: ${err?.message ?? err}`);
  }
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
  if (help.isOpen()) {
    if (ev.key === 'Escape') help.close();
    return;
  }
  if (ev.key === 'F1' || (ev.key === '?' && !isTyping(ev))) {
    ev.preventDefault();
    openHelp(state.tool === 'select' ? null : helpTopicForTool(state.tool));
    return;
  }
  if (ev.code === 'Space' && !isTyping(ev)) {
    state.spaceDown = true;
    ev.preventDefault();
    return;
  }
  if (ev.key === 'Escape') {
    handleEscape();
    return;
  }
  if (isTyping(ev)) return;
  const plainKey = !ev.ctrlKey && !ev.altKey && !ev.metaKey;
  // 直線・正多角形を描いている途中に数字を打つと、長さ(大きさ)の欄に入力できる(Enterで確定)
  if (plainKey && (state.draft?.kind === 'line' || state.draft?.kind === 'polygon')
    && /^[0-9.]$/.test(ev.key)) {
    ev.preventDefault();
    const len = el('num-len');
    len.value = ev.key;
    len.focus();
    len.setSelectionRange(len.value.length, len.value.length);
    const what = state.draft.kind === 'line' ? '長さ' : polygonModeLabel();
    showMessage(`${what}を入力して Enter で確定（角度は右の欄）`);
    return;
  }
  // 1文字キーでツールを切り替え
  if (plainKey && toolForKey(ev.key)) {
    ev.preventDefault();
    popup.close();
    setTool(toolForKey(ev.key));
    return;
  }
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
  if (ev.ctrlKey && ev.key.toLowerCase() === 'a') { ev.preventDefault(); selectAll(); }
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
buildStyleOptions();
try {
  activateTab(localStorage.getItem('seizu.tab') || 'draw');
  state.showGuide = localStorage.getItem('seizu.showGuide') !== '0';
} catch { /* 保存領域が使えなければ既定のまま */ }
el('show-guide').checked = state.showGuide;
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
