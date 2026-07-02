import { test } from 'node:test';
import assert from 'node:assert/strict';
import { serialize, deserialize } from '../src/serializer.js';
import { createDocument, addEntity } from '../src/model.js';

test('serialize→deserialize でエンティティと設定が保たれる', () => {
  const doc = createDocument({ paperSize: 'A4', orientation: 'portrait' });
  doc.scale.ratio = [1, 5];
  addEntity(doc, { type: 'line', x1: 0, y1: 0, x2: 100, y2: 0 });
  const restored = deserialize(serialize(doc));
  assert.deepEqual(restored, doc);
});

test('format が違うファイルは拒否する', () => {
  assert.throws(() => deserialize('{"format":"other","version":1}'), /図面ファイルではありません/);
});

test('未対応バージョンは拒否する', () => {
  assert.throws(() => deserialize('{"format":"seizu-tool","version":99}'), /未対応/);
});

test('JSONですらないテキストは拒否する', () => {
  assert.throws(() => deserialize('hello'), /JSON/);
});

test('欠けている設定は既定値で補完される', () => {
  const restored = deserialize('{"format":"seizu-tool","version":1,"entities":[]}');
  assert.deepEqual(restored.grid, { mode: 'auto', manualMm: 1 });
  assert.equal(restored.layers.length, 6);
  assert.equal(restored.nextId, 1);
});

test('nextId が欠けていても既存エンティティの最大id+1に復元される', () => {
  const restored = deserialize(
    '{"format":"seizu-tool","version":1,"entities":[{"id":7,"type":"line","x1":0,"y1":0,"x2":1,"y2":0}]}'
  );
  assert.equal(restored.nextId, 8);
});
