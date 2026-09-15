// ツールの名前・ショートカットキー・説明・操作の案内。
// ボタンのツールチップ、カーソル横の操作ガイド、キー操作で共用する(専門用語はなるべく避ける)
import { boundaryFromEntity } from './hatch.js';

// key: 1文字ならそのキーでツールを選べる。steps: 作図の段階ごとの案内
export const TOOL_INFO = {
  select: {
    label: '選択', key: 'Esc',
    tip: '図形をクリックして選ぶ。押したまま動かすと移動、空いた所から囲むとまとめて選択',
    steps: [],
  },
  line: {
    label: '直線', key: 'L', tip: '2か所をクリックしてまっすぐな線を引く',
    steps: ['始点をクリック', '終点をクリック（数字を打つと長さを指定）'],
  },
  polyline: {
    label: '連続線', key: 'P', tip: 'クリックした点を順につなぐ。Enterかダブルクリックで終わり',
    steps: ['始点をクリック', '次の点をクリック（Enter・ダブルクリックで終わり）'],
  },
  rect: {
    label: '矩形', key: 'R', tip: '四角形を描く。向かい合う2つの角をクリック',
    steps: ['1つ目の角をクリック', '反対側の角をクリック'],
  },
  circle: {
    label: '円', key: 'C', tip: '中心と、円周の位置をクリック',
    steps: ['中心をクリック', '円周の位置をクリック'],
  },
  arc: {
    label: '円弧', key: 'A', tip: '円の一部を描く。中心→始まり→終わりの順にクリック（左回り）',
    steps: ['中心をクリック', '弧の始まりをクリック', '弧の終わりをクリック（左回りに描きます）'],
  },
  ellipse: {
    label: '楕円', key: 'E', tip: '中心と、外枠の角をクリック',
    steps: ['中心をクリック', '外枠の角をクリック'],
  },
  earc: {
    label: '楕円弧', key: '', tip: '楕円の一部を描く。中心→外枠の角→始まり→終わりの順にクリック',
    steps: ['中心をクリック', '外枠の角をクリック', '弧の始まりをクリック', '弧の終わりをクリック（左回り）'],
  },
  spline: {
    label: 'スプライン', key: 'S', tip: 'クリックした点を通るなめらかな曲線。Enterかダブルクリックで終わり',
    steps: ['始点をクリック', '通る点をクリック（Enter・ダブルクリックで終わり）'],
  },
  text: {
    label: '文字', key: 'T', tip: '置く場所をクリックして文字を入力し、Enter',
    steps: ['文字を置く場所をクリック'],
  },
  thread: {
    label: 'ねじ穴', key: '', tip: 'サイズを選んで穴の中心をクリック。下穴・ねじ山・中心線をまとめて描く',
    steps: ['穴の中心をクリック（サイズはボタンの右で選択）'],
  },
  dim: {
    label: '寸法', key: 'D', tip: '2点間の長さを記入する。測る2点→寸法線の位置の順にクリック',
    steps: ['測る1点目をクリック', '測る2点目をクリック', '寸法線を置く位置をクリック（Shiftを押しながらで斜めに測る）'],
  },
  dia: {
    label: 'φ（直径）', key: '', tip: '円をクリックして直径を記入する',
    steps: ['円をクリック（クリックした向きに記入）'],
  },
  rad: {
    label: 'R（半径）', key: '', tip: '円か円弧をクリックして半径を記入する',
    steps: ['円か円弧をクリック（クリックした向きに記入）'],
  },
  angle: {
    label: '角度', key: '', tip: '角の頂点→1本目の辺→2本目の辺の順にクリックして角度を記入する',
    steps: ['角の頂点をクリック', '1本目の辺の上をクリック', '2本目の辺の上をクリック（ここまでの距離が弧の大きさ）'],
  },
  chamfer: {
    label: 'C（面取りの寸法）', key: '', tip: '45°に切った角の線をクリックして「C5」のように記入する',
    steps: ['斜めに切った角の線をクリック', '文字を置く位置をクリック'],
  },
  leader: {
    label: '引出線', key: '', tip: '矢印で場所を指してメモを書く。指す場所→文字の位置の順にクリック',
    steps: ['指し示す場所をクリック', '文字を置く位置をクリック'],
  },
  roughness: {
    label: '粗さ', key: '', tip: '表面の仕上がり(ざらつき)の記号を置く。ダブルクリックで値を変更',
    steps: ['記号を置く場所をクリック'],
  },
  fcf: {
    label: '公差枠', key: '', tip: '形のくるいの許される量を書く枠を置く。ダブルクリックで中身を変更',
    steps: ['枠を置く場所をクリック'],
  },
  hatch: {
    label: 'ハッチ', key: 'H', tip: '切り口を表す斜線を入れる。閉じた図形の線をクリック',
    steps: ['斜線を入れる閉じた図形の線をクリック'],
  },
  balloon: {
    label: 'バルーン', key: 'B', tip: '部品番号の丸を付ける。部品の場所→丸の位置の順にクリック',
    steps: ['部品の場所をクリック', '丸を置く位置をクリック'],
  },
  bom: {
    label: '部品表', key: '', tip: '部品の一覧表を置く（表の左下をクリック）。マスはダブルクリックで記入',
    steps: ['表の左下にする位置をクリック'],
  },
  trim: {
    label: 'トリム', key: 'X', tip: '線の一部を切り取る。消したい部分の直線をクリック',
    steps: ['消したい部分の直線をクリック'],
  },
  extend: {
    label: '延長', key: '', tip: '直線を先にある図形まで伸ばす。伸ばしたい端の近くをクリック',
    steps: ['伸ばしたい側の端の近くをクリック'],
  },
  offset: {
    label: 'オフセット', key: 'O', tip: '決めた距離だけ離れた平行なコピーを作る',
    steps: ['コピーする線・円・四角をクリック', 'コピーを置く側をクリック'],
  },
  fillet: {
    label: 'フィレット', key: 'F', tip: '2本の直線の角を丸くする',
    steps: ['丸める角の1本目の直線をクリック', '2本目の直線をクリック'],
  },
  chamferEdit: {
    label: '面取り', key: '', tip: '2本の直線の角を45°に切り落とす',
    steps: ['切り落とす角の1本目の直線をクリック', '2本目の直線をクリック'],
  },
  mirror45: {
    label: '45°線配置', key: '', tip: '上から見た図と横から見た図の奥行きをそろえるための45°の線を置く',
    steps: ['45°線を通す位置をクリック'],
  },
  origin: {
    label: '原点設定', key: '', tip: '座標の0の位置を決め直す（図形は動きません）',
    steps: ['新しく 0,0 にする位置をクリック'],
  },
};

