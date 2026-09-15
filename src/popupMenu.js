// 右クリックメニューの表示(項目の中身は menuModel.js が決める)。
// 子項目を持つ行はマウスを乗せると右側に子メニューを開く。
export function createPopupMenu(onSelect) {
  let root = null;

  function close() {
    if (!root) return;
    root.forEach((m) => m.remove());
    root = null;
    document.removeEventListener('pointerdown', onOutside, true);
  }
  // メニューの外を押したら閉じるだけにする(図面側で作図や選択が始まらないように)
  function onOutside(ev) {
    if (root && !root.some((m) => m.contains(ev.target))) {
      ev.stopPropagation();
      close();
    }
  }

  // 画面からはみ出さないように位置を調整
  function place(menu, x, y, flipX) {
    menu.style.left = `${x}px`;
    menu.style.top = `${y}px`;
    const r = menu.getBoundingClientRect();
    if (r.right > window.innerWidth - 4) menu.style.left = `${Math.max(4, flipX - r.width)}px`;
    if (r.bottom > window.innerHeight - 4) menu.style.top = `${Math.max(4, window.innerHeight - r.height - 4)}px`;
  }

  function build(items, x, y, flipX, level) {
    const menu = document.createElement('div');
    menu.className = 'popup-menu';
    menu.setAttribute('role', 'menu');
    menu.addEventListener('contextmenu', (ev) => ev.preventDefault());
    document.body.append(menu);
    root.push(menu);
    // この階層より深い子メニューを閉じる
    const closeDeeper = () => {
      for (const m of root.splice(level + 1)) m.remove();
    };
    for (const item of items) {
      if (item.separator) {
        const sep = document.createElement('div');
        sep.className = 'sep';
        menu.append(sep);
        continue;
      }
      const row = document.createElement('div');
      row.className = `item${item.disabled ? ' disabled' : ''}`;
      row.setAttribute('role', 'menuitem');
      const check = document.createElement('span');
      check.textContent = item.checked ? '✓' : '';
      const label = document.createElement('span');
      label.textContent = item.label;
      const key = document.createElement('span');
      key.className = 'key';
      key.textContent = item.children ? '▶' : (item.key ?? '');
      row.append(check, label, key);
      if (item.children) {
        row.addEventListener('pointerenter', () => {
          closeDeeper();
          const r = row.getBoundingClientRect();
          build(item.children, r.right - 2, r.top - 4, r.left + 2, level + 1);
        });
      } else {
        row.addEventListener('pointerenter', closeDeeper);
        row.addEventListener('click', () => {
          if (item.disabled) return;
          close();
          onSelect(item.id);
        });
      }
      menu.append(row);
    }
    place(menu, x, y, flipX);
  }

  return {
    open(items, clientX, clientY) {
      close();
      root = [];
      build(items, clientX, clientY, clientX, 0);
      // 開いたときの右クリック自体で閉じないよう、次の操作から外側クリックを監視
      setTimeout(() => document.addEventListener('pointerdown', onOutside, true), 0);
    },
    close,
    isOpen: () => root !== null,
  };
}
