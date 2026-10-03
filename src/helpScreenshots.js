// npm run help:capture で実画面から生成。手作業で画面を描き直さない。
export const HELP_SCREENSHOTS = {
  "overview": {
    "src": "help/screenshots/overview.png",
    "width": 1280,
    "height": 800,
    "caption": "A4横の実画面。①タブ、②共通操作、③選択、④作図ボタン、⑤線種・太さ・文字、⑥用紙、⑦数値入力、⑧状態表示。",
    "marks": [
      {
        "x": 223,
        "y": 20,
        "n": 1,
        "dx": 0,
        "dy": 72
      },
      {
        "x": 1100,
        "y": 20,
        "n": 2,
        "dx": -280,
        "dy": 72
      },
      {
        "x": 34,
        "y": 55,
        "n": 3,
        "dx": 0,
        "dy": 40
      },
      {
        "x": 405,
        "y": 55,
        "n": 4,
        "dx": 0,
        "dy": 40
      },
      {
        "x": 1105,
        "y": 55,
        "n": 5,
        "dx": 0,
        "dy": 40
      },
      {
        "x": 325,
        "y": 210,
        "n": 6,
        "dx": 0,
        "dy": 0
      },
      {
        "x": 610,
        "y": 760,
        "n": 7,
        "dx": 25,
        "dy": -22
      },
      {
        "x": 385,
        "y": 788,
        "n": 8,
        "dx": 0,
        "dy": -25
      }
    ]
  },
  "tab-file": {
    "src": "help/screenshots/tab-file.png",
    "width": 462,
    "height": 52,
    "caption": "「ファイル」タブの実際のボタン。",
    "marks": []
  },
  "tab-draw": {
    "src": "help/screenshots/tab-draw.png",
    "width": 691,
    "height": 52,
    "caption": "「作図」タブの実際のボタン。",
    "marks": []
  },
  "tab-annotate": {
    "src": "help/screenshots/tab-annotate.png",
    "width": 865,
    "height": 52,
    "caption": "「寸法・記号」タブの実際のボタン。",
    "marks": []
  },
  "tab-edit": {
    "src": "help/screenshots/tab-edit.png",
    "width": 1171,
    "height": 52,
    "caption": "「編集」タブの実際のボタン。",
    "marks": []
  },
  "tab-view": {
    "src": "help/screenshots/tab-view.png",
    "width": 1056,
    "height": 52,
    "caption": "「表示・設定」タブの実際のボタン。",
    "marks": []
  },
  "selection": {
    "src": "help/screenshots/selection.png",
    "width": 650,
    "height": 330,
    "caption": "輪郭をクリックした矩形が青色で選択される。",
    "marks": [
      {
        "x": 125,
        "y": 185,
        "n": 1,
        "dx": -20,
        "dy": -24
      }
    ]
  },
  "selection-multiple": {
    "src": "help/screenshots/selection-multiple.png",
    "width": 650,
    "height": 330,
    "caption": "Shiftを押して円もクリックすると、矩形と円をまとめて選択できる。",
    "marks": []
  },
  "selection-box": {
    "src": "help/screenshots/selection-box.png",
    "width": 650,
    "height": 360,
    "caption": "空白からドラッグ。青い破線の枠に全体が入る図形を選ぶ。",
    "marks": []
  },
  "move-after": {
    "src": "help/screenshots/move-after.png",
    "width": 650,
    "height": 330,
    "caption": "矩形の輪郭をドラッグして右上へ25mm移動した結果。",
    "marks": []
  },
  "paste-after": {
    "src": "help/screenshots/paste-after.png",
    "width": 740,
    "height": 330,
    "caption": "Ctrl+Cでコピーし、マウスの位置にCtrl+Vで貼り付けた結果。",
    "marks": []
  },
  "copy-drag": {
    "src": "help/screenshots/copy-drag.png",
    "width": 740,
    "height": 330,
    "caption": "右ボタンを押したまま移動すると、コピー先が緑色の破線枠で表示される。",
    "marks": []
  },
  "menu-shape": {
    "src": "help/screenshots/menu-shape.png",
    "width": 264,
    "height": 431,
    "caption": "矩形の上で右クリックした実際のメニュー。",
    "marks": []
  },
  "menu-empty": {
    "src": "help/screenshots/menu-empty.png",
    "width": 224,
    "height": 223,
    "caption": "空白で右クリックした実際のメニュー。",
    "marks": []
  },
  "line-draft": {
    "src": "help/screenshots/line-draft.png",
    "width": 876,
    "height": 330,
    "caption": "始点①をクリックして終点②へマウスを動かした途中。緑の破線と実際の操作ガイド。",
    "marks": [
      {
        "x": 190,
        "y": 245,
        "n": 1,
        "dx": -20,
        "dy": -24
      },
      {
        "x": 590,
        "y": 85,
        "n": 2,
        "dx": 18,
        "dy": -26
      }
    ]
  },
  "line-result": {
    "src": "help/screenshots/line-result.png",
    "width": 650,
    "height": 330,
    "caption": "2回目のクリックで確定した直線。長さ107.70mm、角度21.8°の例。",
    "marks": [
      {
        "x": 125,
        "y": 245,
        "n": 1,
        "dx": -20,
        "dy": -24
      },
      {
        "x": 525,
        "y": 85,
        "n": 2,
        "dx": -20,
        "dy": -24
      }
    ]
  },
  "numeric-draw": {
    "src": "help/screenshots/numeric-draw.png",
    "width": 1280,
    "height": 39,
    "caption": "始点X=40、Y=30、長さ=80、角度=30を入力して「作図」を押す。",
    "marks": []
  },
  "numeric-result": {
    "src": "help/screenshots/numeric-result.png",
    "width": 650,
    "height": 330,
    "caption": "数値入力だけで作図した80mm・30°の直線。",
    "marks": []
  },
  "numeric-line": {
    "src": "help/screenshots/numeric-line.png",
    "width": 1280,
    "height": 39,
    "caption": "直線を1つ選ぶと、下の欄が「直線:」「更新」に変わる。",
    "marks": []
  },
  "numeric-line-result": {
    "src": "help/screenshots/numeric-line-result.png",
    "width": 650,
    "height": 330,
    "caption": "長さを80に変更してEnter。始点を保ったまま終点が動く。",
    "marks": []
  },
  "polyline-draft": {
    "src": "help/screenshots/polyline-draft.png",
    "width": 871,
    "height": 381,
    "caption": "①→②→③→④とクリックして、Enterで確定する。",
    "marks": [
      {
        "x": 125,
        "y": 285,
        "n": 1,
        "dx": -20,
        "dy": -24
      },
      {
        "x": 225,
        "y": 85,
        "n": 2,
        "dx": -20,
        "dy": -24
      },
      {
        "x": 425,
        "y": 85,
        "n": 3,
        "dx": -20,
        "dy": -24
      },
      {
        "x": 525,
        "y": 285,
        "n": 4,
        "dx": -20,
        "dy": -24
      }
    ]
  },
  "polyline-result": {
    "src": "help/screenshots/polyline-result.png",
    "width": 650,
    "height": 330,
    "caption": "Enterで確定した連続線。4つの点で1つの図形になる。",
    "marks": []
  },
  "segment-selection": {
    "src": "help/screenshots/segment-selection.png",
    "width": 650,
    "height": 330,
    "caption": "選択済みの連続線をもう一度クリックすると、その線分がオレンジ色になる。",
    "marks": []
  },
  "numeric-segment": {
    "src": "help/screenshots/numeric-segment.png",
    "width": 1280,
    "height": 39,
    "caption": "線分2/3の始点X・Y、長さ、角度を個別に編集する欄。",
    "marks": []
  },
  "rect-draft": {
    "src": "help/screenshots/rect-draft.png",
    "width": 770,
    "height": 330,
    "caption": "矩形は①と反対側の角②をクリックする。緑の破線は未確定の形。",
    "marks": [
      {
        "x": 185,
        "y": 285,
        "n": 1,
        "dx": -20,
        "dy": -24
      },
      {
        "x": 585,
        "y": 85,
        "n": 2,
        "dx": 18,
        "dy": -25
      }
    ]
  },
  "numeric-rect": {
    "src": "help/screenshots/numeric-rect.png",
    "width": 1280,
    "height": 39,
    "caption": "矩形の左下X・Y、幅=100、高さ=50、回転=0を示す実際の入力欄。",
    "marks": []
  },
  "rect-result": {
    "src": "help/screenshots/rect-result.png",
    "width": 650,
    "height": 330,
    "caption": "幅100mm・高さ50mmの矩形ができた状態。",
    "marks": []
  },
  "circle-draft": {
    "src": "help/screenshots/circle-draft.png",
    "width": 720,
    "height": 330,
    "caption": "円の中心①をクリックし、半径25mmの円周②にマウスを置いた途中。",
    "marks": [
      {
        "x": 360,
        "y": 165,
        "n": 1,
        "dx": -20,
        "dy": -24
      },
      {
        "x": 460,
        "y": 165,
        "n": 2,
        "dx": 18,
        "dy": -26
      }
    ]
  },
  "circle-result": {
    "src": "help/screenshots/circle-result.png",
    "width": 650,
    "height": 330,
    "caption": "確定した円。半径25mmなので直径は50mm。",
    "marks": []
  },
  "numeric-circle": {
    "src": "help/screenshots/numeric-circle.png",
    "width": 1280,
    "height": 39,
    "caption": "円の数値編集では「半径」ではなく「直径」を入力する。",
    "marks": []
  },
  "arc-draft": {
    "src": "help/screenshots/arc-draft.png",
    "width": 780,
    "height": 330,
    "caption": "円弧は中心①→開始②→終了③。②から③へ左回りの90°の弧。",
    "marks": [
      {
        "x": 390,
        "y": 205,
        "n": 1,
        "dx": -20,
        "dy": -24
      },
      {
        "x": 530,
        "y": 205,
        "n": 2,
        "dx": -20,
        "dy": -24
      },
      {
        "x": 390,
        "y": 65,
        "n": 3,
        "dx": -25,
        "dy": -25
      }
    ]
  },
  "arc-result": {
    "src": "help/screenshots/arc-result.png",
    "width": 650,
    "height": 330,
    "caption": "半径35mm、開始0°、終了90°の円弧ができた状態。",
    "marks": []
  },
  "ellipse-draft": {
    "src": "help/screenshots/ellipse-draft.png",
    "width": 810,
    "height": 330,
    "caption": "楕円は中心①と外枠の角②。横半径45mm、縦半径25mmの例。",
    "marks": [
      {
        "x": 400,
        "y": 165,
        "n": 1,
        "dx": -20,
        "dy": -24
      },
      {
        "x": 580,
        "y": 65,
        "n": 2,
        "dx": 18,
        "dy": -25
      }
    ]
  },
  "ellipse-result": {
    "src": "help/screenshots/ellipse-result.png",
    "width": 650,
    "height": 330,
    "caption": "横半径45mm、縦半径25mmの楕円を確定した結果。",
    "marks": []
  },
  "earc-draft": {
    "src": "help/screenshots/earc-draft.png",
    "width": 790,
    "height": 330,
    "caption": "楕円弧は中心①→外枠の角②→開始③→終了④の4回クリック。",
    "marks": [
      {
        "x": 395,
        "y": 205,
        "n": 1,
        "dx": -20,
        "dy": -24
      },
      {
        "x": 575,
        "y": 105,
        "n": 2,
        "dx": 20,
        "dy": -25
      },
      {
        "x": 575,
        "y": 205,
        "n": 3,
        "dx": 25,
        "dy": 30
      },
      {
        "x": 395,
        "y": 105,
        "n": 4,
        "dx": -25,
        "dy": -25
      }
    ]
  },
  "earc-result": {
    "src": "help/screenshots/earc-result.png",
    "width": 650,
    "height": 330,
    "caption": "横半径45mm、縦半径25mmの楕円弧ができた状態。",
    "marks": []
  },
  "spline-draft": {
    "src": "help/screenshots/spline-draft.png",
    "width": 968,
    "height": 330,
    "caption": "曲線を通したい点を順にクリックし、Enterで確定する。",
    "marks": [
      {
        "x": 175,
        "y": 245,
        "n": 1,
        "dx": -20,
        "dy": -24
      },
      {
        "x": 315,
        "y": 65,
        "n": 2,
        "dx": -20,
        "dy": -24
      },
      {
        "x": 475,
        "y": 265,
        "n": 3,
        "dx": -20,
        "dy": -24
      },
      {
        "x": 615,
        "y": 105,
        "n": 4,
        "dx": 20,
        "dy": -25
      }
    ]
  },
  "spline-result": {
    "src": "help/screenshots/spline-result.png",
    "width": 650,
    "height": 330,
    "caption": "4点を通るスプライン。完成した曲線は黒い実線で表示される。",
    "marks": []
  },
  "text-entry": {
    "src": "help/screenshots/text-entry.png",
    "width": 650,
    "height": 330,
    "caption": "文字の位置①をクリックして、白い入力欄に「取付板」と入力する。",
    "marks": [
      {
        "x": 205,
        "y": 165,
        "n": 1,
        "dx": -25,
        "dy": 28
      }
    ]
  },
  "text-result": {
    "src": "help/screenshots/text-result.png",
    "width": 650,
    "height": 330,
    "caption": "Enterで確定した文字「取付板」。",
    "marks": []
  },
  "thread-control": {
    "src": "help/screenshots/thread-control.png",
    "width": 157,
    "height": 52,
    "caption": "「ねじ穴」の右で呼びM6を選ぶ。",
    "marks": []
  },
  "thread-result": {
    "src": "help/screenshots/thread-result.png",
    "width": 420,
    "height": 300,
    "caption": "M6の下穴円・3/4円弧・中心線の十字を同時に作図した実画面。",
    "marks": [
      {
        "x": 210,
        "y": 150,
        "n": 1,
        "dx": -35,
        "dy": -35
      }
    ]
  },
  "delete-result": {
    "src": "help/screenshots/delete-result.png",
    "width": 650,
    "height": 330,
    "caption": "矩形を選んでDeleteを押すと、選択した図形が消える。",
    "marks": []
  },
  "undo-result": {
    "src": "help/screenshots/undo-result.png",
    "width": 650,
    "height": 330,
    "caption": "Ctrl+Zで削除を取り消すと矩形が戻る。",
    "marks": []
  },
  "undo-controls": {
    "src": "help/screenshots/undo-controls.png",
    "width": 392,
    "height": 56,
    "caption": "上段の「元に戻す」「やり直し」。キーボードでも同じ操作ができる。",
    "marks": []
  },
  "rotate-control": {
    "src": "help/screenshots/rotate-control.png",
    "width": 318,
    "height": 52,
    "caption": "角度に30を入れ、「回転」を押す。",
    "marks": []
  },
  "rotate-before": {
    "src": "help/screenshots/rotate-before.png",
    "width": 880,
    "height": 480,
    "caption": "変更する前の図形。青色は選択中の表示。",
    "marks": []
  },
  "rotate-after": {
    "src": "help/screenshots/rotate-after.png",
    "width": 880,
    "height": 480,
    "caption": "30°左回りに回転した結果。",
    "marks": []
  },
  "scale-control": {
    "src": "help/screenshots/scale-control.png",
    "width": 318,
    "height": 52,
    "caption": "倍率に2を入れ、「拡大縮小」を押す。",
    "marks": []
  },
  "scale-before": {
    "src": "help/screenshots/scale-before.png",
    "width": 880,
    "height": 480,
    "caption": "変更する前の図形。青色は選択中の表示。",
    "marks": []
  },
  "scale-after": {
    "src": "help/screenshots/scale-after.png",
    "width": 880,
    "height": 480,
    "caption": "倍率2で大きさが2倍になった結果。",
    "marks": []
  },
  "mirror-control": {
    "src": "help/screenshots/mirror-control.png",
    "width": 243,
    "height": 52,
    "caption": "選択した図形に「左右反転」「上下反転」を使う。",
    "marks": []
  },
  "mirror-before": {
    "src": "help/screenshots/mirror-before.png",
    "width": 880,
    "height": 480,
    "caption": "変更する前の図形。青色は選択中の表示。",
    "marks": []
  },
  "mirror-after": {
    "src": "help/screenshots/mirror-after.png",
    "width": 880,
    "height": 480,
    "caption": "左右反転した結果。",
    "marks": []
  },
  "explode-before": {
    "src": "help/screenshots/explode-before.png",
    "width": 650,
    "height": 330,
    "caption": "分解前の矩形。4辺で1つの図形。",
    "marks": []
  },
  "explode-after": {
    "src": "help/screenshots/explode-after.png",
    "width": 650,
    "height": 330,
    "caption": "分解後は4本の直線。下辺だけを選択できる。",
    "marks": [
      {
        "x": 225,
        "y": 285,
        "n": 1,
        "dx": -20,
        "dy": -24
      }
    ]
  },
  "trim-before": {
    "src": "help/screenshots/trim-before.png",
    "width": 801,
    "height": 330,
    "caption": "交点より右の余分な区間①をクリックして切り取る。",
    "marks": [
      {
        "x": 580,
        "y": 205,
        "n": 1,
        "dx": -20,
        "dy": -24
      }
    ]
  },
  "trim-after": {
    "src": "help/screenshots/trim-after.png",
    "width": 650,
    "height": 330,
    "caption": "トリム後。右の余分な部分だけが消え、交点までの直線が残る。",
    "marks": []
  },
  "extend-before": {
    "src": "help/screenshots/extend-before.png",
    "width": 800,
    "height": 330,
    "caption": "伸ばしたい側の端に近い所①をクリックする。",
    "marks": [
      {
        "x": 360,
        "y": 205,
        "n": 1,
        "dx": -20,
        "dy": -24
      }
    ]
  },
  "extend-after": {
    "src": "help/screenshots/extend-after.png",
    "width": 650,
    "height": 330,
    "caption": "延長後。直線が右に伸び、縦の直線との交点で止まる。",
    "marks": []
  },
  "offset-control": {
    "src": "help/screenshots/offset-control.png",
    "width": 224,
    "height": 52,
    "caption": "「オフセット」の右の距離に10mmを指定する。",
    "marks": []
  },
  "offset-pick": {
    "src": "help/screenshots/offset-pick.png",
    "width": 850,
    "height": 330,
    "caption": "元の直線①を選んだあと、上側②をクリックしてコピーする。",
    "marks": [
      {
        "x": 385,
        "y": 205,
        "n": 1,
        "dx": -20,
        "dy": -24
      },
      {
        "x": 385,
        "y": 125,
        "n": 2,
        "dx": -25,
        "dy": -25
      }
    ]
  },
  "offset-after": {
    "src": "help/screenshots/offset-after.png",
    "width": 650,
    "height": 330,
    "caption": "元の直線を残して、10mm上に平行な直線を作った結果。",
    "marks": []
  },
  "fillet-control": {
    "src": "help/screenshots/fillet-control.png",
    "width": 294,
    "height": 52,
    "caption": "フィレットを選び、サイズに10mmを指定する。",
    "marks": []
  },
  "fillet-before": {
    "src": "help/screenshots/fillet-before.png",
    "width": 820,
    "height": 330,
    "caption": "①水平な直線、②縦の直線の順に、残したい側をクリックする。",
    "marks": [
      {
        "x": 410,
        "y": 265,
        "n": 1,
        "dx": -20,
        "dy": -24
      },
      {
        "x": 570,
        "y": 125,
        "n": 2,
        "dx": 20,
        "dy": -25
      }
    ]
  },
  "fillet-after": {
    "src": "help/screenshots/fillet-after.png",
    "width": 650,
    "height": 330,
    "caption": "半径10mmの円弧で角を丸めた結果。",
    "marks": []
  },
  "chamfer-control": {
    "src": "help/screenshots/chamfer-control.png",
    "width": 294,
    "height": 52,
    "caption": "面取りを選び、サイズに10mmを指定する。",
    "marks": []
  },
  "chamfer-before": {
    "src": "help/screenshots/chamfer-before.png",
    "width": 820,
    "height": 330,
    "caption": "①水平な直線、②縦の直線の順に、残したい側をクリックする。",
    "marks": [
      {
        "x": 410,
        "y": 265,
        "n": 1,
        "dx": -20,
        "dy": -24
      },
      {
        "x": 570,
        "y": 125,
        "n": 2,
        "dx": 20,
        "dy": -25
      }
    ]
  },
  "chamfer-after": {
    "src": "help/screenshots/chamfer-after.png",
    "width": 650,
    "height": 330,
    "caption": "直角の角を10mmずつ切り落とした結果。",
    "marks": []
  },
  "dimension-draft": {
    "src": "help/screenshots/dimension-draft.png",
    "width": 830,
    "height": 430,
    "caption": "①左下→②右下→③寸法線を置く位置。緑の破線は配置のプレビュー。",
    "marks": [
      {
        "x": 215,
        "y": 275,
        "n": 1,
        "dx": -20,
        "dy": -24
      },
      {
        "x": 615,
        "y": 275,
        "n": 2,
        "dx": -20,
        "dy": -24
      },
      {
        "x": 415,
        "y": 335,
        "n": 3,
        "dx": 20,
        "dy": 28
      }
    ]
  },
  "dimension-result": {
    "src": "help/screenshots/dimension-result.png",
    "width": 650,
    "height": 430,
    "caption": "幅100mmの矩形に「100」の長さ寸法を配置した結果。",
    "marks": []
  },
  "dimension-aligned": {
    "src": "help/screenshots/dimension-aligned.png",
    "width": 650,
    "height": 430,
    "caption": "3回目のクリックでShiftを押すと、斜めの直線に平行な寸法になる。",
    "marks": []
  },
  "dimension-text-before": {
    "src": "help/screenshots/dimension-text-before.png",
    "width": 820,
    "height": 430,
    "caption": "寸法の数字そのものを押したまま、線に沿って移動する。",
    "marks": []
  },
  "dimension-text-after": {
    "src": "help/screenshots/dimension-text-after.png",
    "width": 820,
    "height": 430,
    "caption": "数字を補助線の外側へ出すと、寸法線が延び、矢印が外側から内向きになる。",
    "marks": []
  },
  "dimension-text-menu": {
    "src": "help/screenshots/dimension-text-menu.png",
    "width": 264,
    "height": 467,
    "caption": "右クリックの「寸法の値を中央に戻す」で位置を戻せる。",
    "marks": []
  },
  "diameter-pick": {
    "src": "help/screenshots/diameter-pick.png",
    "width": 800,
    "height": 330,
    "caption": "φを選び、円の線①をクリックする。",
    "marks": [
      {
        "x": 480,
        "y": 105,
        "n": 1,
        "dx": 22,
        "dy": -25
      }
    ]
  },
  "diameter-result": {
    "src": "help/screenshots/diameter-result.png",
    "width": 650,
    "height": 330,
    "caption": "円の直径50mmを示すφ50の寸法。",
    "marks": []
  },
  "radius-pick": {
    "src": "help/screenshots/radius-pick.png",
    "width": 809,
    "height": 330,
    "caption": "Rを選び、円の線①をクリックする。",
    "marks": [
      {
        "x": 480,
        "y": 105,
        "n": 1,
        "dx": 22,
        "dy": -25
      }
    ]
  },
  "radius-result": {
    "src": "help/screenshots/radius-result.png",
    "width": 650,
    "height": 330,
    "caption": "円の半径25mmを示すR25の寸法。",
    "marks": []
  },
  "angle-draft": {
    "src": "help/screenshots/angle-draft.png",
    "width": 890,
    "height": 430,
    "caption": "①頂点→②右の辺→③上の辺。③までの距離が寸法弧の大きさになる。",
    "marks": [
      {
        "x": 265,
        "y": 355,
        "n": 1,
        "dx": -20,
        "dy": -24
      },
      {
        "x": 625,
        "y": 355,
        "n": 2,
        "dx": -20,
        "dy": -24
      },
      {
        "x": 505,
        "y": 115,
        "n": 3,
        "dx": -20,
        "dy": -24
      }
    ]
  },
  "angle-result": {
    "src": "help/screenshots/angle-result.png",
    "width": 650,
    "height": 430,
    "caption": "2辺のなす45°の角度寸法。",
    "marks": []
  },
  "chamfer-dimension-draft": {
    "src": "help/screenshots/chamfer-dimension-draft.png",
    "width": 982,
    "height": 330,
    "caption": "①面取りの斜めの直線→②文字の位置。",
    "marks": [
      {
        "x": 590,
        "y": 265,
        "n": 1,
        "dx": -20,
        "dy": -24
      },
      {
        "x": 710,
        "y": 145,
        "n": 2,
        "dx": 20,
        "dy": -25
      }
    ]
  },
  "chamfer-dimension-result": {
    "src": "help/screenshots/chamfer-dimension-result.png",
    "width": 780,
    "height": 330,
    "caption": "10mmの面取りを示すC10の寸法。",
    "marks": []
  },
  "dimension-edit": {
    "src": "help/screenshots/dimension-edit.png",
    "width": 650,
    "height": 430,
    "caption": "選択ツールで数字をダブルクリックし、「100±0.1」を入力する。",
    "marks": []
  },
  "dimension-edit-result": {
    "src": "help/screenshots/dimension-edit-result.png",
    "width": 650,
    "height": 430,
    "caption": "Enterで確定。形の大きさを変えずに公差付きの表示に変わる。",
    "marks": []
  },
  "leader-entry": {
    "src": "help/screenshots/leader-entry.png",
    "width": 930,
    "height": 330,
    "caption": "①指す場所→②文字の位置をクリックし、注記を入力する。",
    "marks": [
      {
        "x": 545,
        "y": 105,
        "n": 1,
        "dx": -20,
        "dy": -24
      },
      {
        "x": 685,
        "y": 25,
        "n": 2,
        "dx": -25,
        "dy": 25
      }
    ]
  },
  "leader-result": {
    "src": "help/screenshots/leader-result.png",
    "width": 790,
    "height": 330,
    "caption": "確定した引出線と注記「φ50 穴」。",
    "marks": []
  },
  "roughness-edit": {
    "src": "help/screenshots/roughness-edit.png",
    "width": 650,
    "height": 430,
    "caption": "粗さ記号にRa 1.6を入力する。",
    "marks": []
  },
  "roughness-result": {
    "src": "help/screenshots/roughness-result.png",
    "width": 650,
    "height": 430,
    "caption": "粗さ記号の値をRa 1.6に変更した結果。",
    "marks": []
  },
  "fcf-edit": {
    "src": "help/screenshots/fcf-edit.png",
    "width": 650,
    "height": 430,
    "caption": "公差枠に//|0.02|Aを入力する。",
    "marks": []
  },
  "fcf-result": {
    "src": "help/screenshots/fcf-result.png",
    "width": 650,
    "height": 430,
    "caption": "縦棒で区切った3つのマス「//」「0.02」「A」の公差枠。",
    "marks": []
  },
  "hatch-control": {
    "src": "help/screenshots/hatch-control.png",
    "width": 283,
    "height": 52,
    "caption": "角度45°・間隔3mmを指定し、矩形の輪郭をクリックする。",
    "marks": []
  },
  "hatch-before": {
    "src": "help/screenshots/hatch-before.png",
    "width": 850,
    "height": 330,
    "caption": "矩形の輪郭①をクリックする。図形の内側ではなく線の上を狙う。",
    "marks": [
      {
        "x": 225,
        "y": 185,
        "n": 1,
        "dx": -20,
        "dy": -24
      }
    ]
  },
  "hatch-after": {
    "src": "help/screenshots/hatch-after.png",
    "width": 650,
    "height": 330,
    "caption": "矩形の中に45°の斜線が入った結果。",
    "marks": []
  },
  "balloon-draft": {
    "src": "help/screenshots/balloon-draft.png",
    "width": 860,
    "height": 430,
    "caption": "①部品を指す位置→②番号の丸の位置。",
    "marks": [
      {
        "x": 350,
        "y": 175,
        "n": 1,
        "dx": -20,
        "dy": -24
      },
      {
        "x": 310,
        "y": 55,
        "n": 2,
        "dx": -20,
        "dy": -24
      }
    ]
  },
  "balloon-result": {
    "src": "help/screenshots/balloon-result.png",
    "width": 650,
    "height": 430,
    "caption": "1つ目が1、2つ目が2と自動採番されたバルーン。",
    "marks": []
  },
  "bom-created": {
    "src": "help/screenshots/bom-created.png",
    "width": 650,
    "height": 360,
    "caption": "バルーン1・2の行が自動で入る部品表。クリックした位置①が表の左下。",
    "marks": [
      {
        "x": 125,
        "y": 240,
        "n": 1,
        "dx": -25,
        "dy": 25
      }
    ]
  },
  "bom-edit": {
    "src": "help/screenshots/bom-edit.png",
    "width": 650,
    "height": 360,
    "caption": "品名のマスをダブルクリックして「取付板」と入力する。",
    "marks": []
  },
  "bom-result": {
    "src": "help/screenshots/bom-result.png",
    "width": 650,
    "height": 360,
    "caption": "品名・数量・材質を記入した部品表。",
    "marks": []
  },
  "line-types": {
    "src": "help/screenshots/line-types.png",
    "width": 800,
    "height": 450,
    "caption": "同じ画面倍率で比較した6種類の線。線種ごとの太さと破線間隔も実際の描画。",
    "marks": []
  },
  "style-controls": {
    "src": "help/screenshots/style-controls.png",
    "width": 358,
    "height": 47,
    "caption": "線種「かくれ線」、太さ「標準」、文字3.5mmの実際のメニュー。",
    "marks": []
  },
  "width-controls": {
    "src": "help/screenshots/width-controls.png",
    "width": 358,
    "height": 47,
    "caption": "選択した図形の「太さ」と「文字」をこのメニューで変更する。",
    "marks": []
  },
  "width-before": {
    "src": "help/screenshots/width-before.png",
    "width": 650,
    "height": 330,
    "caption": "標準の線の太さ0.5mm・文字の高さ3.5mm。",
    "marks": []
  },
  "width-after": {
    "src": "help/screenshots/width-after.png",
    "width": 650,
    "height": 330,
    "caption": "太さ1mm・文字7mmに変更した結果。",
    "marks": []
  },
  "center-guide": {
    "src": "help/screenshots/center-guide.png",
    "width": 790,
    "height": 400,
    "caption": "線種「中心線」で辺の中点付近にマウスを置くと、ピンクの中点と十字の軸ガイドが出る。",
    "marks": []
  },
  "center-line": {
    "src": "help/screenshots/center-line.png",
    "width": 650,
    "height": 430,
    "caption": "中点を通る軸上へ吸着させ、矩形の外にはみ出して中心線を引いた結果。",
    "marks": []
  },
  "grid-controls": {
    "src": "help/screenshots/grid-controls.png",
    "width": 329,
    "height": 47,
    "caption": "グリッドを「手動」、間隔5mm、スナップと点スナップをオンにした設定。",
    "marks": []
  },
  "grid-draft": {
    "src": "help/screenshots/grid-draft.png",
    "width": 882,
    "height": 330,
    "caption": "方眼5mmに吸着した始点。画面下の状態表示でも手動5mmを確認できる。",
    "marks": []
  },
  "grid-status": {
    "src": "help/screenshots/grid-status.png",
    "width": 1280,
    "height": 23,
    "caption": "状態表示に「グリッド:5mm(手動)」が表示される。",
    "marks": []
  },
  "snap-end": {
    "src": "help/screenshots/snap-end.png",
    "width": 600,
    "height": 343,
    "caption": "端点はピンクの四角。",
    "marks": []
  },
  "snap-mid": {
    "src": "help/screenshots/snap-mid.png",
    "width": 600,
    "height": 330,
    "caption": "中点はピンクの三角。",
    "marks": []
  },
  "snap-center": {
    "src": "help/screenshots/snap-center.png",
    "width": 600,
    "height": 330,
    "caption": "中心はピンクの丸。",
    "marks": []
  },
  "projection-controls": {
    "src": "help/screenshots/projection-controls.png",
    "width": 257,
    "height": 52,
    "caption": "投影ガイドをオンにし、必要な場所へ「45°線配置」で奥行きを転写する。",
    "marks": []
  },
  "projection-guides": {
    "src": "help/screenshots/projection-guides.png",
    "width": 900,
    "height": 500,
    "caption": "選択した矩形の特徴点から、縦横に伸びる投影ガイドの実表示。",
    "marks": []
  },
  "projection-45": {
    "src": "help/screenshots/projection-45.png",
    "width": 950,
    "height": 500,
    "caption": "クリックした位置を通る45°線。作図の補助として表示される。",
    "marks": []
  },
  "origin-before": {
    "src": "help/screenshots/origin-before.png",
    "width": 830,
    "height": 343,
    "caption": "原点設定を選び、矩形の左下①をクリックして座標0,0の位置にする。",
    "marks": [
      {
        "x": 215,
        "y": 285,
        "n": 1,
        "dx": -20,
        "dy": -24
      }
    ]
  },
  "origin-after": {
    "src": "help/screenshots/origin-after.png",
    "width": 650,
    "height": 330,
    "caption": "新しい原点のオレンジ色の印。矩形の位置はそのまま。",
    "marks": [
      {
        "x": 125,
        "y": 285,
        "n": 1,
        "dx": -20,
        "dy": -24
      }
    ]
  },
  "origin-numeric": {
    "src": "help/screenshots/origin-numeric.png",
    "width": 1280,
    "height": 39,
    "caption": "原点を左下に合わせたので、矩形の左下XとYが0.00になる。",
    "marks": []
  },
  "paper-controls": {
    "src": "help/screenshots/paper-controls.png",
    "width": 262,
    "height": 47,
    "caption": "用紙A4・横・縮尺1:1の初期設定。",
    "marks": []
  },
  "paper-one": {
    "src": "help/screenshots/paper-one.png",
    "width": 1280,
    "height": 800,
    "caption": "縮尺1:1の図面全体。幅100mmの矩形。",
    "marks": []
  },
  "paper-half": {
    "src": "help/screenshots/paper-half.png",
    "width": 1280,
    "height": 800,
    "caption": "縮尺1:2では紙の上の図形が半分になり、寸法は実物の100mmのまま。",
    "marks": []
  },
  "layer-controls": {
    "src": "help/screenshots/layer-controls.png",
    "width": 224,
    "height": 191,
    "caption": "レイヤーの実際の一覧。「表示」と「印刷」は別々に切り替える。",
    "marks": []
  },
  "layer-hidden": {
    "src": "help/screenshots/layer-hidden.png",
    "width": 650,
    "height": 330,
    "caption": "中心線レイヤーの「表示」をオフにすると、画面の中心線だけが隠れる。",
    "marks": []
  },
  "title-blank": {
    "src": "help/screenshots/title-blank.png",
    "width": 650,
    "height": 390,
    "caption": "用紙右下の実際の表題欄。図番・図名・尺度・用紙・材質・作成者・日付の7行。",
    "marks": []
  },
  "title-edit": {
    "src": "help/screenshots/title-edit.png",
    "width": 650,
    "height": 390,
    "caption": "図名のマスをダブルクリックして入力する。",
    "marks": []
  },
  "title-result": {
    "src": "help/screenshots/title-result.png",
    "width": 650,
    "height": 390,
    "caption": "図番・図名・材質・作成者を記入した結果。尺度と用紙は設定を自動表示する。",
    "marks": []
  },
  "file-controls": {
    "src": "help/screenshots/file-controls.png",
    "width": 462,
    "height": 52,
    "caption": "新規・開く・保存・名前を付けて保存・SVG出力・印刷の実際の並び。",
    "marks": []
  },
  "restore-banner": {
    "src": "help/screenshots/restore-banner.png",
    "width": 1280,
    "height": 41,
    "caption": "未保存の変更が残っている場合に出る実際の復元確認の帯。",
    "marks": []
  },
  "print-controls": {
    "src": "help/screenshots/print-controls.png",
    "width": 165,
    "height": 52,
    "caption": "「SVG出力」で画像を書き出し、「印刷」から紙やPDFへ出力する。",
    "marks": []
  },
  "print-result": {
    "src": "help/screenshots/print-result.png",
    "width": 850,
    "height": 601,
    "caption": "アプリが印刷へ渡す実際の図面。方眼・原点・操作ガイド・補助線は出力されない。",
    "marks": []
  },
  "view-fit": {
    "src": "help/screenshots/view-fit.png",
    "width": 1280,
    "height": 800,
    "caption": "「全体」で用紙全体を表示した状態。",
    "marks": []
  },
  "view-zoom": {
    "src": "help/screenshots/view-zoom.png",
    "width": 1280,
    "height": 800,
    "caption": "Shift+ホイールでマウス位置を中心に拡大した状態。図形の寸法は変わらない。",
    "marks": []
  },
  "view-controls": {
    "src": "help/screenshots/view-controls.png",
    "width": 392,
    "height": 56,
    "caption": "右上の「＋」「－」「全体」で画面の倍率を操作する。",
    "marks": []
  },
  "help-search": {
    "src": "help/screenshots/help-search.png",
    "width": 1100,
    "height": 736,
    "caption": "検索欄に「円 描く」と入力すると、該当する説明と左の検索結果が表示される。",
    "marks": []
  },
  "key-tool": {
    "src": "help/screenshots/key-tool.png",
    "width": 691,
    "height": 52,
    "caption": "Lを押すと「作図」タブが開き、「直線」が青く選ばれる。",
    "marks": []
  },
  "key-length": {
    "src": "help/screenshots/key-length.png",
    "width": 1280,
    "height": 39,
    "caption": "直線の始点をクリックして80を打つと、「長さ」の欄へ自動で入力される。",
    "marks": []
  }
};
