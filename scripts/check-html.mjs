// 圧縮前後のHTMLをfile://で開き、全ヘルプのDOM・画像・画面を比較する。
import { chromium } from 'playwright';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import path from 'node:path';
import { HELP_TOPICS } from '../src/helpContent.js';
import {
  escapeInlineScript, unescapeInlineScript, minifyBundle, INLINE_SCRIPT,
} from './dist-js.mjs';

const root=path.resolve(import.meta.dirname,'..');
const hash=content=>createHash('sha256').update(content).digest('hex');
const files=['seizu.html','seizu.readable.html'];
// 改行コード(取り出した側のPCでCRLFになる)は比べない
const html=await Promise.all(files.map(async file=>(await readFile(path.join(root,'dist',file),'utf8')).replace(/\r\n/g,'\n')));
const scriptPattern=/<script>[\s\S]*?<\/script>/g;
assert.equal(html[0].replace(scriptPattern,'<script></script>'),html[1].replace(scriptPattern,'<script></script>'),'JavaScript以外のHTML/CSSは完全一致');
assert.notEqual(html[0].match(scriptPattern)[0],html[1].match(scriptPattern)[0],'JavaScriptの圧縮前後だけが異なる');
const readableJs=unescapeInlineScript(html[1].match(INLINE_SCRIPT)[1]);
assert.equal(html[0].match(INLINE_SCRIPT)[1].trimEnd(),escapeInlineScript(await minifyBundle(readableJs)).trimEnd(),'圧縮版のJavaScriptは非圧縮版をそのまま圧縮したもの');
const output=path.join(root,'.tmp/help-qa');
await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true});
const snapshots=[];
try {
  for(const file of files) {
    const context=await browser.newContext({viewport:{width:1280,height:900},deviceScaleFactor:1});
    const page=await context.newPage();
    const errors=[],external=[];
    page.on('pageerror',error=>errors.push(error.message));
    page.on('request',request=>{if(/^https?:/.test(request.url()))external.push(request.url());});
    await page.goto(pathToFileURL(path.join(root,'dist',file)).href);
    await page.evaluate(()=>document.fonts.ready);
    // タブの切り替えでボタンの段数が変わっても、作図領域の大きさにアプリが追従する(マウス位置のずれ防止)
    for(const name of ['edit','view','annotate','file','draw']) {
      await page.locator(`[data-tab="${name}"]`).click();
      await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
      const fits=await page.evaluate(()=>{
        const box=document.getElementById('canvas').getBoundingClientRect();const view=window.__seizu.view;
        return Math.abs(box.width-view.canvasWidth)<0.5&&Math.abs(box.height-view.canvasHeight)<0.5;
      });
      assert.ok(fits,`${file}: 「${name}」タブでも作図領域の大きさとアプリの座標計算が一致`);
    }
    await page.locator('#help-open').click();
    await page.waitForSelector('#help:not([hidden])');
    const topics=[];
    for(const topic of HELP_TOPICS) {
      await page.locator(`.help-toc a[href="#help:${topic.id}"]`).click();
      const content=await page.locator('.help-article').innerHTML();
      const figures=await page.locator('.help-article figure').count();
      assert.ok(figures>=2,`${file}: ${topic.id}は2図以上`);
      assert.ok(!content.includes('<!--help-figure'),`${file}: ${topic.id}の図は展開済み`);
      const decoded=await page.locator('.help-article svg image').evaluateAll(async images=>{
        return Promise.all(images.map(async element=>{
          const src=element.getAttribute('href');
          const image=new Image();image.src=src;await image.decode();
          return {inline:src.startsWith('data:image/png;base64,'),width:image.naturalWidth,height:image.naturalHeight,w:Number(element.getAttribute('width')),h:Number(element.getAttribute('height'))};
        }));
      });
      assert.equal(decoded.length,figures,`${file}: 全図に実画面がある`);
      for(const image of decoded) {
        assert.ok(image.inline,`${file}: ${topic.id}の画像はHTMLに埋込済み`);
        assert.equal(image.width,image.w,`${topic.id}: 実画像の幅と表示座標が一致`);
        assert.equal(image.height,image.h,`${topic.id}: 実画像の高さと表示座標が一致`);
      }
      const overflow=await page.locator('.help-article').evaluate(el=>el.scrollWidth>el.clientWidth+1);
      assert.equal(overflow,false,`${file}: ${topic.id}の横方向はみ出し`);
      const layout=await page.locator('.help-article').evaluate(article=>{
        const origin=article.getBoundingClientRect();
        return [...article.querySelectorAll('h1,h3,p,li,figure,svg')].map(el=>{
          const box=el.getBoundingClientRect();
          return [el.tagName,...[box.x-origin.x,box.y-origin.y,box.width,box.height].map(n=>Math.round(n*1000)/1000)];
        });
      });
      topics.push({id:topic.id,figures,dom:hash(content),layout:hash(JSON.stringify(layout))});
    }
    await page.locator('.help-toc a[href="#help:intro"]').click();
    await page.locator('.help-article svg image').evaluateAll(async images=>{
      await Promise.all(images.map(async element=>{const image=new Image();image.src=element.getAttribute('href');await image.decode();}));
    });
    const overview=await page.locator('.help-article').screenshot();
    await writeFile(path.join(output,`${file}-intro.png`),overview);
    await page.locator('.help-figure-open').first().click();
    assert.ok(await page.locator('.help-figure-dialog').isVisible());
    assert.equal(await page.locator('.help-figure-detail svg').count(),1);
    await page.locator('.help-figure-fit').click();
    assert.ok(await page.locator('.help-figure-dialog').evaluate(el=>el.classList.contains('original-size')));
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('.help-figure-dialog').isVisible(),false);
    assert.ok(await page.locator('#help').isVisible(),'Escは先に拡大図だけを閉じる');
    assert.equal(await page.locator('.help-figure-open').first().evaluate(el=>el===document.activeElement),true,'元の図ボタンへフォーカス復帰');
    await page.locator('#help input').fill('円 描く');
    assert.equal(await page.locator('.help-article h1').innerText(),'円を描く');
    await page.locator('#help input').fill('存在しない語句');
    assert.equal(await page.locator('.help-article h1').innerText(),'見つかりませんでした');
    await page.keyboard.press('Escape');
    // 道具を使っているときはF1でその説明を直接開く。
    await page.locator('[data-tool="circle"]').click();await page.keyboard.press('F1');
    assert.equal(await page.locator('.help-article h1').innerText(),'円を描く');
    await page.locator('.help-window').screenshot({path:path.join(output,`${file}-circle.png`)});
    await page.setViewportSize({width:640,height:800});
    await page.locator('.help-toc a[href="#help:line"]').click();
    assert.equal(await page.locator('.help-article').evaluate(el=>el.scrollWidth>el.clientWidth+1),false,'狭い画面でも図と本文が収まる');
    await page.locator('.help-window').screenshot({path:path.join(output,`${file}-narrow.png`)});
    assert.deepEqual(errors,[],`${file}: 実行時エラーなし`);
    assert.deepEqual(external,[],`${file}: 外部通信なし`);
    snapshots.push({topics});
    await context.close();
    console.log(`${file}: ${topics.length} topics, ${topics.reduce((n,t)=>n+t.figures,0)} figures verified`);
  }
  assert.deepEqual(snapshots[0],snapshots[1],'全ヘルプのDOM・画像のバイト列・画面レイアウトが圧縮前後で一致');
  console.log('HTML/CSS, all help content, embedded image bytes and layout: identical; only JavaScript minification differs.');
} finally {await browser.close();}
