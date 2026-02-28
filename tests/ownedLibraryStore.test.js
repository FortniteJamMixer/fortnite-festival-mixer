import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createOwnedLibraryStore,
  flushOwnedLibraryBeforeLogout
} from '../services/ownedLibraryStore.js';
import {
  buildOwnedLibraryPlan,
  normalizeOwnedLibrarySnapshot
} from '../services/profileStore.js';

const snapshot = (trackIds, updatedAt) => normalizeOwnedLibrarySnapshot({ trackIds, updatedAt });

const createStore = ({
  cache = new Map(),
  cloud = null,
  writeCloud = async () => {},
  getOnline = () => true,
  getCloudEnabled = () => true
} = {}) => createOwnedLibraryStore({
  readCache: (uid) => cache.get(uid) || null,
  writeCache: (uid, snap) => {
    cache.set(uid, snap);
    return snap;
  },
  readCloud: async () => cloud,
  writeCloud,
  buildPlan: buildOwnedLibraryPlan,
  normalizeSnapshot: normalizeOwnedLibrarySnapshot,
  getOnline,
  getCloudEnabled,
  localDebounceMs: 0,
  cloudDebounceMs: 0
});

test('owned library writes local cache after flush', async () => {
  const cache = new Map();
  const store = createStore({ cache, getOnline: () => false, getCloudEnabled: () => false });
  await store.initForUser('u1', { initialTrackIds: [], skipCloud: true });
  store.setManyOwned(['t1', 't2'], true, 'update');
  await store.flush('manual');
  const saved = cache.get('u1');
  assert.deepEqual(saved.trackIds, ['t1', 't2']);
});

test('logout flushes owned library when dirty', async () => {
  const calls = [];
  const store = {
    hasUnsavedChanges: () => true,
    flush: async () => {
      calls.push('flush');
    }
  };
  const signOut = async () => {
    calls.push('signout');
  };
  await flushOwnedLibraryBeforeLogout({ store, signOut });
  assert.deepEqual(calls, ['flush', 'signout']);
});

test('cloud write skips empty list unless explicit clear', async () => {
  const cloudWrites = [];
  const store = createStore({
    writeCloud: async (_uid, snap) => {
      cloudWrites.push(snap);
    }
  });
  await store.initForUser('u1', { initialTrackIds: ['a'], skipCloud: true });
  store.setOwnedList([], 'update');
  await store.flush('update');
  assert.equal(cloudWrites.length, 0);
  store.setOwnedList([], 'explicit_clear', { allowEmpty: true });
  await store.flush('explicit_clear', { allowEmpty: true });
  assert.equal(cloudWrites.length, 1);
  assert.deepEqual(cloudWrites[0].trackIds, []);
});

test('re-login reconcile keeps newer local snapshot and writes cloud', async () => {
  const cache = new Map();
  const cloudWrites = [];
  const cacheSnapshot = snapshot(['local'], '2024-02-10T10:00:00Z');
  cache.set('u1', cacheSnapshot);
  const cloudSnapshot = snapshot(['cloud'], '2024-02-01T10:00:00Z');
  const store = createStore({
    cache,
    cloud: cloudSnapshot,
    writeCloud: async (_uid, snap) => {
      cloudWrites.push(snap);
    }
  });
  await store.initForUser('u1');
  assert.deepEqual(store.getSnapshot().trackIds, ['local']);
  assert.equal(cloudWrites.length, 1);
});
