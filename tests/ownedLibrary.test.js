import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildOwnedLibraryPlan,
  normalizeOwnedLibrarySnapshot
} from '../services/profileStore.js';

const snapshot = (trackIds, updatedAt = null) => normalizeOwnedLibrarySnapshot({
  trackIds,
  updatedAt
});

test('owned library seeds cloud when cache exists and cloud missing', () => {
  const cache = snapshot(['t1', 't2'], '2024-01-02T10:00:00Z');
  const plan = buildOwnedLibraryPlan({ cache, cloud: null });
  assert.equal(plan.source, 'cache');
  assert.equal(plan.shouldSeedCloud, true);
  assert.deepEqual(plan.chosen.trackIds, ['t1', 't2']);
});

test('owned library hydrates cache when cloud exists and cache missing', () => {
  const cloud = snapshot(['c1'], '2024-01-02T10:00:00Z');
  const plan = buildOwnedLibraryPlan({ cache: null, cloud });
  assert.equal(plan.source, 'cloud');
  assert.equal(plan.shouldUpdateCache, true);
  assert.deepEqual(plan.chosen.trackIds, ['c1']);
});

test('owned library prefers newer cloud snapshot', () => {
  const cache = snapshot(['a'], '2024-01-01T10:00:00Z');
  const cloud = snapshot(['a', 'b'], '2024-01-05T10:00:00Z');
  const plan = buildOwnedLibraryPlan({ cache, cloud });
  assert.equal(plan.source, 'cloud');
  assert.equal(plan.shouldUpdateCache, true);
  assert.equal(plan.shouldWriteCloud, false);
  assert.deepEqual(plan.chosen.trackIds, ['a', 'b']);
});

test('owned library prefers newer cache snapshot and queues cloud write', () => {
  const cache = snapshot(['x', 'y'], '2024-01-05T10:00:00Z');
  const cloud = snapshot(['x'], '2024-01-01T10:00:00Z');
  const plan = buildOwnedLibraryPlan({ cache, cloud });
  assert.equal(plan.source, 'cache');
  assert.equal(plan.shouldWriteCloud, true);
  assert.deepEqual(plan.chosen.trackIds, ['x', 'y']);
});

test('owned library never prefers empty snapshot over non-empty', () => {
  const cache = snapshot(['owned']);
  const cloud = snapshot([]);
  const plan = buildOwnedLibraryPlan({ cache, cloud });
  assert.equal(plan.source, 'cache');
  assert.deepEqual(plan.chosen.trackIds, ['owned']);
});
