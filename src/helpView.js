// ヘルプ画面(目次・検索・本文)。本文は helpContent.js の静的なHTML。
import { HELP_CATEGORIES, HELP_TOPICS } from './helpContent.js';

// 検索用に本文からタグを除いた文字列
const plain = (html) => html.replace(/<svg[\s\S]*?<\/svg>/g, ' ').replace(/<[^>]+>/g, ' ');
const SEARCH_TEXT = new Map(HELP_TOPICS.map((t) => [
  t.id, `${t.title} ${(t.keywords ?? []).join(' ')} ${plain(t.html)}`.toLowerCase(),
]));

export function helpTopicForTool(tool) {
  return HELP_TOPICS.find((t) => (t.tools ?? []).includes(tool))?.id ?? null;
}

export function createHelp() {
  let overlay = null;
  let toc = null;
  let article = null;
  let search = null;
  let currentId = HELP_TOPICS[0]?.id ?? null;

  function build() {
    overlay = document.createElement('div');
    overlay.id = 'help';
    overlay.hidden = true;
    overlay.innerHTML = `
      <div class="help-window" role="dialog" aria-modal="true" aria-label="ヘルプ">
        <header>
          <h2>ヘルプ（使い方）</h2>
          <input type="search" placeholder="知りたいことを入力（例: 円、寸法、保存、印刷）">
          <button type="button" class="help-close">閉じる ✕</button>
        </header>
        <div class="help-body">
          <nav class="help-toc"></nav>
          <article class="help-article"></article>
        </div>
      </div>`;
    document.body.append(overlay);
    toc = overlay.querySelector('.help-toc');
    article = overlay.querySelector('.help-article');
    search = overlay.querySelector('input');
    overlay.querySelector('.help-close').addEventListener('click', close);
    // 背景(暗い部分)をクリックで閉じる
    overlay.addEventListener('pointerdown', (ev) => { if (ev.target === overlay) close(); });
    overlay.addEventListener('keydown', (ev) => {
      ev.stopPropagation(); // 図面側のショートカットを効かせない
      if (ev.key === 'Escape') close();
    });
    search.addEventListener('input', renderToc);
    // 目次・本文中のリンク(#help:ID)で項目を切り替える
    overlay.addEventListener('click', (ev) => {
      const a = ev.target.closest('a[href^="#help:"]');
      if (!a) return;
      ev.preventDefault();
      show(a.getAttribute('href').slice('#help:'.length));
    });
  }

  function renderToc() {
    const q = search.value.trim().toLowerCase();
    const words = q.split(/\s+/).filter(Boolean);
    const match = (t) => words.every((w) => SEARCH_TEXT.get(t.id).includes(w));
    toc.innerHTML = '';
    let count = 0;
    for (const cat of HELP_CATEGORIES) {
      const topics = HELP_TOPICS.filter((t) => t.category === cat.id && match(t));
      if (topics.length === 0) continue;
      const h = document.createElement('h4');
      h.textContent = cat.title;
      toc.append(h);
      for (const t of topics) {
        const a = document.createElement('a');
        a.href = `#help:${t.id}`;
        a.textContent = t.title;
        if (t.id === currentId) a.className = 'current';
        toc.append(a);
        count += 1;
      }
    }
    if (count === 0) {
      const empty = document.createElement('div');
      empty.className = 'empty';
      empty.textContent = '見つかりませんでした。別の言葉で探してみてください。';
      toc.append(empty);
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
    overlay.hidden = false;
    show(topicId ?? currentId);
    search.focus();
  }

  function close() {
    if (overlay) overlay.hidden = true;
  }

  return { open, close, isOpen: () => !!overlay && !overlay.hidden };
}
