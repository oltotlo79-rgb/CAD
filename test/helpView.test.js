import { test } from 'node:test';
import assert from 'node:assert/strict';
import { searchHelpTopics } from '../src/helpView.js';

test('ヘルプ検索は項目名を本文中の一致より優先する', () => {
  assert.equal(searchHelpTopics('保存')[0].id, 'saveOpen');
  assert.equal(searchHelpTopics('矩形')[0].id, 'rect');
});

test('ヘルプ検索は複数語と該当なしを扱う', () => {
  assert.equal(searchHelpTopics('円 描く')[0].id, 'circle');
  assert.deepEqual(searchHelpTopics('存在しない語'), []);
});
