// ヘルプの図は実際のDOM/CSSとCanvas描画を撮影する。注釈は別のSVGレイヤー。
// npm run help:capture（初回は npx playwright install chromium）
import { build } from 'esbuild';
import { chromium } from 'playwright';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createServer } from 'node:http';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import path from 'node:path';
import { regularPolygonPoints } from '../src/polygon.js';

const root = path.resolve(import.meta.dirname, '..');
const output = path.join(root, 'www/help/screenshots');
await mkdir(output, { recursive: true });
const source = await readFile(path.join(root, 'src/app.js'), 'utf8');
// 撮影時だけ付ける初期化用フック。配布HTMLには含めない。
const hooks = `
globalThis.__helpCapture = {
  reset(options = {}) {
    help.close(); popup.close(); closeTextEntry();
    clearTimeout(messageTimer); clearTimeout(backupTimer);
    state.doc = createDocument();
    state.doc.titleBlock.fields.find(f => f.label === '日付').value = '2026/10/03';
    for (const entity of options.entities ?? []) addEntity(state.doc, entity);
    Object.assign(state, {
      selection: new Set(options.selection ?? []), history: createHistory(100),
      dirty: false, draft: null, mouseReal: null, mouseScreen: null, message: null,
      snapHint: null, midGuides: [], copyDrag: null, offsetPick: null, filletFirst: null,
      moveDrag: null, dimTextDrag: null, panDrag: null, clipboard: null, rightPress: null,
      hover: null, hoverGroup: null, subSel: null, spaceDown: false, showGuide: true, show45: true,
      polygonMode: 'side',
      gridSnap: options.gridSnap ?? false, osnap: options.osnap ?? true,
      projGuides: options.projGuides ?? false,
      pen: {shape: {preset: 'outline', widthMm: null}, text: {textMm: 3.5}, anno: {textMm: 3.5, widthMm: null}},
    });
    for (const [id, value] of Object.entries({'rotate-angle':'90', 'scale-factor':'2', 'offset-dist':'10', 'fillet-r':'5', 'hatch-angle':'45', 'hatch-space':'3', 'thread-size':'M6', 'polygon-sides':'6'})) el(id).value = value;
    for (const [id, prop] of Object.entries({'grid-snap':'gridSnap','osnap':'osnap','proj-guides':'projGuides','show-guide':'showGuide','show45':'show45'})) el(id).checked = state[prop];
    el('layer-panel').open = false; el('restore-banner').style.display = 'none';
    lastPanelKey = null; syncSettingsUI(); buildLayerPanel(); setTool('select');
    activateTab(options.tab ?? 'draw');
    const z = options.zoom ?? 4;
    const [cx, cy] = options.center ?? [100, 100];
    state.view = {...state.view, pxPerMm:z, panX:cx - canvas.clientWidth / (2*z), panY:cy - canvas.clientHeight / (2*z)};
    render(); document.activeElement?.blur();
  },
  point(x, y) {
    const p = vt.paperToScreen(vt.realToPaper({x,y}, state.doc.scale), state.view);
    const r = canvas.getBoundingClientRect();
    return {x:p.x+r.left,y:p.y+r.top};
  },
  refresh() { lastPanelKey = null; render(); },
  titleLayout() { return titleBlockLayout(state.doc); },
  bomLayout(e) { return bomLayout(e); },
};`;
// ヘルプに新しい図を足した直後は、まだその図が撮られていない。撮影用のアプリだけは、
// 撮影前の図を仮の画像で代用して起動できるようにする(撮影後に helpScreenshots.js を作り直すので、
// 配布物・テストでは全部の図がそろっているかを従来どおり確かめられる)
const pendingShots = {
  name: 'pending-help-screenshots',
  setup(builder) {
    builder.onLoad({filter:/[\\/]helpScreenshots\.js$/}, async args => ({
      contents: (await readFile(args.path,'utf8')).replace('export const HELP_SCREENSHOTS =','const TAKEN =')
        + `\nconst PENDING = {src:'help/screenshots/overview.png',width:1280,height:800,caption:'（撮影前の図）',marks:[]};`
        + `\nexport const HELP_SCREENSHOTS = new Proxy(TAKEN, {get:(shots,key)=>shots[key] ?? (typeof key === 'string' ? PENDING : undefined)});\n`,
      loader: 'js',
    }));
  },
};
const result = await build({stdin: {contents: source + hooks, resolveDir:path.join(root,'src'), sourcefile:'capture-app.js'}, bundle:true, format:'iife', write:false, plugins:[pendingShots]});
const app = result.outputFiles[0].text;
const index = await readFile(path.join(root,'www/index.html'),'utf8');
const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname === '/') {res.setHeader('Content-Type','text/html; charset=utf-8'); res.end(index);}
    else if (url.pathname === '/app.js') {res.setHeader('Content-Type','text/javascript; charset=utf-8');res.end(app);}
    else if (url.pathname === '/styles.css') {res.setHeader('Content-Type','text/css; charset=utf-8');res.end(await readFile(path.join(root,'www/styles.css')));}
    else if (/^\/help\/screenshots\/[\w-]+\.png$/.test(url.pathname)) {res.setHeader('Content-Type','image/png');res.end(await readFile(path.join(root,'www',url.pathname.slice(1))));}
    else {res.statusCode=404;res.end();}
  } catch (error) { res.statusCode=500;res.end(String(error)); }
});
await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
const browser = await chromium.launch({headless:true});
const page = await browser.newPage({viewport:{width:1280,height:800},deviceScaleFactor:1});
const errors = [];
page.on('pageerror',error=>errors.push(error.message));
await page.goto(`http://127.0.0.1:${server.address().port}`);
await page.waitForFunction(()=>window.__helpCapture);
await page.evaluate(()=>document.fonts.ready);
const shots = {};
// タブの切り替えでボタンの段数が変わるとキャンバスの大きさも変わる。アプリが新しい大きさに
// 追従する(ResizeObserver)まで2フレーム待ってから、座標の計算やクリックをする
const settle = () => page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
const reset = async options => {await page.evaluate(options=>window.__helpCapture.reset(options),options ?? {});await settle();};
const point = (x,y) => page.evaluate(([x,y])=>window.__helpCapture.point(x,y),[x,y]);
const move = async (x,y) => { const p=await point(x,y);await page.mouse.move(p.x,p.y); };
const click = async (x,y,options={}) => {const p=await point(x,y);await page.mouse.click(p.x,p.y,options);};
const tool = async id => {
  const panel = await page.locator(`[data-tool="${id}"]`).evaluate(button=>button.closest('.panel')?.dataset.panel);
  if (panel) await tab(panel);
  await page.locator(`[data-tool="${id}"]`).click();
};
const tab = async id => {await page.locator(`[data-tab="${id}"]`).click();await settle();};
const blur = () => page.evaluate(()=>document.activeElement?.blur());
const entities = () => page.evaluate(()=>window.__seizu.doc.entities);
const rect = {type:'rect',x:50,y:70,width:100,height:50};
const circle = {type:'circle',cx:100,cy:100,r:25};
const line = {type:'line',x1:50,y1:80,x2:150,y2:120};
const linear = {type:'dim',dimType:'linear',orient:'h',p1:[50,70],p2:[150,70],offset:55,layer:'dim',lineType:'thin',override:null};
async function shot(key, caption, options={}) {
  let clip;
  if (options.selector) {
    const b=await page.locator(options.selector).boundingBox();
    assert.ok(b,`${key}: missing ${options.selector}`);
    const pad=options.pad ?? 8;
    clip={x:Math.max(0,Math.floor(b.x-pad)),y:Math.max(0,Math.floor(b.y-pad)),width:Math.min(1280-Math.max(0,Math.floor(b.x-pad)),Math.ceil(b.width+pad*2)),height:Math.min(800-Math.max(0,Math.floor(b.y-pad)),Math.ceil(b.height+pad*2))};
  } else if (options.full) clip={x:0,y:0,width:1280,height:800};
  else {
    const p=await point(...(options.center ?? [100,100]));
    const width=options.width ?? 650,height=options.height ?? 330;
    clip={x:Math.max(0,Math.min(1280-width,Math.round(p.x-width/2))),y:Math.max(0,Math.min(800-height,Math.round(p.y-height/2))),width,height};
    // 文字や操作ガイドを途中で切らず、実際の要素の全体を収める。
    for (const selector of ['#cursor-tip', '#text-entry']) {
      if (!(await page.locator(selector).isVisible())) continue;
      const b=await page.locator(selector).boundingBox();
      const right=Math.min(1280,Math.ceil(Math.max(clip.x+clip.width,b.x+b.width+12)));
      const bottom=Math.min(800,Math.ceil(Math.max(clip.y+clip.height,b.y+b.height+12)));
      clip.x=Math.max(0,Math.floor(Math.min(clip.x,b.x-12)));
      clip.y=Math.max(0,Math.floor(Math.min(clip.y,b.y-12)));
      clip.width=right-clip.x;clip.height=bottom-clip.y;
    }
  }
  const marks=[];
  for (const [x,y,n,dx=-20,dy=-24] of options.marks ?? []) {
    const p=await point(x,y);marks.push({x:Math.round(p.x-clip.x),y:Math.round(p.y-clip.y),n,dx,dy});
  }
  for (const [selector,n] of options.controls ?? []) {
    const b=await page.locator(selector).boundingBox();
    assert.ok(b,`${key}: missing control ${selector}`);
    marks.push({x:Math.round(b.x+b.width/2-clip.x),y:Math.round(b.y+b.height/2-clip.y),n,dx:0,dy:-22});
  }
  for (const [x,y,n,dx=0,dy=0] of options.labels ?? []) marks.push({x:x-clip.x,y:y-clip.y,n,dx,dy});
  await page.screenshot({path:path.join(output,`${key}.png`),clip,animations:'disabled'});
  shots[key]={src:`help/screenshots/${key}.png`,width:clip.width,height:clip.height,caption,marks};
  console.log(key);
}
async function control(key,caption,selector,toolId) {
  if(toolId)await tool(toolId);
  await page.mouse.move(1270,790);
  await shot(key,caption,{selector,pad:12});
}
async function finishShot(key,caption,options={}) {
  await page.mouse.move(1270,790);await blur();await shot(key,caption,options);
}
async function drag(x1,y1,x2,y2,button='left') {
  await move(x1,y1);await page.mouse.down({button});await move(x2,y2);await page.mouse.up({button});
}
try {
  await reset({entities:[rect,{type:'circle',cx:100,cy:95,r:12},linear],zoom:2});
  await page.locator('#zoom-fit').click();
  await finishShot('overview','A4横の実画面。①タブ、②共通操作、③選択、④作図ボタン、⑤線種・太さ・文字、⑥用紙、⑦数値入力、⑧状態表示。',{full:true,labels:[[223,20,1,0,72],[1100,20,2,-280,72],[34,55,3,0,40],[405,55,4,0,40],[1105,55,5,0,40],[325,210,6],[610,760,7,25,-22],[385,788,8,0,-25]]});
  for(const name of ['file','draw','annotate','edit','view']) {
    await tab(name);await control(`tab-${name}`,`「${{file:'ファイル',draw:'作図',annotate:'寸法・記号',edit:'編集',view:'表示・設定'}[name]}」タブの実際のボタン。`,'.panel.active');
  }
  await reset({entities:[rect,circle]});
  await click(50,95);await finishShot('selection','輪郭をクリックした矩形が青色で選択される。',{marks:[[50,95,1]]});
  await page.keyboard.down('Shift');await click(125,100);await page.keyboard.up('Shift');
  assert.equal((await page.evaluate(()=>window.__seizu.selection.size)),2);
  await finishShot('selection-multiple','Shiftを押して円もクリックすると、矩形と円をまとめて選択できる。');
  await reset({entities:[rect,circle]});
  await move(40,60);await page.mouse.down();await move(160,130);
  await shot('selection-box','空白からドラッグ。青い破線の枠に全体が入る図形を選ぶ。',{height:360});await page.mouse.up();
  await reset({entities:[rect]});await click(50,95);
  await drag(50,95,75,120);
  assert.equal((await entities())[0].x,75);
  await finishShot('move-after','矩形の輪郭をドラッグして右上へ25mm移動した結果。');
  await reset({entities:[rect]});await click(50,95);await page.keyboard.press('Control+c');await move(170,120);await page.keyboard.press('Control+v');
  assert.equal((await entities()).length,2);
  await finishShot('paste-after','Ctrl+Cでコピーし、マウスの位置にCtrl+Vで貼り付けた結果。',{width:740});
  await reset({entities:[rect]});await move(50,95);await page.mouse.down({button:'right'});await move(80,115);
  await shot('copy-drag','右ボタンを押したまま移動すると、コピー先が緑色の破線枠で表示される。',{width:740});await page.mouse.up({button:'right'});
  await reset({entities:[rect]});await click(50,95,{button:'right'});
  await shot('menu-shape','矩形の上で右クリックした実際のメニュー。',{selector:'.popup-menu',pad:12});
  await page.keyboard.press('Escape');await click(30,140,{button:'right'});
  await shot('menu-empty','空白で右クリックした実際のメニュー。',{selector:'.popup-menu',pad:12});
  await reset();await tool('line');await click(50,80);await move(150,120);
  await shot('line-draft','始点①をクリックして終点②へマウスを動かした途中。緑の破線と実際の操作ガイド。',{width:780,marks:[[50,80,1],[150,120,2,18,-26]]});
  await click(150,120);assert.equal((await entities())[0].type,'line');
  await finishShot('line-result','2回目のクリックで確定した直線。長さ107.70mm、角度21.8°の例。',{marks:[[50,80,1],[150,120,2]]});
  await reset();await tool('line');
  for(const [id,value] of [['num-x','40'],['num-y','30'],['num-len','80'],['num-ang','30']]) await page.locator(`#${id}`).fill(value);
  await shot('numeric-draw','始点X=40、Y=30、長さ=80、角度=30を入力して「作図」を押す。',{selector:'#numpanel',pad:0});
  await page.locator('#num-draw').click();
  await finishShot('numeric-result','数値入力だけで作図した80mm・30°の直線。',{center:[85,65]});
  await reset({entities:[line]});await click(50,80);
  await shot('numeric-line','直線を1つ選ぶと、下の欄が「直線:」「更新」に変わる。',{selector:'#numpanel',pad:0});
  await page.locator('#np-len').fill('80');await page.locator('#np-len').press('Enter');
  assert.ok(Math.abs(Math.hypot((await entities())[0].x2-50,(await entities())[0].y2-80)-80)<1e-4);
  await finishShot('numeric-line-result','長さを80に変更してEnter。始点を保ったまま終点が動く。');
  await reset();await tool('polyline');
  for(const [x,y] of [[50,70],[75,120],[125,120],[150,70]])await click(x,y);
  await move(155,65);await shot('polyline-draft','①→②→③→④とクリックして、Enterで確定する。',{marks:[[50,70,1],[75,120,2],[125,120,3],[150,70,4]]});
  await page.keyboard.press('Enter');await finishShot('polyline-result','Enterで確定した連続線。4つの点で1つの図形になる。');
  await tool('select');await click(100,120);await click(100,120);
  assert.equal(await page.evaluate(()=>window.__seizu.subSel),1);
  await finishShot('segment-selection','選択済みの連続線をもう一度クリックすると、その線分がオレンジ色になる。');
  await shot('numeric-segment','線分2/3の始点X・Y、長さ、角度を個別に編集する欄。',{selector:'#numpanel',pad:0});
  await reset();await tool('rect');await click(50,70);await move(150,120);
  await shot('rect-draft','矩形は①と反対側の角②をクリックする。緑の破線は未確定の形。',{width:770,marks:[[50,70,1],[150,120,2,18,-25]]});await click(150,120);
  await tool('select');await click(50,95);
  await shot('numeric-rect','矩形の左下X・Y、幅=100、高さ=50、回転=0を示す実際の入力欄。',{selector:'#numpanel',pad:0});
  await finishShot('rect-result','幅100mm・高さ50mmの矩形ができた状態。');
  await reset();await tool('circle');await click(100,100);await move(125,100);
  await shot('circle-draft','円の中心①をクリックし、半径25mmの円周②にマウスを置いた途中。',{width:720,marks:[[100,100,1],[125,100,2,18,-26]]});await click(125,100);
  await finishShot('circle-result','確定した円。半径25mmなので直径は50mm。');await tool('select');await click(125,100);
  await shot('numeric-circle','円の数値編集では「半径」ではなく「直径」を入力する。',{selector:'#numpanel',pad:0});
  await reset();await tool('arc');await click(100,90);await click(135,90);await move(100,125);
  await shot('arc-draft','円弧は中心①→開始②→終了③。②から③へ左回りの90°の弧。',{width:780,marks:[[100,90,1],[135,90,2],[100,125,3,-25,-25]]});await click(100,125);
  await finishShot('arc-result','半径35mm、開始0°、終了90°の円弧ができた状態。');
  await reset();await tool('ellipse');await click(100,100);await move(145,125);
  await shot('ellipse-draft','楕円は中心①と外枠の角②。横半径45mm、縦半径25mmの例。',{width:800,marks:[[100,100,1],[145,125,2,18,-25]]});await click(145,125);
  await finishShot('ellipse-result','横半径45mm、縦半径25mmの楕円を確定した結果。');
  await reset();await tool('earc');await click(100,90);await click(145,115);await click(145,90);await move(100,115);
  await shot('earc-draft','楕円弧は中心①→外枠の角②→開始③→終了④の4回クリック。',{width:790,marks:[[100,90,1],[145,115,2,20,-25],[145,90,3,25,30],[100,115,4,-25,-25]]});await click(100,115);
  await finishShot('earc-result','横半径45mm、縦半径25mmの楕円弧ができた状態。');
  await reset();await tool('spline');for(const [x,y] of [[45,80],[80,125],[120,75],[155,115]])await click(x,y);
  await move(160,120);await shot('spline-draft','曲線を通したい点を順にクリックし、Enterで確定する。',{width:790,marks:[[45,80,1],[80,125,2],[120,75,3],[155,115,4,20,-25]]});await page.keyboard.press('Enter');
  await finishShot('spline-result','4点を通るスプライン。完成した曲線は黒い実線で表示される。');
  await reset();await tool('text');await click(70,100);await page.locator('#text-entry').fill('取付板');
  await shot('text-entry','文字の位置①をクリックして、白い入力欄に「取付板」と入力する。',{marks:[[70,100,1,-25,28]]});await page.locator('#text-entry').press('Enter');
  await finishShot('text-result','Enterで確定した文字「取付板」。');
  // 正多角形: 角数 → 中心①・辺の真ん中② → できあがり / 数値入力 / 大きさの決め方の違い
  await reset({zoom:14});await tool('polygon');
  await control('polygon-control','「正多角形」を押し、右の欄に角の数（六角形なら6）を入れる。','[data-panel="draw"] .group:nth-child(2)');
  await click(100,100);await move(100,106.5);
  assert.equal(await page.evaluate(()=>window.__seizu.draft.fit.angleDeg),90);
  await shot('polygon-draft','中心①をクリックし、真上6.5mmの辺の真ん中②へマウスを置いた途中。点線の円は辺に接する円。',{width:640,height:360,marks:[[100,100,1,-30,26],[100,106.5,2,-30,-26]]});
  await click(100,106.5);
  const hex=(await entities())[0];
  assert.equal(hex.type,'polyline');assert.equal(hex.closed,true);assert.equal(hex.points.length,6);
  await finishShot('polygon-result','確定した二面幅13mmの六角形。上と下の辺が平らな向き。',{width:640,height:360});
  for(const [id,value] of [['num-x','90'],['num-y','90'],['num-len','13'],['num-ang','90']]) await page.locator(`#${id}`).fill(value);
  await shot('polygon-numeric','正多角形の道具での数値入力。大きさの欄の名前のメニューで「二面幅」「対角」「一辺」を選ぶ。',{selector:'#numpanel',pad:0});
  {
    // どれも「20」で描いた六角形と、その20がどこを測っているかの寸法
    const hexA=regularPolygonPoints({x:60,y:100},6,20,90,'side');
    const hexB=regularPolygonPoints({x:115,y:100},6,20,0,'corner');
    const hexC=regularPolygonPoints({x:180,y:100},6,20,0,'edge');
    const poly=points=>({type:'polyline',closed:true,points});
    const dim=(p1,p2,orient,offset)=>({type:'dim',dimType:'linear',orient,p1,p2,offset,layer:'dim',lineType:'thin',override:null});
    const label=(x,y,content)=>({type:'text',x,y,content,height:3.5,layer:'note',lineType:'thin'});
    await reset({zoom:4,center:[120,99],entities:[
      poly(hexA),dim(hexA[1],hexA[3],'v',40),label(47,116,'二面幅 20'),
      poly(hexB),dim(hexB[3],hexB[0],'h',84),label(104,112,'対角 20'),
      poly(hexC),dim(hexC[4],hexC[5],'h',74),label(166,122,'一辺 20'),
    ]});
    await finishShot('polygon-modes','どれも大きさ「20」で描いた六角形。二面幅は辺と辺の間、対角は角と角の間、一辺は1つの辺の長さが20mmになる。',{center:[120,99],width:800,height:330});
  }
  await reset({zoom:14});await tool('thread');await page.locator('#thread-size').selectOption('M6');
  await control('thread-control','「ねじ穴」の右で呼びM6を選ぶ。','[data-panel="draw"] .group:last-child');await click(100,100);
  assert.equal((await entities()).length,4);
  await finishShot('thread-result','M6の下穴円・3/4円弧・中心線の十字を同時に作図した実画面。',{marks:[[100,100,1,-35,-35]],width:420,height:300});
  // まとまり(グループ): どれか1つのクリックで4つとも選ばれる → 分解で別々に
  await tool('select');await click(104,100);
  assert.equal(await page.evaluate(()=>window.__seizu.selection.size),4);
  await finishShot('thread-selected','選択ツールで中心線①をクリックすると、ねじ穴の4つの図形がまとめて選ばれる（青色）。',{marks:[[104,100,1,26,-30]],width:420,height:300});
  await tab('edit');await page.locator('#explode').click();
  assert.ok((await entities()).every(e=>e.group==null));
  await blur();await page.keyboard.press('Escape');
  assert.equal(await page.evaluate(()=>window.__seizu.selection.size),0);
  await click(101.77,98.23);
  assert.equal(await page.evaluate(()=>window.__seizu.selection.size),1);
  await finishShot('explode-thread','分解したねじ穴。下穴の円①だけをクリックして選べる（ほかは黒のまま）。',{marks:[[101.77,98.23,1,30,30]],width:420,height:300});
  await reset({entities:[rect]});await click(50,95);await page.keyboard.press('Delete');assert.equal((await entities()).length,0);
  await finishShot('delete-result','矩形を選んでDeleteを押すと、選択した図形が消える。');await page.keyboard.press('Control+z');
  assert.equal((await entities()).length,1);await finishShot('undo-result','Ctrl+Zで削除を取り消すと矩形が戻る。');
  await control('undo-controls','上段の「元に戻す」「やり直し」。キーボードでも同じ操作ができる。','#topbar .quick');
  for(const [id,button,caption] of [['rotate','#rotate','30°左回りに回転した結果。'],['scale','#scale','倍率2で大きさが2倍になった結果。'],['mirror','#mirror-x','左右反転した結果。']]) {
    const shape=id==='mirror'?{type:'polyline',points:[[55,70],[55,120],[145,120],[115,90]],closed:false}:rect;
    await reset({entities:[shape],selection:[1]});await tab('edit');
    if(id==='rotate')await page.locator('#rotate-angle').fill('30');
    await control(`${id}-control`,id==='rotate'?'角度に30を入れ、「回転」を押す。':id==='scale'?'倍率に2を入れ、「拡大縮小」を押す。':'選択した図形に「左右反転」「上下反転」を使う。',id==='mirror'?'[data-panel="edit"] .group:nth-child(2)':'[data-panel="edit"] .group:first-child');
    await finishShot(`${id}-before`,'変更する前の図形。青色は選択中の表示。',{width:880,height:480});
    await page.locator(button).click();await finishShot(`${id}-after`,caption,{width:880,height:480});
  }
  await reset({entities:[rect],selection:[1]});await tab('edit');
  await finishShot('explode-before','分解前の矩形。4辺で1つの図形。');await page.locator('#explode').click();assert.equal((await entities()).length,4);
  // 分解した直後は4本とも選ばれているので、いったん選択を解いてから下辺だけをクリックする
  await blur();await page.keyboard.press('Escape');
  await click(75,70);assert.equal(await page.evaluate(()=>window.__seizu.selection.size),1);
  await finishShot('explode-after','分解後は4本の直線。下辺①だけを選択できる。',{marks:[[75,70,1]]});
  const cross=[{type:'line',x1:45,y1:90,x2:160,y2:90},{type:'line',x1:120,y1:60,x2:120,y2:135}];
  await reset({entities:cross});await tool('trim');await move(145,90);
  await shot('trim-before','交点より右の余分な区間①をクリックして切り取る。',{width:800,marks:[[145,90,1]]});await click(145,90);
  assert.equal((await entities()).length,2);assert.ok((await entities()).some(e=>e.x2===120 && e.y2===90));
  await finishShot('trim-after','トリム後。右の余分な部分だけが消え、交点までの直線が残る。');
  await reset({entities:[{...cross[0],x2:95},cross[1]]});await tool('extend');await move(90,90);
  await shot('extend-before','伸ばしたい側の端に近い所①をクリックする。',{width:800,marks:[[90,90,1]]});await click(90,90);
  assert.equal((await entities())[0].x2,120);await finishShot('extend-after','延長後。直線が右に伸び、縦の直線との交点で止まる。');
  await reset({entities:[{type:'line',x1:50,y1:90,x2:150,y2:90}]});await tool('offset');
  await control('offset-control','「オフセット」の右の距離に10mmを指定する。','[data-panel="edit"] .group:nth-child(4)');await click(90,90);await move(90,110);
  await shot('offset-pick','元の直線①を選んだあと、上側②をクリックしてコピーする。',{width:850,marks:[[90,90,1],[90,110,2,-25,-25]]});await click(90,110);
  assert.equal((await entities()).length,2);await finishShot('offset-after','元の直線を残して、10mm上に平行な直線を作った結果。');
  const corner=[{type:'line',x1:50,y1:75,x2:140,y2:75},{type:'line',x1:140,y1:75,x2:140,y2:135}];
  for(const [id,toolId] of [['fillet','fillet'],['chamfer','chamferEdit']]) {
    await reset({entities:corner});await tool(toolId);await page.locator('#fillet-r').fill('10');
    await control(`${id}-control`,`${id==='fillet'?'フィレット':'面取り'}を選び、サイズに10mmを指定する。`,'[data-panel="edit"] .group:nth-child(5)');
    await move(100,75);await shot(`${id}-before`,'①水平な直線、②縦の直線の順に、残したい側をクリックする。',{width:820,marks:[[100,75,1],[140,110,2,20,-25]]});await click(100,75);await click(140,110);
    assert.equal((await entities()).length,3);await finishShot(`${id}-after`,id==='fillet'?'半径10mmの円弧で角を丸めた結果。':'直角の角を10mmずつ切り落とした結果。');
  }
  await reset({entities:[rect]});await tool('dim');await click(50,70);await click(150,70);await move(100,55);
  await shot('dimension-draft','①左下→②右下→③寸法線を置く位置。緑の破線は配置のプレビュー。',{center:[100,85],width:830,height:430,marks:[[50,70,1],[150,70,2],[100,55,3,20,28]]});await click(100,55);
  await finishShot('dimension-result','幅100mmの矩形に「100」の長さ寸法を配置した結果。',{center:[100,85],height:430});
  await reset({entities:[{type:'line',x1:60,y1:70,x2:140,y2:120}]});await tool('dim');await click(60,70);await click(140,120);await move(100,125);await page.keyboard.down('Shift');await click(100,125);await page.keyboard.up('Shift');
  assert.equal((await entities())[1].orient,'aligned');await finishShot('dimension-aligned','3回目のクリックでShiftを押すと、斜めの直線に平行な寸法になる。',{height:430});
  await reset({entities:[rect,linear]});await tool('select');await move(100,57.5);
  await shot('dimension-text-before','寸法の数字そのものを押したまま、線に沿って移動する。',{center:[110,75],width:820,height:430});await drag(100,57.5,170,57.5);
  assert.ok((await entities())[1].textShift>50);
  await finishShot('dimension-text-after','数字を補助線の外側へ出すと、寸法線が延び、矢印が外側から内向きになる。',{center:[110,75],width:820,height:430});
  await click(170,57.5,{button:'right'});await shot('dimension-text-menu','右クリックの「寸法の値を中央に戻す」で位置を戻せる。',{selector:'.popup-menu',pad:12});
  for(const [id,type] of [['diameter','dia'],['radius','rad']]) {
    await reset({entities:[circle]});await tool(type);await move(120,115);
    await shot(`${id}-pick`,`${type==='dia'?'φ':'R'}を選び、円の線①をクリックする。`,{width:800,marks:[[120,115,1,22,-25]]});await click(120,115);
    assert.equal((await entities())[1].dimType,type);await finishShot(`${id}-result`,type==='dia'?'円の直径50mmを示すφ50の寸法。':'円の半径25mmを示すR25の寸法。');
  }
  await reset({entities:[{type:'line',x1:55,y1:65,x2:155,y2:65},{type:'line',x1:55,y1:65,x2:135,y2:145}]});await tool('angle');
  await click(55,65);await click(145,65);await move(115,125);
  await shot('angle-draft','①頂点→②右の辺→③上の辺。③までの距離が寸法弧の大きさになる。',{width:890,height:430,marks:[[55,65,1],[145,65,2],[115,125,3]]});await click(115,125);
  await finishShot('angle-result','2辺のなす45°の角度寸法。',{height:430});
  await reset({entities:[{type:'line',x1:50,y1:70,x2:130,y2:70},{type:'line',x1:130,y1:70,x2:140,y2:80},{type:'line',x1:140,y1:80,x2:140,y2:130}]});await tool('chamfer');await click(135,75);await move(165,105);
  await shot('chamfer-dimension-draft','①面取りの斜めの直線→②文字の位置。',{width:900,marks:[[135,75,1],[165,105,2,20,-25]]});await click(165,105);
  await finishShot('chamfer-dimension-result','10mmの面取りを示すC10の寸法。',{width:780});
  await reset({entities:[rect,linear]});await click(100,57.5,{clickCount:2});await page.locator('#text-entry').fill('100±0.1');
  await shot('dimension-edit','選択ツールで数字をダブルクリックし、「100±0.1」を入力する。',{center:[100,80],height:430});await page.locator('#text-entry').press('Enter');
  assert.equal((await entities())[1].override,'100±0.1');await finishShot('dimension-edit-result','Enterで確定。形の大きさを変えずに公差付きの表示に変わる。',{center:[100,80],height:430});
  // 矢印の先は円周の斜め45°の点にも吸い付く(半径25mmの円の右上)
  const d45=25/Math.SQRT2;
  await reset({entities:[circle]});await tool('leader');await move(100+d45+0.6,100+d45-0.5);
  assert.equal(await page.evaluate(()=>window.__seizu.snapHint?.kind),'quad');
  await shot('leader-snap45','円の近くでは、円周の上下左右と斜め45°の点にピンクの丸い印が出て吸い付く（右上45°の例）。',{width:720,height:360,marks:[[100+d45,100+d45,1,-30,26]]});
  await click(100+d45+0.6,100+d45-0.5);await click(155,135);await page.locator('#text-entry').fill('φ50 穴');
  await shot('leader-entry','①円周の斜め45°の点→②文字の位置をクリックし、注記を入力する。',{width:930,marks:[[100+d45,100+d45,1],[155,135,2,-25,25]]});await page.locator('#text-entry').press('Enter');
  await finishShot('leader-result','確定した引出線と注記「φ50 穴」。',{width:790});
  for(const [id,value] of [['roughness','Ra 1.6'],['fcf','//|0.02|A']]) {
    await reset({entities:[rect]});await tool(id);await click(80,120);await tool('select');await click(85,123,{clickCount:2});
    // 記号の実際の当たり判定内で編集欄が開くことを確認する。
    if(!(await page.locator('#text-entry').isVisible())) await click(82,125,{clickCount:2});
    await page.locator('#text-entry').fill(value);
    await shot(`${id}-edit`,`${id==='roughness'?'粗さ記号にRa 1.6':'公差枠に//|0.02|A'}を入力する。`,{height:430});await page.locator('#text-entry').press('Enter');
    await finishShot(`${id}-result`,id==='roughness'?'粗さ記号の値をRa 1.6に変更した結果。':'縦棒で区切った3つのマス「//」「0.02」「A」の公差枠。',{height:430});
  }
  await reset({entities:[rect]});await tool('hatch');await control('hatch-control','角度45°・間隔3mmを指定し、矩形の輪郭をクリックする。','[data-panel="annotate"] .group:nth-child(3)');
  await move(50,95);await shot('hatch-before','矩形の輪郭①をクリックする。図形の内側ではなく線の上を狙う。',{width:850,marks:[[50,95,1]]});await click(50,95);
  assert.equal((await entities())[1].type,'hatch');await finishShot('hatch-after','矩形の中に45°の斜線が入った結果。');
  await reset({entities:[rect]});await tool('balloon');await click(80,110);await move(70,140);
  await shot('balloon-draft','①部品を指す位置→②番号の丸の位置。',{width:860,height:430,marks:[[80,110,1],[70,140,2]]});await click(70,140);await click(130,110);await click(145,140);
  await finishShot('balloon-result','1つ目が1、2つ目が2と自動採番されたバルーン。',{height:430});
  await tool('bom');await click(45,55);
  const bom=(await entities()).find(e=>e.type==='bom');assert.equal(bom.rows.length,2);
  await finishShot('bom-created','バルーン1・2の行が自動で入る部品表。クリックした位置①が表の左下。',{center:[95,70],height:360,marks:[[45,55,1,-25,25]]});
  await click(66,66,{clickCount:2});await page.locator('#text-entry').fill('取付板');
  await shot('bom-edit','品名のマスをダブルクリックして「取付板」と入力する。',{center:[95,75],height:360});await page.locator('#text-entry').press('Enter');
  for(const [x,y,value] of [[114,66,'1'],[129,66,'SS400'],[66,58,'ピン'],[114,58,'2'],[129,58,'S45C']]) {await click(x,y,{clickCount:2});await page.locator('#text-entry').fill(value);await page.locator('#text-entry').press('Enter');}
  await finishShot('bom-result','品名・数量・材質を記入した部品表。',{center:[95,75],height:360});
  const styles=[['solid','outline','外形線'],['dashed','hidden','かくれ線'],['chain','center','中心線'],['chain2','outline','想像線'],['thin','outline','細実線'],['thin','aux','補助線']];
  await reset({entities:styles.flatMap(([lineType,layer,name],i)=>[{type:'line',x1:50,y1:140-i*16,x2:130,y2:140-i*16,lineType,layer},{type:'text',x:140,y:138-i*16,content:name,heightMm:3.5,layer:'note'}])});
  await finishShot('line-types','同じ画面倍率で比較した6種類の線。線種ごとの太さと破線間隔も実際の描画。',{center:[120,100],width:800,height:450});
  await tool('line');await page.locator('#line-style').selectOption('hidden');
  await control('style-controls','線種「かくれ線」、太さ「標準」、文字3.5mmの実際のメニュー。','#ribbon .style');
  await reset({entities:[{type:'line',x1:50,y1:100,x2:150,y2:100}, {type:'text',x:75,y:115,content:'取付板',heightMm:3.5}],selection:[1,2]});
  await control('width-controls','選択した図形の「太さ」と「文字」をこのメニューで変更する。','#ribbon .style');
  await finishShot('width-before','標準の線の太さ0.5mm・文字の高さ3.5mm。');await page.locator('#line-width').selectOption('1');await page.locator('#text-size').selectOption('7');
  await finishShot('width-after','太さ1mm・文字7mmに変更した結果。');
  await reset({entities:[rect],projGuides:false});await tool('line');await page.locator('#line-style').selectOption('center');await move(100,125);
  await shot('center-guide','線種「中心線」で辺の中点付近にマウスを置くと、ピンクの中点と十字の軸ガイドが出る。',{width:790,height:400});
  await click(100,140);await click(100,50);await finishShot('center-line','中点を通る軸上へ吸着させ、矩形の外にはみ出して中心線を引いた結果。',{height:430});
  await reset({gridSnap:true});await tab('view');await page.locator('#grid-mode').selectOption('manual');await page.locator('#grid-step').selectOption('5');
  await control('grid-controls','グリッドを「手動」、間隔5mm、スナップと点スナップをオンにした設定。','[data-panel="view"] .group:nth-child(2)');await tool('line');await click(51.2,81.1);await move(149,120);
  assert.equal(await page.evaluate(()=>window.__seizu.draft.start.x),50);
  await shot('grid-draft','方眼5mmに吸着した始点。画面下の状態表示でも手動5mmを確認できる。',{width:800});
  await shot('grid-status','状態表示に「グリッド:5mm(手動)」が表示される。',{selector:'#statusbar',pad:0});
  for(const [id,x,y,caption] of [['end',50,70,'端点はピンクの四角。'],['mid',100,120,'中点はピンクの三角。'],['center',100,95,'中心はピンクの丸。']]) {
    await reset({entities:[rect,{type:'circle',cx:100,cy:95,r:12}]});await tool('line');await move(x,y);
    assert.equal(await page.evaluate(()=>window.__seizu.snapHint?.kind),id);
    await shot(`snap-${id}`,caption,{width:600,height:330});
  }
  await reset({entities:[rect],selection:[1],projGuides:true});await tab('view');await control('projection-controls','投影ガイドをオンにし、必要な場所へ「45°線配置」で奥行きを転写する。','[data-panel="view"] .group:nth-child(3)');
  await finishShot('projection-guides','選択した矩形の特徴点から、縦横に伸びる投影ガイドの実表示。',{width:900,height:500});await tool('mirror45');await click(180,150);
  await finishShot('projection-45','クリックした位置を通る45°線。作図の補助として表示される。',{center:[145,125],width:950,height:500});
  await reset({entities:[rect]});await tool('origin');await move(50,70);await shot('origin-before','原点設定を選び、矩形の左下①をクリックして座標0,0の位置にする。',{width:830,marks:[[50,70,1]]});await click(50,70);
  assert.equal(await page.evaluate(()=>window.__seizu.doc.userOrigin.x),50);await finishShot('origin-after','新しい原点のオレンジ色の印。矩形の位置はそのまま。',{marks:[[50,70,1]]});
  await click(50,95);await shot('origin-numeric','原点を左下に合わせたので、矩形の左下XとYが0.00になる。',{selector:'#numpanel',pad:0});
  await reset({entities:[rect,linear]});await tab('view');await control('paper-controls','用紙A4・横・縮尺1:1の初期設定。','[data-panel="view"] .group:first-child');await page.locator('#zoom-fit').click();
  await finishShot('paper-one','縮尺1:1の図面全体。幅100mmの矩形。',{full:true});await page.locator('#scale-input').fill('1:2');await page.locator('#scale-input').press('Tab');
  await finishShot('paper-half','縮尺1:2では紙の上の図形が半分になり、寸法は実物の100mmのまま。',{full:true});
  await reset({entities:[rect,{type:'line',x1:40,y1:100,x2:160,y2:100,lineType:'chain',layer:'center'}]});await tab('view');await page.locator('#layer-panel summary').click();
  await shot('layer-controls','レイヤーの実際の一覧。「表示」と「印刷」は別々に切り替える。',{selector:'#layer-list',pad:12});
  await page.locator('#layer-list input').nth(4).uncheck();await page.locator('#layer-panel summary').click();
  await finishShot('layer-hidden','中心線レイヤーの「表示」をオフにすると、画面の中心線だけが隠れる。');
  await reset({zoom:5,center:[240,42]});
  await finishShot('title-blank','用紙右下の実際の表題欄。図番・図名・尺度・用紙・材質・作成者・日付の7行。',{center:[240,42],width:650,height:390});
  await click(250,54,{clickCount:2});await page.locator('#text-entry').fill('取付板');
  await shot('title-edit','図名のマスをダブルクリックして入力する。',{center:[240,42],width:650,height:390});await page.locator('#text-entry').press('Enter');
  for(const [y,value] of [[62,'CAD-001'],[30,'SS400'],[22,'製図担当']]) {await click(250,y,{clickCount:2});await page.locator('#text-entry').fill(value);await page.locator('#text-entry').press('Enter');}
  await finishShot('title-result','図番・図名・材質・作成者を記入した結果。尺度と用紙は設定を自動表示する。',{center:[240,42],width:650,height:390});
  await reset({entities:[rect,linear]});await tab('file');await control('file-controls','新規・開く・保存・名前を付けて保存・SVG出力・印刷の実際の並び。','[data-panel="file"]');
  await page.evaluate(()=>{const b=document.getElementById('restore-banner');b.style.display='flex';});
  await shot('restore-banner','未保存の変更が残っている場合に出る実際の復元確認の帯。',{selector:'#restore-banner',pad:0});
  await reset({entities:[rect,linear,{type:'line',x1:40,y1:100,x2:160,y2:100,layer:'aux',lineType:'thin'}]});await tab('file');
  await control('print-controls','「SVG出力」で画像を書き出し、「印刷」から紙やPDFへ出力する。','[data-panel="file"] .group:last-child');
  // 本体の印刷iframeの中身を撮影。ブラウザの印刷ダイアログを模写しない。
  // headlessのprint()はダイアログを出さず、アプリの印刷HTMLを保持する。
  await page.locator('#print').click();
  const iframe=page.frames().find(f=>f!==page.mainFrame());assert.ok(iframe);
  const printHTML=await iframe.content();
  const preview=await browser.newPage({viewport:{width:900,height:650},deviceScaleFactor:1});
  await preview.setContent(printHTML);await preview.evaluate(()=>{document.querySelector('svg').style.width='850px';document.querySelector('svg').style.height='auto';});
  await preview.locator('svg').screenshot({path:path.join(output,'print-result.png')});
  const printBox=await preview.locator('svg').boundingBox();
  shots['print-result']={src:'help/screenshots/print-result.png',width:Math.round(printBox.width),height:Math.round(printBox.height),caption:'アプリが印刷へ渡す実際の図面。方眼・原点・操作ガイド・補助線は出力されない。',marks:[]};
  await preview.close();
  await reset({entities:[rect]});await page.locator('#zoom-fit').click();
  await finishShot('view-fit','「全体」で用紙全体を表示した状態。',{full:true});await move(100,100);await page.keyboard.down('Shift');await page.mouse.wheel(0,-400);await page.keyboard.up('Shift');
  await finishShot('view-zoom','Shift+ホイールでマウス位置を中心に拡大した状態。図形の寸法は変わらない。',{full:true});
  await control('view-controls','右上の「＋」「－」「全体」で画面の倍率を操作する。','#topbar .quick');
  // ヘルプ自体の実画面。スクリーンショットを読み込む前の撮影でも循環参照を起こさない。
  await page.keyboard.press('F1');await page.locator('#help input').fill('円 描く');
  await shot('help-search','検索欄に「円 描く」と入力すると、該当する説明と左の検索結果が表示される。',{selector:'.help-window',pad:0});await page.keyboard.press('Escape');
  await reset();await page.keyboard.press('l');assert.equal(await page.evaluate(()=>window.__seizu.tool),'line');
  await control('key-tool','Lを押すと「作図」タブが開き、「直線」が青く選ばれる。','[data-panel="draw"]');
  await click(50,80);await page.keyboard.press('8');await page.keyboard.type('0');
  await shot('key-length','直線の始点をクリックして80を打つと、「長さ」の欄へ自動で入力される。',{selector:'#numpanel',pad:0});
  assert.deepEqual(errors,[]);
  const inputs=['www/index.html','www/styles.css'];
  const {readdir}=await import('node:fs/promises');
  inputs.push(...(await readdir(path.join(root,'src'))).filter(n=>n.endsWith('.js')&&n!=='helpScreenshots.js').map(n=>`src/${n}`),'scripts/capture-help.mjs');
  const sourceHashes={};
  for(const file of inputs)sourceHashes[file]=createHash('sha256').update((await readFile(path.join(root,file),'utf8')).replace(/\r\n/g,'\n')).digest('hex');
  await writeFile(path.join(root,'src/helpScreenshots.js'),`// npm run help:capture で実画面から生成。手作業で画面を描き直さない。\nexport const HELP_SCREENSHOTS = ${JSON.stringify(shots,null,2)};\n`);
  await writeFile(path.join(output,'provenance.json'),JSON.stringify({viewport:{width:1280,height:800},deviceScaleFactor:1,browser:browser.version(),sourceHashes},null,2)+'\n');
  console.log(`${Object.keys(shots).length} actual screenshots captured`);
} finally {
  await browser.close();await new Promise(resolve=>server.close(resolve));
}
