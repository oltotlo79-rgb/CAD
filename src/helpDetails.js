import { HELP_SCREENSHOTS } from './helpScreenshots.js';

// 手順・結果・困った場合を全項目で用意し、実画面の図と結び付ける。
export const HELP_DETAILS = {
  intro: {
    path: '起動直後の画面。右上の「？ ヘルプ」からいつでも確認できます。',
    shots: ['overview', 'tab-draw', 'tab-annotate', 'tab-edit', 'tab-view', 'tab-file'],
    example: '上段で「作図」を押すと直線や円、「寸法・記号」を押すと寸法や部品表のボタンが現れます。選択と線種・太さ・文字は共通の操作です。',
    result: '青いタブが現在のタブ、青い作図ボタンが現在の道具です。幅の狭い画面ではボタンが次の行に回ることがあります。',
    trouble: 'ボタンが見つからないときは、まず上段のタブを確認します。用紙を見失ったら右上の「全体」を押します。',
  },
  mouse: {
    path: '用紙の上で操作します。図形を選ぶときは左端の「選択」を押します。',
    shots: ['selection', 'selection-box', 'menu-shape', 'move-after'],
    example: '輪郭を左クリックすると選択、輪郭を左ボタンでドラッグすると移動、輪郭を右クリックするとメニューになります。',
    result: '選択は青い輪郭、範囲選択の途中は青い破線の枠で分かります。文字や寸法のダブルクリックでは白い入力欄が開きます。',
    trouble: '図形の内部をクリックして選べないときは、輪郭の線を狙います。画面全体を動かすときはSpaceを押しながら左ドラッグします。',
  },
  tutorial: {
    path: '表示・設定 → 作図 → 寸法・記号 → ファイルの順に進めます。',
    shots: ['paper-controls', 'rect-draft', 'numeric-rect', 'dimension-draft', 'dimension-result', 'file-controls', 'print-result'],
    example: '練習では幅100mm・高さ50mmの矩形を描きます。矩形を選択して幅と高さを決め、下辺の両端に長さ寸法を付けます。',
    result: '矩形の数値欄に幅100.00・高さ50.00、下辺の寸法に100と出ればできあがりです。保存する図面ファイルは.jsonです。',
    trouble: '寸法の数字が100にならないときは、点スナップをオンにして両端の角を選び直します。図形を直したあとには寸法も入れ直してください。',
  },
  guideHelp: {
    path: '表示・設定 → 操作ガイド／右上「？ ヘルプ」またはF1。',
    shots: ['line-draft', 'diameter-pick', 'help-search'],
    example: '直線で始点をクリックすると「終点をクリック」と長さ・角度が出ます。ヘルプで「円 描く」のように空白区切りで検索すると、両方の言葉を含む説明を探せます。',
    result: '操作ガイドは黒い箱、使える図形にマウスを置いたときの強調は水色です。ヘルプの左側には検索に該当する説明だけが並びます。',
    trouble: 'ガイドが出ないときは「表示・設定」の「操作ガイド」をオンにします。ヘルプは「閉じる」かEscで閉じ、図を開いている間のEscはまず拡大図を閉じます。',
  },
  view: {
    path: '右上「＋」「－」「全体」／用紙の右端・下端のスクロールバー。',
    shots: ['view-controls', 'view-fit', 'view-zoom'],
    example: '細部を見たい場所にマウスを置き、Shiftを押しながらホイールを手前・奥へ回します。全体を見直すには「全体」を押します。',
    result: '画面下の「表示 ○px/mm」が変わります。矩形の幅や寸法の100など、図形の実寸の数字は変わりません。',
    trouble: 'ホイールで上下に動くだけのときは、ShiftまたはCtrlを押したまま回します。図面の一部しか見えないときは「全体」で戻せます。',
  },
  line: {
    path: '作図 → 直線、またはL。', shots: ['line-draft', 'line-result', 'numeric-draw', 'numeric-result'],
    example: 'マウスでは始点①と終点②の2回クリックで描きます。数字で描くなら始点X=40・Y=30・長さ=80・角度=30を入れて「作図」を押します。',
    result: '描きかけの緑の破線が、確定すると黒い線になります。数値の例では原点から右40mm・上30mmの位置から、長さ80mmの線が左回り30°で伸びます。',
    trouble: '始点と終点が同じ場所だと線はできません。数字を打つ前に始点をクリックします。Enterで確定した後も直線の道具は選ばれたままなので、Escで選択に戻れます。',
  },
  polyline: {
    path: '作図 → 連続線、またはP。', shots: ['polyline-draft', 'polyline-result'],
    example: '①→②→③→④と曲がり角をクリックし、最後にEnterを押します。最後の点でダブルクリックしても終えられます。',
    result: '4点を結んだ3本の線が、1つの連続線として確定します。点は2つ以上必要です。',
    trouble: 'Escは確定する操作ではなく、描きかけを中止する操作です。個別の線を切る・角を丸める場合は、確定後に「分解」を使ってください。',
  },
  rect: {
    path: '作図 → 矩形、またはR。', shots: ['rect-draft', 'rect-result', 'numeric-rect'],
    example: '①左下の角→②右上の角のように、向かい合う角をクリックします。正確な大きさは完成後に選択し、幅100・高さ50を入力してEnterで合わせます。',
    result: '確定した四角は4辺で1つの図形です。数値欄には左下X・Y、幅、高さ、回転が出ます。',
    trouble: '2つの角が同じ縦線上・横線上にあると幅か高さが0になり作図できません。トリム・フィレット・面取りを使う前は「分解」を押します。',
  },
  circle: {
    path: '作図 → 円、またはC。', shots: ['circle-draft', 'circle-result', 'numeric-circle'],
    example: '中心①をクリックし、25mm離れた円周②をクリックすると半径25mmの円になります。数値編集で同じ大きさを指定するときは「直径」に50を入れます。',
    result: '円を1つ選ぶと、中心X・Yと直径が表示されます。半径と直径は2倍の違いがあります。',
    trouble: '中心と同じ位置で2回目をクリックしても円はできません。中心位置と大きさを直すにはEscで選択に戻り、円周をクリックします。',
  },
  arc: {
    path: '作図 → 円弧、またはA。', shots: ['arc-draft', 'arc-result'],
    example: '①中心→②右側の開始点→③上側の終了点の順にクリックします。この例は開始0°・終了90°の円弧です。',
    result: '半径は①から②までの距離で決まり、③は終了する向きを指定します。②から③へ左回りに弧を描きます。',
    trouble: 'ほしい弧と逆側に大きく回ったときは、開始点と終了点の順序を確かめます。半径や角度は完成した円弧を選択して数値で直せます。',
  },
  ellipse: {
    path: '作図 → 楕円（E）または楕円弧。', shots: ['ellipse-draft', 'ellipse-result', 'earc-draft', 'earc-result'],
    example: '楕円は①中心→②外枠の角。楕円弧は①中心→②外枠の角→③開始→④終了です。横半径45mm・縦半径25mmなら全体の幅90mm・高さ50mmになります。',
    result: '楕円弧も左回りに描かれます。完成した楕円・楕円弧を選ぶと半径X・半径Y・回転、楕円弧では開始角・終了角も編集できます。',
    trouble: '外枠の角を中心と同じ水平線・垂直線に置くと片方の半径が0になります。楕円弧の開始点を選ぶ前に、外枠の角を決めてください。',
  },
  spline: {
    path: '作図 → スプライン、またはS。', shots: ['spline-draft', 'spline-result'],
    example: '曲線を通したい①→②→③→④をクリックして、Enterで終えます。最初と最後の点が曲線の両端になります。',
    result: 'クリックした点を通るなめらかな曲線になります。確定には3つ以上の点が必要です。',
    trouble: '点が2つ以下だと確定しても曲線は作られません。途中でEscを押すと全体を中止します。トリムや分解の対象にはできません。',
  },
  text: {
    path: '作図 → 文字、またはT。', shots: ['text-entry', 'text-result'],
    example: '用紙上の①をクリックし、白い入力欄に「取付板」と打ってEnterを押します。',
    result: '入力欄が閉じて文字が図面に残ります。文字の高さは右端の「文字」で用紙上のmmとして指定します。',
    trouble: '入力をやめるときはEscです。内容を直すには「選択」に戻って文字をダブルクリックします。位置・回転は文字を1つ選んで下の数値欄から変更できます。',
  },
  thread: {
    path: '作図 → ねじ穴。右隣でM3～M12を選びます。', shots: ['thread-control', 'thread-result'],
    example: '右隣の呼びをM6にして中心①を1回クリックします。実画面の図は細部を確認できるよう大きく表示しています。',
    result: '下穴の円、ねじを示す3/4円弧、縦と横の中心線の計4図形が一度にできます。',
    trouble: '描いた後で呼びを変えても、既存の穴は変わりません。Ctrl+Zで取り消して呼びを選び直し、もう一度配置します。移動は4図形をまとめて選びます。',
  },
  select: {
    path: '左端の選択、またはEscで作図の道具から戻ります。', shots: ['selection', 'selection-multiple', 'selection-box'],
    example: '矩形の輪郭①をクリックし、Shiftを押しながら円周もクリックすると2図形をまとめて選べます。空白からドラッグする方法でもまとめて選べます。',
    result: '青い図形が選択対象です。範囲選択では破線の枠に全体が収まった図形が選ばれます。',
    trouble: '円や四角の中が空いている所をクリックしても選択されません。輪郭の上を狙ってください。数値編集は1図形だけを選んだときに使えます。',
  },
  move: {
    path: '選択 → 図形の輪郭を左ボタンでドラッグ。', shots: ['selection', 'move-after'],
    example: '矩形の輪郭を押し、右上へ25mm移動して離すと、元の矩形の位置が右上へ移ります。複数選択ならその全体が動きます。',
    result: 'コピーを増やさず、選んだ図形の位置が変わります。数値欄で位置X・Yも確認できます。',
    trouble: '別の形を押すと選択対象が切り替わります。細かな距離を確実に指定したい場合は図形を1つ選び、下の位置X・Yを書き換えます。',
  },
  copyPaste: {
    path: '選択 → Ctrl+C／Ctrl+V、Ctrl+D、または右ドラッグ。', shots: ['paste-after', 'copy-drag'],
    example: '図形を選びCtrl+Cを押し、貼り付け先へマウスを移動してCtrl+Vを押します。右ドラッグでは緑の破線枠が行き先です。',
    result: '元の図形を残したまま同じ形が増えます。貼り付けでは選択範囲の中心がマウス位置に合い、複製では右上へ10mmずれます。',
    trouble: '文字や数値の入力欄にカーソルがあると、Ctrl+Cは文字のコピーになります。図面上で図形を選択してから操作します。右ドラッグは作図中ではなく選択の道具で行います。',
  },
  contextMenu: {
    path: '用紙上で右ボタンを押し、動かさずに離します。', shots: ['menu-shape', 'menu-empty'],
    example: '矩形の輪郭を右クリックすると、その図形を選んだ上で回転・反転・分解などが出ます。何もない場所では全体表示やすべて選択が出ます。',
    result: '対象の種類と操作途中かどうかで項目が変わります。薄い灰色の項目は現在使えません。「線種」などの矢印付き項目には子メニューがあります。',
    trouble: '押したまま動かすと右ドラッグの複製になります。メニューを閉じるにはEscか、メニュー外をクリックします。',
  },
  numericInput: {
    path: '作図 → 直線 → 画面下の「数値入力」。', shots: ['numeric-draw', 'numeric-result', 'key-length'],
    example: '始点X=40・Y=30・長さ=80・角度=30を入力して「作図」を押します。マウスで始点を決めてから80と打ち、Enterで確定する方法もあります。',
    result: 'X・Yは現在の原点からの実寸mm、長さも実寸mmです。右向き0°、上向き90°、左向き180°、下向き270°です。',
    trouble: '全角数字や単位文字を混ぜず、半角の数値を入れます。この作図欄は直線用です。円・矩形などの寸法は、作図してから1つ選び、対応する数値編集欄で直します。',
  },
  numericEdit: {
    path: '選択 → 編集したい図形を1つだけクリック → 下の数値欄。', shots: ['numeric-line', 'numeric-line-result', 'numeric-rect', 'numeric-circle', 'segment-selection', 'numeric-segment'],
    example: '直線の長さを80へ変更してEnterを押すと、始点を保ったまま終点が変わります。矩形は幅・高さ、円は直径を変えて同じように確定します。',
    result: '欄の左の題名が図形の種類、右のボタンが「更新」になります。連続線をもう一度クリックすると線分番号が出て、オレンジ色の線分だけを編集できます。',
    trouble: '複数選択や寸法・記号の選択では形状用の数値欄になりません。図形を1つだけ選びます。半径や幅・高さには正の数を入れてください。',
  },
  deleteUndo: {
    path: '選択 → Delete／右上「元に戻す」「やり直し」。', shots: ['delete-result', 'undo-result', 'undo-controls'],
    example: '矩形を選んでDeleteで削除し、Ctrl+Zで戻します。戻した削除をもう一度行うにはCtrl+Yです。',
    result: '選択した図形だけが消えます。元に戻す操作は図形や文字の編集履歴を1段階ずつ戻します。',
    trouble: '文字入力中のDeleteやCtrl+Zは入力欄の操作になるので、図面に戻ってから押します。元に戻した後で別の編集をすると、それ以前のやり直しはできなくなります。',
  },
  rotate: {
    path: '選択 → 編集 → 回転の右の角度欄 → 回転。', shots: ['rotate-control', 'rotate-before', 'rotate-after'],
    example: '角度に30を入れて「回転」を押すと、選んだ矩形を左回り30°回します。-30なら右回りです。',
    result: '選択範囲の中心を基準に、図形の向きと位置が変わります。複数選択なら全体を一緒に回します。',
    trouble: '対象を選択してから操作します。矩形の下の「回転」欄は左下を基準とする形状編集なので、このボタンによる全体中心の回転とは基準が違います。',
  },
  scale: {
    path: '選択 → 編集 → 拡大縮小の右の倍率欄 → 拡大縮小。', shots: ['scale-control', 'scale-before', 'scale-after'],
    example: '倍率2なら幅100mmが200mm、高さ50mmが100mmになります。0.5ならそれぞれ半分です。',
    result: '選択範囲の中心を基準に実際の形の大きさが変わります。図を紙に小さく載せたいだけなら「表示・設定」の縮尺を使います。',
    trouble: '倍率には0より大きい半角数値を入れます。文字の高さや線の太さを変えたいときは、右端の「文字」「太さ」を使います。',
  },
  mirror: {
    path: '選択 → 編集 → 左右反転／上下反転。', shots: ['mirror-control', 'mirror-before', 'mirror-after'],
    example: '左右が違う形を選んで「左右反転」を押すと、選択範囲の真ん中を境に左右が入れ替わります。',
    result: '左右反転は横方向、上下反転は縦方向の鏡写しになります。複数の図形はまとめて反転します。',
    trouble: '対称な矩形や円だけでは変化を見分けにくいことがあります。元の形も残したい場合は、先にCtrl+Dで複製してから反転します。',
  },
  explode: {
    path: '選択 → 矩形または連続線 → 編集 → 分解。', shots: ['explode-before', 'explode-after'],
    example: '矩形1つを分解すると4本の直線になります。分解後に下辺だけをクリックすれば、その線だけを選べます。',
    result: '見た目は同じでも、1辺ずつ別の図形になります。状態表示の要素数も変わります。',
    trouble: '円・円弧・楕円・スプラインはこの分解の対象ではありません。元のまとまりに戻す専用操作はないので、直後ならCtrl+Zを使います。',
  },
  trim: {
    path: '編集 → トリム、またはX。対象は直線です。', shots: ['trim-before', 'trim-after'],
    example: '横線と縦線が交わる例では、縦線の右側にある余分な区間①をクリックします。縦線を境に右の部分が消えます。',
    result: '交点で区切られた、クリックした区間だけを切り取ります。中央区間を消した場合は残りが2本の直線になります。',
    trouble: '矩形・連続線は先に分解します。境目となるほかの図形との交点がない直線は切れません。消し過ぎたらCtrl+Zで戻せます。',
  },
  extend: {
    path: '編集 → 延長。対象は直線です。', shots: ['extend-before', 'extend-after'],
    example: '右端が縦線に届いていない横線で、右端に近い所①をクリックします。横線が右へ伸びて縦線に届きます。',
    result: 'クリックした位置に近い端が、その先の最も近い交点まで伸びます。',
    trouble: '反対側へ伸びるときは、伸ばしたい側の端を狙ってください。その方向にぶつかる図形がなければ伸びません。矩形・連続線は先に分解します。',
  },
  offset: {
    path: '編集 → オフセット、またはO。右隣の「距離」を指定。', shots: ['offset-control', 'offset-pick', 'offset-after'],
    example: '距離10を入れ、元の線①→上側②の順にクリックすると、10mm上へ平行なコピーができます。',
    result: '元の図形を残して新しい図形が1つできます。直線・円・円弧・矩形が対象で、回転した矩形にも使えます。',
    trouble: '距離は正の値を入れます。内側への距離が半径や矩形の大きさに対して大きすぎる場合は作れません。連続線・楕円・スプラインは対象外です。',
  },
  fillet: {
    path: '編集 → フィレット、またはF → サイズ。対象は2本の直線です。', shots: ['fillet-control', 'fillet-before', 'fillet-after'],
    example: 'サイズ10を入れ、水平な線①→縦の線②をクリックすると、半径10mmの丸みが入ります。',
    result: '2本の直線を丸みに接する所まで調整し、間に円弧を追加します。クリックした側の線が残ります。',
    trouble: '平行な2本では丸みを作れません。矩形や連続線は先に分解してください。残したい側の線をクリックし、意図と違うときはCtrl+Zで戻してやり直します。',
  },
  chamfer: {
    path: '編集 → 面取り → サイズ。対象は2本の直線です。', shots: ['chamfer-control', 'chamfer-before', 'chamfer-after'],
    example: '直角の2本の線にサイズ10を指定すると、角から各辺10mmの位置を結ぶ45°の面取りができます。',
    result: '2本の直線を短く調整し、間に斜めの直線を追加します。Cの寸法記号を入れる操作は「寸法・記号」タブにあります。',
    trouble: '平行な直線どうしには使えません。元の2辺が直角のときに45°の面取りになります。矩形・連続線は先に分解してから使います。',
  },
  dimLinear: {
    path: '寸法・記号 → 寸法、またはD。', shots: ['dimension-draft', 'dimension-result', 'dimension-aligned'],
    example: '①左下の角→②右下の角→③寸法線の位置の順にクリックすると横幅100mmの寸法になります。斜めの2点を測るときは③でShiftを押すと平行寸法です。',
    result: '2点が水平なら横寸法、垂直なら縦寸法です。斜めの2点は③の位置で横・縦を選び、Shiftで斜めの実長を選びます。',
    trouble: '同じ点を2回クリックすると次の段階へ進みません。点スナップで角を確かめます。寸法は元の図形と自動連動しないので、大きさを直したら寸法を入れ直します。',
  },
  dimValueMove: {
    path: '選択 → 長さ寸法の数字そのものをドラッグ。', shots: ['dimension-text-before', 'dimension-text-after', 'dimension-text-menu'],
    example: '100の数字を押したまま右へ移動し、右の寸法補助線の外まで出します。',
    result: '寸法線が数字の下まで延びて、矢印が外から内向きになります。中央付近に戻すと中央へ吸着します。',
    trouble: '線の部分を押すと寸法全体が動きます。数字の上で押してください。この移動は長さ寸法用です。右クリックの「寸法の値を中央に戻す」でも元に戻せます。',
  },
  dimDiaRad: {
    path: '寸法・記号 → φ（直径）／R（半径）。', shots: ['diameter-pick', 'diameter-result', 'radius-pick', 'radius-result'],
    example: '半径25mmの円でφを選んで円周①をクリックするとφ50、Rで同じ円周をクリックするとR25になります。',
    result: 'クリックした円周の方向に寸法が付きます。対象は円・円弧で、楕円は対象外です。',
    trouble: '円の中心や空白ではなく、円周の線をクリックします。記入方向を変えたいときは、取り消して円周の別の方向をクリックし直してください。',
  },
  dimAngle: {
    path: '寸法・記号 → 角度。', shots: ['angle-draft', 'angle-result'],
    example: '①頂点→②右の辺→③左上の辺の順にクリックして45°の寸法を入れます。③を頂点から遠くすれば弧も大きくなります。',
    result: '①から②への向きを出発点に、①から③への向きまで左回りに測った角度が表示されます。',
    trouble: '45°のつもりが315°になる場合は、②と③の順を入れ替えます。頂点と同じ点を②・③にすると向きが決まらないので、辺上の離れた点を選びます。',
  },
  dimChamfer: {
    path: '寸法・記号 → C。形を切る操作は編集 → 面取りです。', shots: ['chamfer-dimension-draft', 'chamfer-dimension-result'],
    example: '①45°で切り落とした斜めの直線→②文字の置き場所の順にクリックするとC10と入ります。',
    result: '斜めの線の横・縦の変位の大きい方を数値として記入します。C寸法は等しい切り落とし長さの45°面取りに使います。',
    trouble: 'アプリは45°かどうかを自動判定しません。45°以外の斜めの線には通常の長さ寸法・角度寸法を使い、Cとして誤って指示しないようにします。対象は独立した直線です。',
  },
  dimEdit: {
    path: '選択 → 寸法の数字をダブルクリック。', shots: ['dimension-edit', 'dimension-edit-result'],
    example: '100の数字をダブルクリックして100±0.1と打ち、Enterを押すと公差付きの文字になります。',
    result: '寸法の表示だけが変わり、矩形や円の実際の大きさは変わりません。入力を空にして確定すると、自動計算の値に戻ります。',
    trouble: '公差は半角数値だけでなく±などを含む文字として入力できます。図形の実寸を変えたいときは、図形そのものを選び数値編集を使います。',
  },
  leader: {
    path: '寸法・記号 → 引出線。', shots: ['leader-entry', 'leader-result'],
    example: '①円周の指す位置→②文字の場所をクリックし、白い入力欄に「φ50 穴」と打ってEnterで確定します。',
    result: '①に矢印、②に折れ点と文字が付きます。内容を直すには選択ツールで文字をダブルクリックします。',
    trouble: '2回目のクリックの後は、入力欄で文字を打ってEnterを押すまで確定しません。文字がほかの図形に重なる場合は、取り消して置き場所を離します。',
  },
  roughness: {
    path: '寸法・記号 → 粗さ → 配置／選択でダブルクリック。', shots: ['roughness-edit', 'roughness-result'],
    example: '面の線の上に記号を置き、選択に戻ってダブルクリックし、Ra 1.6と入力します。',
    result: '初期値Ra 6.3が入力した文字へ変わります。記号と文字の大きさは「文字」の設定に合わせて変わります。',
    trouble: '数字だけでなく「Ra 1.6」のように表示したい内容全体を入力します。記号は図形へ自動で取り付けられるわけではなく、クリックした位置に置かれます。',
  },
  fcf: {
    path: '寸法・記号 → 公差枠 → 配置／選択でダブルクリック。', shots: ['fcf-edit', 'fcf-result'],
    example: '枠を置いた後にダブルクリックして//|0.02|Aと入力すると、//・0.02・Aの3マスになります。',
    result: '半角の縦棒|で区切られた内容が、それぞれ枠の1マスに表示されます。',
    trouble: '縦棒を全角の｜にすると区切りにはなりません。日本語キーボードならShift+￥で半角の|を入れます。Enterで確定、Escで入力を中止できます。',
  },
  hatch: {
    path: '寸法・記号 → ハッチ、またはH → 角度・間隔。', shots: ['hatch-control', 'hatch-before', 'hatch-after'],
    example: '角度45・間隔3を指定し、矩形の輪郭①をクリックすると内部に斜線が入ります。間隔は紙の上のmmです。',
    result: '斜線は境界となる形の中に納まり、元の輪郭を残して別のハッチ図形が追加されます。',
    trouble: '対象は矩形・円・楕円・closed指定の連続線です。通常の連続線ツールは開いた連続線を作るため、矩形や円を使うのが確実です。輪郭を後から変えてもハッチは自動追従しません。',
  },
  balloon: {
    path: '寸法・記号 → バルーン、またはB。', shots: ['balloon-draft', 'balloon-result'],
    example: '①部品を指す場所→②丸の位置の2回クリックで作れます。同じ操作を繰り返すと次の番号になります。',
    result: '既存のバルーン番号の最大値に1を足した番号が入ります。番号は選択ツールで丸をダブルクリックして変更できます。',
    trouble: '丸は2回目のクリックまで確定しません。部品表を作る前に番号をそろえてください。番号を後から変えても既存の部品表は自動更新されません。',
  },
  bom: {
    path: '寸法・記号 → 部品表 → 表の左下をクリック。', shots: ['bom-created', 'bom-edit', 'bom-result'],
    example: 'バルーン1・2を配置してから表の左下①をクリックします。品名のマスをダブルクリックして取付板と入力し、数量・材質も同じ方法で記入します。',
    result: '品番・品名・数量・材質の4列の表になります。配置後は自動で選択の道具に戻ります。バルーンがなければ初期の3行を作ります。',
    trouble: '部品表は作成した時点の番号を取り込みます。後でバルーンを追加しても行は増えないので、番号をそろえてから作成し直します。文字を大きくすると表も大きくなるため用紙の空きに注意します。',
  },
  lineTypes: {
    path: '右端の線種メニュー。選択中は既存の図形、作図中は次に描く図形へ適用。', shots: ['style-controls', 'line-types'],
    example: '隠れた辺は「かくれ線」、穴の中心を通る線は「中心線」、印刷しない下書きは「補助線」を選びます。',
    result: '外形線0.5mm、かくれ線0.35mm、ほかは0.25mmが標準の太さです。線種は配置されるレイヤーも変えます。',
    trouble: '既存の線を変えたい場合は、選択に戻って対象を選びます。作図の道具のままメニューを変えた場合は、次の作図に使う設定が変わります。',
  },
  widthText: {
    path: '右端の「太さ」「文字」メニュー。', shots: ['width-controls', 'width-before', 'width-after'],
    example: '図形と文字をまとめて選び、太さを1mm・文字を7mmにすると、線が太くなり文字の高さが2倍になります。',
    result: '設定は用紙上のmmです。寸法・記号・バルーン・部品表は文字の高さに合わせて枠も大きくなります。異なる値を持つ複数図形は「混在」と出ます。',
    trouble: '線種で太さを戻したいときは「太さ」を標準にします。文字サイズの対象でない直線や円だけを選んでも文字は変わりません。',
  },
  centerLineMode: {
    path: '作図 → 直線など → 線種「中心線」。', shots: ['center-guide', 'center-line'],
    example: '矩形の辺の中点付近にマウスを置き、縦軸に合わせて上側から下側へ直線を描きます。',
    result: '中点のピンクの三角と縦横の軸ガイドが出て、形からはみ出す位置でも軸に合わせられます。',
    trouble: 'このモードでは端点・交点への通常の点スナップを止めています。角を狙いたいときは線種を外形線などへ戻します。中点ガイドは近くの図形でのみ出ます。',
  },
  gridSnap: {
    path: '表示・設定 → グリッド → 自動／手動、スナップ。', shots: ['grid-controls', 'grid-draft', 'grid-status'],
    example: '手動を選んで間隔5mm・スナップをオンにすると、クリック位置が5mmの方眼にそろいます。',
    result: '状態表示が「グリッド:5mm(手動)」になります。自動では表示倍率によって間隔が変わります。',
    trouble: '間隔のメニューが薄くて触れない場合は「自動」になっています。細かく自由に動かしたい場合はスナップを外します。点スナップは別のチェックです。',
  },
  pointSnap: {
    path: '表示・設定 → 点スナップをオン。作図中に点の近くへマウスを置く。', shots: ['snap-end', 'snap-mid', 'snap-center'],
    example: '矩形の角、辺の中点、円の中心にマウスを近づけ、ピンクの目印が出た所をクリックします。',
    result: '端点は四角、中点は三角、中心・四半点は丸、交点は×の目印です。グリッドより図形上の点が優先されます。',
    trouble: '目印が出ないときは点スナップをオンにし、少し拡大して近づけます。線種が中心線のときは専用の中点・軸ガイドへ切り替わる点にも注意します。',
  },
  projection: {
    path: '表示・設定 → 投影ガイド／45°線配置／45°線。', shots: ['projection-controls', 'projection-guides', 'projection-45'],
    example: '矩形を選ぶとその特徴点から縦横にガイドが出ます。45°線配置で奥行きの転写に使う線を置きます。',
    result: '投影ガイドは画面で位置をそろえる補助です。印刷・SVGには出力されません。「45°線」のチェックで線を隠すことができます。',
    trouble: '縦横のガイドが出ないときは、投影ガイドがオンで図形が選択されているかを確認します。45°線はチェックをオンにするだけでなく、一度位置を配置してください。',
  },
  origin: {
    path: '表示・設定 → 原点設定 → 新しい0,0の位置をクリック。', shots: ['origin-before', 'origin-after', 'origin-numeric'],
    example: '矩形の左下①を新しい原点にします。矩形を選ぶと、数値欄の左下X・Yが0.00になります。',
    result: 'オレンジ色の原点の印と、数値欄・状態表示の座標が変わります。図形の実寸や用紙上の位置は変わりません。',
    trouble: '原点を動かす操作は図形を移動する操作とは別です。原点を間違えた場合はCtrl+Zで取り消せます。スナップで図形の角に合わせると便利です。',
  },
  paperScale: {
    path: '表示・設定 → 用紙・向き・縮尺。', shots: ['paper-controls', 'paper-one', 'paper-half'],
    example: 'A4横・1:1から縮尺だけ1:2に変えると、100mmの形が紙の上では50mmになります。',
    result: '図形の実寸100mmと寸法の数字100は保たれ、用紙に載る大きさだけ変わります。表題欄の尺度・用紙も設定に追従します。',
    trouble: '縮尺は「1:2」のようにコロンで区切った正の値を入力します。画面の＋・－は見え方を変える操作、編集の拡大縮小は図形の実寸を変える操作です。',
  },
  layers: {
    path: '表示・設定 → レイヤー。', shots: ['layer-controls', 'layer-hidden'],
    example: '中心線の「表示」を外すと画面で中心線が隠れます。「印刷」を外すと印刷やSVGから除かれます。',
    result: '表示と印刷は独立した設定です。補助線は初期設定で表示オン・印刷オフです。',
    trouble: '印刷で線が出ないときは「印刷」欄を、画面で線が見えないときは「表示」欄を確認します。表示だけを外しても印刷をオンにしていれば出力には含まれます。',
  },
  titleBlock: {
    path: '用紙右下の表題欄 → 選択ツールで値のマスをダブルクリック。', shots: ['title-blank', 'title-edit', 'title-result'],
    example: '図名に取付板、図番にCAD-001、材質にSS400、作成者に製図担当を記入します。',
    result: '右側のマスに入力した内容が残ります。尺度と用紙は設定から自動反映され、日付は初期値を変更することもできます。',
    trouble: '尺度と用紙は直接編集できません。「表示・設定」タブで変更します。図番や図名のマスが小さいときは表示を拡大してダブルクリックします。',
  },
  saveOpen: {
    path: 'ファイル → 保存／開く／名前を付けて保存／新規。', shots: ['file-controls', 'restore-banner'],
    example: 'Ctrl+Sで.jsonとして保存し、続きはCtrl+Oで同じファイルを開きます。別の図面として残したいときはCtrl+Shift+Sです。',
    result: '.jsonには図形・寸法・用紙・表題欄などの編集用データが残ります。SVGやPDFは出力用で、図面を再編集する「開く」の対象ではありません。',
    trouble: '保存方法はブラウザにより、保存先を選ぶ方式かダウンロード方式になります。復元は同じブラウザの保存領域を使うので、持ち運ぶ図面は必ず.jsonにも保存します。',
  },
  svgPrint: {
    path: 'ファイル → 印刷／SVG出力。', shots: ['print-controls', 'print-result'],
    example: '印刷では図面と同じ用紙サイズ・向きを選び、倍率100%または実際のサイズにします。PDFにする場合はブラウザの送信先でPDF保存を選びます。',
    result: '下の図はアプリが実際に印刷へ渡す図面です。方眼、原点、操作ガイド、投影ガイド、印刷オフのレイヤーは含みません。',
    trouble: 'ブラウザごとに印刷ダイアログの名前や配置が違います。用紙への自動合わせ・ヘッダーとフッター・追加余白を確認し、実寸が必要なら100mmの寸法線を試し刷りで測ります。',
  },
  keys: {
    path: '文字や数値の入力欄から離れ、図面上でキーを押します。', shots: ['key-tool', 'key-length', 'undo-controls'],
    example: 'Lで直線へ切り替え、始点をクリックして80と打つと長さ欄へ入ります。Enterで線を確定し、Ctrl+Zで作図を取り消せます。',
    result: '1文字キーで道具を選ぶと、その道具のあるタブも自動で開きます。F1は現在の道具に合う説明を開きます。',
    trouble: '入力欄の中ではLなどは文字入力です。Escで入力を閉じてから操作します。作図中のEnterとEscはそれぞれ確定・中止なので、使い分けてください。',
  },
};

