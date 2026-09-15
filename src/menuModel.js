// 右クリックメニューの項目。選択中の図形や作図の状態から、表示する項目を決める。
// 項目: { id, label, key?, disabled?, checked?, children? } / 区切り: { separator: true }
import { STYLE_PRESETS } from './model.js';
import {
  WIDTH_CHOICES_MM, TEXT_CHOICES_MM, hasStroke, hasText, hasLineType,
  presetOf, widthSettingMm, textHeightMm, commonValue,
} from './entityStyle.js';

const SEP = { separator: true };
const EDITABLE_TEXT = ['dim', 'leader', 'text', 'balloon', 'roughness', 'fcf'];

// 選択図形の値が揃っていてその値なら true(チェック表示)
const isCurrent = (common, value) => !!common && !common.mixed && common.value === value;

export function buildContextMenu({
  entities = [], hasClipboard = false, tool = 'select', drafting = null,
}) {
  const items = [];
  if (drafting) {
    if (drafting === 'polyline' || drafting === 'spline') {
      items.push({ id: 'finishDraft', label: '作図を終える', key: 'Enter' });
    }
    items.push({ id: 'cancelDraft', label: '作図をやめる', key: 'Esc' }, SEP);
  }

  if (entities.length === 0) {
    items.push(
      { id: 'paste', label: '貼り付け', key: 'Ctrl+V', disabled: !hasClipboard },
      SEP,
      { id: 'undo', label: '元に戻す', key: 'Ctrl+Z' },
      { id: 'redo', label: 'やり直し', key: 'Ctrl+Y' },
      SEP,
      { id: 'selectAll', label: 'すべて選択', key: 'Ctrl+A' },
      { id: 'fit', label: '用紙全体を表示' },
    );
    if (tool !== 'select') items.push({ id: 'toSelect', label: '選択ツールに戻る', key: 'Esc' });
    items.push(SEP, { id: 'help', label: 'ヘルプを開く', key: 'F1' });
    return items;
  }

  items.push(
    { id: 'copy', label: 'コピー', key: 'Ctrl+C' },
    { id: 'paste', label: '貼り付け', key: 'Ctrl+V', disabled: !hasClipboard },
    { id: 'duplicate', label: '複製（少しずらしてコピー）', key: 'Ctrl+D' },
    { id: 'delete', label: '削除', key: 'Delete' },
    SEP,
    { id: 'rotateLeft', label: '左に90°回転' },
    { id: 'rotateRight', label: '右に90°回転' },
    { id: 'rotateBy', label: '角度を指定して回転…' },
    { id: 'scaleBy', label: '拡大・縮小…' },
    { id: 'mirrorX', label: '左右反転' },
    { id: 'mirrorY', label: '上下反転' },
  );
  if (entities.some((e) => e.type === 'rect' || e.type === 'polyline')) {
    items.push({ id: 'explode', label: '分解（バラバラの直線にする）' });
  }

  const styles = [];
  const withLineType = entities.filter(hasLineType);
  if (withLineType.length > 0) {
    const cur = commonValue(withLineType, presetOf);
    styles.push({
      id: 'lineType', label: '線種',
      children: Object.entries(STYLE_PRESETS).map(([key, p]) => ({
        id: `lineType:${key}`, label: p.label, checked: isCurrent(cur, key),
      })),
    });
  }
  const withStroke = entities.filter(hasStroke);
  if (withStroke.length > 0) {
    const cur = commonValue(withStroke, widthSettingMm);
    styles.push({
      id: 'width', label: '太さ',
      children: [
        { id: 'width:', label: '標準（線種どおり）', checked: isCurrent(cur, null) },
        ...WIDTH_CHOICES_MM.map((mm) => ({ id: `width:${mm}`, label: `${mm}mm`, checked: isCurrent(cur, mm) })),
      ],
    });
  }
  const withText = entities.filter(hasText);
  if (withText.length > 0) {
    const cur = commonValue(withText, textHeightMm);
    styles.push({
      id: 'textSize', label: '文字の大きさ',
      children: TEXT_CHOICES_MM.map((mm) => ({ id: `textSize:${mm}`, label: `${mm}mm`, checked: isCurrent(cur, mm) })),
    });
  }
  if (styles.length > 0) items.push(SEP, ...styles);

  const extra = [];
  if (entities.length === 1 && EDITABLE_TEXT.includes(entities[0].type)) {
    extra.push({ id: 'editText', label: '値・文字を書き換える' });
  }
  if (entities.some((e) => e.type === 'dim' && e.dimType === 'linear' && Number(e.textShift))) {
    extra.push({ id: 'resetDimText', label: '寸法の値を中央に戻す' });
  }
  if (extra.length > 0) items.push(SEP, ...extra);

  items.push(SEP, { id: 'help', label: 'この図形の説明（ヘルプ）', key: 'F1' });
  return items;
}
