const PICKER_OPTS = {
  types: [{
    description: '製図ツール図面 (JSON)',
    accept: { 'application/json': ['.json'] },
  }],
};

function downloadText(text, name) {
  const blob = new Blob([text], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function openViaInput() {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.onchange = async () => {
      const f = input.files[0];
      resolve(f ? { name: f.name, text: await f.text() } : null);
    };
    input.click();
  });
}

async function writeHandle(handle, text) {
  const writable = await handle.createWritable();
  await writable.write(text);
  await writable.close();
}

export function createFileIO() {
  let handle = null;
  return {
    hasHandle: () => handle !== null,
    reset() { handle = null; },
    adoptHandle(h) { handle = h; },

    // 戻り値 { name, text } / キャンセル時 null
    async open() {
      if (window.showOpenFilePicker) {
        try {
          const [h] = await window.showOpenFilePicker(PICKER_OPTS);
          handle = h;
          const f = await h.getFile();
          return { name: f.name, text: await f.text() };
        } catch (err) {
          if (err.name === 'AbortError') return null;
          throw err;
        }
      }
      return openViaInput();
    },

    // 戻り値: 保存したファイル名 / キャンセル時 null
    async save(text, suggestedName) {
      if (handle) {
        await writeHandle(handle, text);
        return handle.name;
      }
      return this.saveAs(text, suggestedName);
    },

    async saveAs(text, suggestedName) {
      if (window.showSaveFilePicker) {
        try {
          handle = await window.showSaveFilePicker({ ...PICKER_OPTS, suggestedName });
        } catch (err) {
          if (err.name === 'AbortError') return null;
          throw err;
        }
        await writeHandle(handle, text);
        return handle.name;
      }
      downloadText(text, suggestedName);
      return suggestedName;
    },
  };
}
