import assert from 'node:assert/strict';
import test from 'node:test';
import {
  union,
  mergeOrder,
  mergeGenreOverrides,
  buildSyncPlan
} from '../services/profileStore.js';

test('union merges unique ids preserving order', () => {
  const result = union(['a', 'b'], ['b', 'c', 'd']);
  assert.deepEqual(result, ['a', 'b', 'c', 'd']);
});

test('mergeOrder keeps cloud order and appends local-only ids', () => {
  const result = mergeOrder(['x', 'y'], ['y', 'z', 'x', 'q']);
  assert.deepEqual(result, ['x', 'y', 'z', 'q']);
});

test('mergeGenreOverrides prefers cloud keys', () => {
  const result = mergeGenreOverrides({ a: 'rock', b: 'pop' }, { b: 'edm', c: 'jazz' });
  assert.deepEqual(result, { a: 'rock', b: 'edm', c: 'jazz' });
});

test('buildSyncPlan uploads local-only data when cloud is empty', () => {
  const plan = buildSyncPlan({
    cloud: { setlist: [] },
    local: { setlist: ['s1'] }
  });
  assert.equal(plan.cloudEmpty, true);
  assert.equal(plan.localHasData, true);
  assert.equal(plan.shouldWriteCloud, true);
  assert.deepEqual(plan.merged.setlist, ['s1']);
});