const esc = value => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));

export function screenshotFigure(key) {
  const shot = HELP_SCREENSHOTS[key];
  if (!shot) throw new Error(`ヘルプの実画面がありません: ${key}`);
  const marks = shot.marks.map(({x,y,n,dx,dy}) => {
    const bx=x+dx, by=y+dy;
    return `<g class="help-shot-mark"><path d="M${bx} ${by} L${x} ${y}" stroke="#e8590c" stroke-width="2"/><circle cx="${x}" cy="${y}" r="4" fill="#e8590c" stroke="#fff" stroke-width="1.5"/><circle cx="${bx}" cy="${by}" r="12" fill="#e8590c" stroke="#fff" stroke-width="2"/><text x="${bx}" y="${by+4.5}" fill="#fff" font-family="sans-serif" font-size="13" font-weight="bold" text-anchor="middle">${esc(n)}</text></g>`;
  }).join('');
  return `<figure class="help-figure help-screenshot"><button type="button" class="help-figure-open" aria-label="図を拡大: ${esc(shot.caption)}"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${shot.width} ${shot.height}" width="${shot.width}" height="${shot.height}" role="img" aria-label="${esc(shot.caption)}"><image href="${esc(shot.src)}" width="${shot.width}" height="${shot.height}"/>${marks}</svg><span class="help-figure-hint">クリックで拡大</span></button><figcaption>${esc(shot.caption)}</figcaption></figure>`;
}

