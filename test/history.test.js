import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createHistory, snapshot, pushSnapshot, undo, redo, applySnapshot,
} from '../src/history.js';
import { createDocument, addEntity } from '../src/model.js';

test('undo で直前の状態に戻り redo でやり直せる', () => {
  const doc = createDocument();
  const h = createHistory();

  pushSnapshot(h, snapshot(doc));           // 変更前を積む
  addEntity(doc, { type: 'line', x1: 0, y1: 0, x2: 10, y2: 0 });
  assert.equal(doc.entities.length, 1);

  const s1 = undo(h, snapshot(doc));
  applySnapshot(doc, s1);
  assert.equal(doc.entities.length, 0);

  const s2 = redo(h, snapshot(doc));
  applySnapshot(doc, s2);
  assert.equal(doc.entities.length, 1);
});

test('スタックが空のときは null を返す', () => {
  const h = createHistory();
  assert.equal(undo(h, '{}'), null);
  assert.equal(redo(h, '{}'), null);
});

test('新しい変更を積むと redo は消える', () => {
  const doc = createDocument();
  const h = createHistory();
  pushSnapshot(h, snapshot(doc));
  addEntity(doc, { type: 'line', x1: 0, y1: 0, x2: 1, y2: 0 });
  undo(h, snapshot(doc));
  pushSnapshot(h, snapshot(doc)); // 新しい変更
  assert.equal(redo(h, snapshot(doc)), null);
});

test('上限を超えると古いスナップショットから捨てる', () => {
  const h = createHistory(2);
  pushSnapshot(h, 'a');
  pushSnapshot(h, 'b');
  pushSnapshot(h, 'c');
  assert.equal(h.undoStack.length, 2);
  assert.deepEqual(h.undoStack, ['b', 'c']);
});

test('applySnapshot は userOrigin と nextId も復元する', () => {
  const doc = createDocument();
  const before = snapshot(doc);
  doc.userOrigin = { x: 50, y: 50 };
  addEntity(doc, { type: 'line', x1: 0, y1: 0, x2: 1, y2: 0 });
  applySnapshot(doc, before);
  assert.deepEqual(doc.userOrigin, { x: 10, y: 10 });
  assert.equal(doc.nextId, 1);
});
