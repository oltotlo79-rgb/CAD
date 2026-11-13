// 原点(座標の0の位置)の計算。原点を数値で動かす・初期位置(用紙の枠の左下)に戻すときに使う
import { FRAME_MARGIN_MM } from './papers.js';
import { paperToReal } from './viewTransform.js';

// 計算の誤差(0.1+0.2=0.30000000000000004 など)を消す
const round6 = (v) => Math.round(v * 1e6) / 1e6;

// 用紙の枠の左下の位置(実寸の座標)。縮尺が1:2なら、用紙の上の10mmは実寸の20mm
export function frameCornerReal(doc) {
  const p = paperToReal({ x: FRAME_MARGIN_MM, y: FRAME_MARGIN_MM }, doc.scale);
  return { x: round6(p.x), y: round6(p.y) };
}

// 原点を右へ dx、上へ dy 動かした位置(マイナスなら左・下)
export function movedOrigin(origin, dx, dy) {
  return { x: round6(origin.x + dx), y: round6(origin.y + dy) };
}

// 今の原点が、用紙の枠の左下から右へ・上へどれだけ離れているか(実寸mm)
export function originFromFrame(doc) {
  const c = frameCornerReal(doc);
  return { x: round6(doc.userOrigin.x - c.x) + 0, y: round6(doc.userOrigin.y - c.y) + 0 };
}

// 原点が用紙の枠の左下にあるか
export function isOriginAtFrame(doc) {
  const d = originFromFrame(doc);
  return Math.abs(d.x) < 1e-9 && Math.abs(d.y) < 1e-9;
}