export function completeHelpTopic(topic) {
  const detail = HELP_DETAILS[topic.id];
  if (!detail) throw new Error(`ヘルプの詳細がありません: ${topic.id}`);
  let index=0;
  const used = new Set();
  // 既存の図の位置に実画面を置き、追加の操作段階を最後にまとめる。
  let html=topic.html.replace(/<!--help-figure(?::([\w,-]+))?-->/g, (match, names) => {
    const keys = names ? names.split(',') : [detail.shots[index++]];
    return keys.map(key => {
      if (!key) throw new Error(`ヘルプの図の対応が不足: ${topic.id} (${index})`);
      used.add(key);
      return screenshotFigure(key);
    }).join('\n');
  });
  const extra=detail.shots.filter(key=>!used.has(key)).map(screenshotFigure).join('\n');
  html=`<p class="help-location"><b>開く場所：</b>${esc(detail.path)}</p>\n${html}`;
  if (extra) html+=`\n<h3>実画面で操作を確認する</h3>\n${extra}`;
  html+=`\n<section class="help-check"><h3>具体例とできあがりの確認</h3><p>${esc(detail.example)}</p><p><b>確認すること：</b>${esc(detail.result)}</p></section>\n<div class="help-note"><b>うまくいかないとき：</b>${esc(detail.trouble)}</div>`;
  return {...topic,html};
}
