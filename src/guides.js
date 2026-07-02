// 投影補助線(第三角法)と45°ミラー線。
// 一時ガイドでありエンティティとしては保存しない(§8a)。
import { entitySnapPoints } from './model.js';
import { round6, distance } from './geometry.js';

// 選択要素のスナップ点から水平/垂直ガイドの座標を集める
// 戻り値: { xs: [x,...], ys: [y,...] }(重複除去済み)
export function projectionGuides(entities) {
  const xs = new Set();
  const ys = new Set();
  for (const e of entities) {
    for (const p of entitySnapPoints(e)) {
      xs.add(round6(p.x));
      ys.add(round6(p.y));
    }
  }
  return { xs: [...xs].sort((a, b) => a - b), ys: [...ys].sort((a, b) => a - b) };
}

// ガイドへのスナップ候補。
// - ガイド上の垂線の足(自由位置合わせ)
// - ガイド同士の交点
// - 45°ミラー線(傾き+1、mirror点を通る)との交点
export function guideSnapCandidates(guides, mirror45, p, tolMm) {
  const out = [];
  const push = (x, y, kind) => {
    const cand = { x: round6(x), y: round6(y), kind };
    if (distance(p, cand) <= tolMm) out.push(cand);
  };
  const c = mirror45 ? mirror45.y - mirror45.x : null; // y = x + c

  for (const gx of guides.xs) {
    if (Math.abs(p.x - gx) <= tolMm) push(gx, p.y, 'guide');
    if (c !== null) push(gx, gx + c, 'guide-45');
    for (const gy of guides.ys) push(gx, gy, 'guide-x');
  }
  for (const gy of guides.ys) {
    if (Math.abs(p.y - gy) <= tolMm) push(p.x, gy, 'guide');
    if (c !== null) push(gy - c, gy, 'guide-45');
  }
  return out;
}
