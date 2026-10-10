import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  nextGroupId, withGroupMembers, groupsFullyInside, ungroupEntities, renumberGroups,
} from '../src/groups.js';

// ねじ穴(グループ1)・単独の直線・別のねじ穴(グループ2)
const sample = () => [
  { id: 1, type: 'circle', group: 1, layer: 'outline' },
  { id: 2, type: 'arc', group: 1, layer: 'outline' },
  { id: 3, type: 'line', group: 1, layer: 'center' },
  { id: 4, type: 'line', layer: 'outline' },
  { id: 5, type: 'circle', group: 2, layer: 'outline' },
  { id: 6, type: 'line', group: 2, layer: 'center' },
];
const sorted = (set) => [...set].sort((a, b) => a - b);

test('nextGroupId: 使われていない次の番号(グループがなければ1)', () => {
  assert.equal(nextGroupId([]), 1);
  assert.equal(nextGroupId([{ id: 1, type: 'line' }]), 1);
  assert.equal(nextGroupId(sample()), 3);
});

test('withGroupMembers: 1つ選ぶと同じグループの図形もすべて含める', () => {
  const ents = sample();
  assert.deepEqual(sorted(withGroupMembers(ents, [2])), [1, 2, 3]);
  assert.deepEqual(sorted(withGroupMembers(ents, [4])), [4]);
  assert.deepEqual(sorted(withGroupMembers(ents, [4, 6])), [4, 5, 6]);
  assert.deepEqual(sorted(withGroupMembers(ents, [])), []);
});

test('groupsFullyInside: グループは見えている仲間が全部枠に入った時だけ(隠れた仲間ごと)選ぶ', () => {
  const ents = sample();
  // 下穴の円だけが枠に入った → ねじ穴は選ばない。単独の直線は選ぶ
  assert.deepEqual(sorted(groupsFullyInside(ents, [1, 4])), [4]);
  // 3つとも入った → グループ全体
  assert.deepEqual(sorted(groupsFullyInside(ents, [1, 2, 3])), [1, 2, 3]);
  // 中心線レイヤーが非表示なら、見えている円と円弧が入れば隠れた中心線も含めて選ぶ
  const visible = (e) => e.layer !== 'center';
  assert.deepEqual(sorted(groupsFullyInside(ents, [1, 2, 5], visible)), [1, 2, 3, 5, 6]);
});

test('ungroupEntities: 選んだ図形のグループを仲間ごと解き、解いた数を返す', () => {
  const ents = sample();
  assert.equal(ungroupEntities(ents, [2, 4]), 1);
  assert.deepEqual(ents.filter((e) => e.group != null).map((e) => e.id), [5, 6]);
  assert.ok(!('group' in ents[0]));
  assert.equal(ungroupEntities(ents, [4]), 0);
});

test('renumberGroups: 複製したグループに元と別の新しい番号を振る(同じ元→同じ新番号)', () => {
  const clones = [
    { type: 'circle', group: 1 }, { type: 'line', group: 1 },
    { type: 'line' }, { type: 'circle', group: 2 },
  ];
  renumberGroups(clones, 7);
  assert.deepEqual(clones.map((c) => c.group), [7, 7, undefined, 8]);
});
