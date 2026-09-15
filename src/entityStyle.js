// 線の太さ・文字高さ(いずれも用紙mm)。要素ごとに widthMm / textMm で上書きでき、
// 未指定の要素は種類・線種ごとの既定値で描く。
import { LINE_STYLES, STYLE_PRESETS } from './model.js';
import { DIM_TEXT_MM, annoTextMm } from './dims.js';

// UIの選択肢(JIS Z 8114 の線の太さ / JIS Z 8313 の文字高さ の系列)
export const WIDTH_CHOICES_MM = [0.13, 0.18, 0.25, 0.35, 0.5, 0.7, 1, 1.4];
export const TEXT_CHOICES_MM = [1.8, 2.5, 3.5, 5, 7, 10, 14, 20];

// 線が細線固定の注記系 / 文字を持つ注記系
const THIN_ANNOTATIONS = ['dim', 'leader', 'balloon', 'roughness', 'fcf', 'hatch'];
const TEXT_ANNOTATIONS = ['dim', 'leader', 'balloon', 'roughness', 'fcf', 'bom'];

// 線種(外形線・かくれ線など)を変えられるのは線・円などの図形だけ
const LINE_TYPE_SHAPES = ['line', 'polyline', 'spline', 'rect', 'circle', 'arc', 'ellipse'];
export function hasLineType(e) {
  return LINE_TYPE_SHAPES.includes(e.type);
}

// 線種メニューの項目(STYLE_PRESETS のキー)。線種とレイヤーが一致するもの、なければ線種だけで判定
export function presetOf(e) {
  if (!hasLineType(e)) return null;
  const entries = Object.entries(STYLE_PRESETS);
  const exact = entries.find(([, p]) => p.lineType === e.lineType && p.layer === e.layer);
  const byType = entries.find(([, p]) => p.lineType === e.lineType);
  return (exact ?? byType)?.[0] ?? null;
}

// 線種メニューの項目を適用(線種とレイヤーを変える。太さの指定は残す)
export function applyPreset(e, key) {
  const preset = STYLE_PRESETS[key];
  if (!preset || !hasLineType(e)) return false;
  e.lineType = preset.lineType;
  e.layer = preset.layer;
  return true;
}

export function hasStroke(e) {
  return e.type !== 'text';
}

export function hasText(e) {
  return e.type === 'text' || TEXT_ANNOTATIONS.includes(e.type);
}

// 要素に指定された太さ。未指定・不正値は null(=標準)
export function widthSettingMm(e) {
  const n = Number(e.widthMm);
  return n > 0 ? n : null;
}

// 実際に描く太さ(指定がなければ種類・線種ごとの既定値)
export function strokeWidthMm(e) {
  const w = widthSettingMm(e);
  if (w) return w;
  if (e.type === 'bom') return 0.35;
  if (THIN_ANNOTATIONS.includes(e.type)) return 0.25;
  return (LINE_STYLES[e.lineType] ?? LINE_STYLES.solid).widthMm;
}

// 文字を持たない要素は null
export function textHeightMm(e) {
  if (e.type === 'text') return e.height;
  if (TEXT_ANNOTATIONS.includes(e.type)) return annoTextMm(e);
  return null;
}

// mm=null で標準(既定の太さ)に戻す。線を持たない要素は変更せず false
export function applyWidth(e, mm) {
  if (!hasStroke(e)) return false;
  if (mm == null) delete e.widthMm;
  else e.widthMm = mm;
  return true;
}

// 文字を持たない要素は変更せず false(矩形の height は形状なので触らない)
export function applyTextHeight(e, mm) {
  if (e.type === 'text') {
    e.height = mm;
    return true;
  }
  if (!TEXT_ANNOTATIONS.includes(e.type)) return false;
  if (mm === DIM_TEXT_MM) delete e.textMm;
  else e.textMm = mm;
  return true;
}

// 値が揃っていれば {value}、違えば {mixed:true}、要素なしは null
export function commonValue(entities, getter) {
  if (entities.length === 0) return null;
  const first = getter(entities[0]);
  return entities.every((e) => getter(e) === first)
    ? { value: first, mixed: false }
    : { value: null, mixed: true };
}

// トリム・オフセット・分解などで元の図形から引き継ぐ線のスタイル
export function strokeStyleOf(e) {
  const style = { layer: e.layer, lineType: e.lineType };
  const w = widthSettingMm(e);
  if (w) style.widthMm = w;
  return style;
}