// 1文字キー → ツール(大文字小文字を区別しない)
export function toolForKey(key) {
  if (typeof key !== 'string' || key.length !== 1) return null;
  const upper = key.toUpperCase();
  const hit = Object.entries(TOOL_INFO).find(([, info]) => info.key === upper);
  return hit ? hit[0] : null;
}

export function tooltipText(tool) {
  const info = TOOL_INFO[tool];
  if (!info) return '';
  return `${info.label}${info.key ? ` (${info.key})` : ''}\n${info.tip}`;
}

// 作図の段階(0始まり)に応じた案内。段階が進みすぎたら最後の案内
export function guideFor(tool, stage) {
  const steps = TOOL_INFO[tool]?.steps;
  if (!steps?.length) return null;
  return `${TOOL_INFO[tool].label}: ${steps[Math.min(stage, steps.length - 1)]}`;
}

// そのツールでクリックして使える図形か(マウスを乗せた時の強調表示に使う)
const isLine = (e) => e.type === 'line';
const isRound = (e) => e.type === 'circle' || e.type === 'arc';
const PICKABLE = {
  select: () => true,
  trim: isLine,
  extend: isLine,
  fillet: isLine,
  chamferEdit: isLine,
  chamfer: isLine,
  offset: (e) => ['line', 'circle', 'arc', 'rect'].includes(e.type),
  dia: isRound,
  rad: isRound,
  hatch: (e) => boundaryFromEntity(e) != null,
};
export function toolAccepts(tool, e) {
  return PICKABLE[tool]?.(e) ?? false;
}
