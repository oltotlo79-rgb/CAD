// 図形のまとまり(グループ)。同じ group 番号を持つ図形は、選択・移動・複製などで1つとして扱う。
// ねじ穴の道具が作る。「分解」で group を外すと別々の図形に戻る。

// 図面で使われていない次のグループ番号
export function nextGroupId(entities) {
  return entities.reduce((m, e) => Math.max(m, Number(e.group) || 0), 0) + 1;
}

function membersByGroup(entities) {
  const map = new Map();
  for (const e of entities) {
    if (e.group == null) continue;
    if (!map.has(e.group)) map.set(e.group, []);
    map.get(e.group).push(e);
  }
  return map;
}

// ids と同じグループの図形もすべて含めた id の集合
export function withGroupMembers(entities, ids) {
  const out = new Set(ids);
  const groups = new Set(entities.filter((e) => out.has(e.id) && e.group != null).map((e) => e.group));
  if (groups.size > 0) {
    for (const e of entities) if (groups.has(e.group)) out.add(e.id);
  }
  return out;
}

// 範囲選択: 枠に入った図形(insideIds)のうち、グループは見えている仲間が全部入った時だけ、
// 隠れた仲間も含めてまとめて選ぶ(グループを1つの図形として「すっぽり入ったか」で判定)
export function groupsFullyInside(entities, insideIds, isVisible = () => true) {
  const inside = new Set(insideIds);
  const groups = membersByGroup(entities);
  const out = new Set();
  for (const e of entities) {
    if (!inside.has(e.id)) continue;
    if (e.group == null) {
      out.add(e.id);
      continue;
    }
    const mates = groups.get(e.group);
    if (mates.filter(isVisible).every((m) => inside.has(m.id))) {
      for (const m of mates) out.add(m.id);
    }
  }
  return out;
}

// ids に含まれる図形のグループを仲間ごと解く。解いたグループの数を返す
export function ungroupEntities(entities, ids) {
  const target = new Set(ids);
  const groups = new Set(entities.filter((e) => target.has(e.id) && e.group != null).map((e) => e.group));
  for (const e of entities) {
    if (groups.has(e.group)) delete e.group;
  }
  return groups.size;
}

// 複製した図形(のプロパティ)のグループを、元と別の新しい番号 firstFreeId, +1, … に付け替える。
// 元が同じグループだった図形どうしは、複製後も同じグループになる
export function renumberGroups(items, firstFreeId) {
  const map = new Map();
  let next = firstFreeId;
  for (const item of items) {
    if (item.group == null) continue;
    if (!map.has(item.group)) map.set(item.group, next++);
    item.group = map.get(item.group);
  }
}
