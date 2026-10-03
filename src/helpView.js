// ヘルプ画面(目次・検索・本文)。本文は helpContent.js の静的なHTML。
import { HELP_CATEGORIES, HELP_TOPICS } from './helpContent.js';

// 検索用に本文からタグを除いた文字列
const plain = (html) => html.replace(/<svg[\s\S]*?<\/svg>/g, ' ').replace(/<[^>]+>/g, ' ');
const SEARCH_INDEX = HELP_TOPICS.map((topic, index) => ({
  topic,
  index,
  title: topic.title.toLowerCase(),
  heading: `${topic.title} ${(topic.keywords ?? []).join(' ')}`.toLowerCase(),
  all: `${topic.title} ${(topic.keywords ?? []).join(' ')} ${plain(topic.html)}`.toLowerCase(),
}));

export function searchHelpTopics(query) {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return HELP_TOPICS;
  return SEARCH_INDEX
    .filter((entry) => words.every((word) => entry.all.includes(word)))
    .sort((a, b) => {
      const rank = (entry) => words.every((word) => entry.title.includes(word)) ? 0
        : words.every((word) => entry.heading.includes(word)) ? 1 : 2;
      return rank(a) - rank(b) || a.index - b.index;
    })
    .map((entry) => entry.topic);
}

export function helpTopicForTool(tool) {
  return HELP_TOPICS.find((t) => (t.tools ?? []).includes(tool))?.id ?? null;
}

