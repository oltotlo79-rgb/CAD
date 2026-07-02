// 表題欄。図面枠内側の右下に固定配置する。
// 尺度・用紙は図面設定から自動反映(bind)で手入力不可(要件§11)。
import { frameRect } from './papers.js';

export const DEFAULT_TITLE_FIELDS = [
  { label: '図番', value: '' },
  { label: '図名', value: '' },
  { label: '尺度', bind: 'scale' },
  { label: '用紙', bind: 'paper' },
  { label: '材質', value: '' },
  { label: '作成者', value: '' },
  { label: '日付', value: '' },
];

export const TITLE_BLOCK_W = 90;   // 用紙mm
export const TITLE_ROW_H = 8;
export const TITLE_LABEL_W = 25;

export function titleFieldText(doc, field) {
  if (field.bind === 'scale') return `${doc.scale.ratio[0]}:${doc.scale.ratio[1]}`;
  if (field.bind === 'paper') {
    return `${doc.paper.size} ${doc.paper.orientation === 'landscape' ? '横' : '縦'}`;
  }
  return field.value ?? '';
}

// 用紙mm座標でのレイアウト。titleBlockが無効ならnull
export function titleBlockLayout(doc) {
  if (!doc.titleBlock || !Array.isArray(doc.titleBlock.fields)) return null;
  const frame = frameRect(doc.paper.size, doc.paper.orientation);
  const fields = doc.titleBlock.fields;
  const height = TITLE_ROW_H * fields.length;
  const x = frame.x + frame.width - TITLE_BLOCK_W;
  const y = frame.y;
  const rows = fields.map((field, i) => ({
    field,
    text: titleFieldText(doc, field),
    rect: {
      x, y: y + height - (i + 1) * TITLE_ROW_H,
      width: TITLE_BLOCK_W, height: TITLE_ROW_H,
    },
  }));
  return { x, y, width: TITLE_BLOCK_W, height, labelWidth: TITLE_LABEL_W, rows };
}