export function createHelp() {
  let overlay = null;
  let toc = null;
  let article = null;
  let search = null;
  let currentId = HELP_TOPICS[0]?.id ?? null;
  let previousFocus = null;
  let figureDialog = null;
  let figureFocus = null;

  function build() {
    overlay = document.createElement('div');
    overlay.id = 'help';
    overlay.hidden = true;
    overlay.innerHTML = `
      <div class="help-window" role="dialog" aria-modal="true" aria-label="ヘルプ">
        <header>
          <h2>ヘルプ（使い方）</h2>
          <input type="search" aria-label="ヘルプを検索" placeholder="検索（例：円、寸法、保存、印刷）">
          <button type="button" class="help-close">閉じる ✕</button>
        </header>
        <div class="help-body">
          <nav class="help-toc"></nav>
          <article class="help-article"></article>
        </div>
      </div>
      <dialog class="help-figure-dialog" aria-label="ヘルプの図を拡大">
        <header><h2>実画面の拡大図</h2><button type="button" class="help-figure-fit" aria-pressed="false">原寸で見る</button><button type="button" class="help-figure-close">図を閉じる ✕</button></header>
        <p class="help-figure-caption"></p>
        <div class="help-figure-detail"></div>
      </dialog>`;
    document.body.append(overlay);
    toc = overlay.querySelector('.help-toc');
    article = overlay.querySelector('.help-article');
    search = overlay.querySelector('input');
    figureDialog = overlay.querySelector('dialog');
    const closeFigure = () => {
      figureDialog.close();
      figureFocus?.focus?.();
    };
    overlay.querySelector('.help-figure-close').addEventListener('click', closeFigure);
    overlay.querySelector('.help-figure-fit').addEventListener('click', (ev) => {
      const original = figureDialog.classList.toggle('original-size');
      ev.currentTarget.textContent = original ? '画面に合わせる' : '原寸で見る';
      ev.currentTarget.setAttribute('aria-pressed', String(original));
    });
    figureDialog.addEventListener('cancel', (ev) => { ev.preventDefault(); closeFigure(); });
    overlay.querySelector('.help-close').addEventListener('click', close);
    // 背景(暗い部分)をクリックで閉じる
    overlay.addEventListener('pointerdown', (ev) => { if (ev.target === overlay) close(); });
    overlay.addEventListener('keydown', (ev) => {
      ev.stopPropagation(); // 図面側のショートカットを効かせない
      if (ev.key === 'Escape') {
        ev.preventDefault();
        if (figureDialog.open) closeFigure();
        else close();
      }
      if (ev.key === 'Tab' && !figureDialog.open) {
        const focusable = [...overlay.querySelectorAll('.help-window button, .help-window input, .help-window a[href]')];
        const first = focusable[0], last = focusable.at(-1);
        if (ev.shiftKey && document.activeElement === first) { ev.preventDefault(); last?.focus(); }
        else if (!ev.shiftKey && document.activeElement === last) { ev.preventDefault(); first?.focus(); }
      }
    });
    search.addEventListener('input', () => {
      if (!search.value.trim()) { show(currentId); return; }
      const results = searchHelpTopics(search.value);
      if (results.length) show(results[0].id);
      else {
        article.innerHTML = '<h1>見つかりませんでした</h1><p>別の言葉で検索してください。</p>';
        renderToc();
      }
    });
    // 目次・本文中のリンク(#help:ID)で項目を切り替える
    overlay.addEventListener('click', (ev) => {
      const figure = ev.target.closest('.help-figure-open');
      if (figure) {
        figureFocus = figure;
        figureDialog.querySelector('.help-figure-detail').replaceChildren(figure.querySelector('svg').cloneNode(true));
        figureDialog.querySelector('.help-figure-caption').textContent = figure.closest('figure').querySelector('figcaption').textContent;
        figureDialog.classList.remove('original-size');
        const fit = figureDialog.querySelector('.help-figure-fit');
        fit.textContent = '原寸で見る';
        fit.setAttribute('aria-pressed', 'false');
        figureDialog.showModal();
        return;
      }
      const a = ev.target.closest('a[href^="#help:"]');
      if (!a) return;
      ev.preventDefault();
      if (article.contains(a)) search.value = '';
      show(a.getAttribute('href').slice('#help:'.length));
    });
  }

  function renderToc() {
    const q = search.value.trim();
    const results = searchHelpTopics(q);
    toc.innerHTML = '';
    const addLink = (t, showCategory = false) => {
      const a = document.createElement('a');
      a.href = `#help:${t.id}`;
      a.textContent = t.title;
      if (t.id === currentId) {
        a.className = 'current';
        a.setAttribute('aria-current', 'page');
      }
      if (showCategory) {
        const category = document.createElement('small');
        category.textContent = HELP_CATEGORIES.find((c) => c.id === t.category)?.title ?? '';
        a.append(category);
      }
      toc.append(a);
    };
    if (q) {
      const count = document.createElement('p');
      count.className = 'help-search-count';
      count.setAttribute('aria-live', 'polite');
      count.textContent = `${results.length}件の説明`;
      toc.append(count);
      for (const t of results) addLink(t, true);
      if (results.length) return;
      const empty = document.createElement('div');
      empty.className = 'empty';
      empty.textContent = '別の言葉で探してみてください。';
      toc.append(empty);
      return;
    }
    const guide = document.createElement('p');
    guide.className = 'help-toc-guide';
    guide.textContent = '項目を選ぶか、上の欄で検索';
    toc.append(guide);
    for (const cat of HELP_CATEGORIES) {
      const topics = results.filter((t) => t.category === cat.id);
      if (topics.length === 0) continue;
      const h = document.createElement('h4');
      h.textContent = cat.title;
      toc.append(h);
      for (const t of topics) addLink(t);
    }
  }

  function show(id) {
    const topic = HELP_TOPICS.find((t) => t.id === id) ?? HELP_TOPICS[0];
    if (!topic) return;
    currentId = topic.id;
    article.innerHTML = `<h1></h1>${topic.html}`;
    article.querySelector('h1').textContent = topic.title;
    article.scrollTop = 0;
    renderToc();
  }

  function open(topicId) {
    if (!overlay) build();
    previousFocus = document.activeElement;
    overlay.hidden = false;
    search.value = '';
    show(topicId ?? currentId);
    search.focus();
  }

  function close() {
    if (figureDialog?.open) figureDialog.close();
    if (overlay) overlay.hidden = true;
    previousFocus?.focus?.();
  }

  return { open, close, isOpen: () => !!overlay && !overlay.hidden };
}
