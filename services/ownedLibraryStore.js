const DEFAULT_LOCAL_DEBOUNCE_MS = 150;
const DEFAULT_CLOUD_DEBOUNCE_MS = 900;

const toSortedArray = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) return [...new Set(value)].filter(Boolean).sort();
  return Array.from(value).filter(Boolean).sort();
};

const normalizeSnapshotWithFallback = (normalizeSnapshot, trackIds, updatedAt, meta = null) => {
  const payload = {
    trackIds: toSortedArray(trackIds),
    updatedAt: updatedAt || new Date().toISOString(),
    ...(meta ? { meta } : {})
  };
  if (typeof normalizeSnapshot === 'function') {
    return normalizeSnapshot(payload);
  }
  return {
    ...payload,
    count: payload.trackIds.length,
    schemaVersion: 1,
    hash: payload.trackIds.join('|')
  };
};

const createOwnedLibraryStore = ({
  readCache,
  writeCache,
  readCloud,
  writeCloud,
  buildPlan,
  normalizeSnapshot,
  getOnline = () => true,
  getCloudEnabled = () => false,
  localDebounceMs = DEFAULT_LOCAL_DEBOUNCE_MS,
  cloudDebounceMs = DEFAULT_CLOUD_DEBOUNCE_MS,
  onSnapshot = () => {},
  onStatus = () => {}
} = {}) => {
  let uid = null;
  let trackIds = new Set();
  let dirty = false;
  let dirtySince = null;
  let isBooting = false;
  let isSaving = false;
  let lastSavedAt = null;
  let savePromise = null;
  let pendingCloudWrite = null;
  let localTimer = null;
  let cloudTimer = null;
  let status = { phase: 'idle', source: 'none', message: '' };

  const updateStatus = (next) => {
    status = { ...status, ...next };
    onStatus({ ...status });
  };

  const emitSnapshot = () => {
    const snapshot = { trackIds: toSortedArray(trackIds), count: trackIds.size };
    onSnapshot(snapshot);
    return snapshot;
  };

  const markDirty = () => {
    dirty = true;
    if (!dirtySince) dirtySince = Date.now();
  };

  const clearDirty = () => {
    dirty = false;
    dirtySince = null;
  };

  const canUseCloud = () => Boolean(uid && getCloudEnabled() && getOnline());

  const persistLocal = (reason) => {
    if (!uid || typeof writeCache !== 'function') return null;
    const snapshot = normalizeSnapshotWithFallback(normalizeSnapshot, trackIds, new Date().toISOString(), { reason });
    writeCache(uid, snapshot);
    lastSavedAt = Date.now();
    clearDirty();
    return snapshot;
  };

  const persistCloud = async (reason, { allowEmpty = false } = {}) => {
    if (!canUseCloud() || typeof writeCloud !== 'function') {
      pendingCloudWrite = { reason, allowEmpty };
      return null;
    }
    const ids = toSortedArray(trackIds);
    if (ids.length === 0 && !allowEmpty) {
      pendingCloudWrite = { reason, allowEmpty };
      return null;
    }
    const snapshot = normalizeSnapshotWithFallback(normalizeSnapshot, ids, new Date().toISOString(), { reason });
    await writeCloud(uid, snapshot);
    pendingCloudWrite = null;
    lastSavedAt = Date.now();
    return snapshot;
  };

  const runSave = async (reason, options = {}) => {
    clearTimeout(localTimer);
    clearTimeout(cloudTimer);
    isSaving = true;
    updateStatus({ phase: 'saving', source: getOnline() ? 'cloud' : 'device', message: 'Saving…' });
    try {
      persistLocal(reason);
      const allowEmpty = options.allowEmpty === true || reason === 'explicit_clear';
      await persistCloud(reason, { allowEmpty });
      const offline = !getOnline();
      const cloudPaused = !getCloudEnabled();
      if (offline) {
        updateStatus({ phase: 'ready', source: 'device', message: 'Saved to device ✓' });
      } else if (cloudPaused) {
        updateStatus({ phase: 'ready', source: 'local', message: 'Sync paused' });
      } else {
        updateStatus({ phase: 'ready', source: 'cloud', message: 'Saved ✓' });
      }
    } catch (err) {
      console.warn('[owned-library] save failed', err);
      updateStatus({ phase: 'ready', source: 'device', message: 'Saved to device ✓' });
      pendingCloudWrite = { reason, allowEmpty: options.allowEmpty === true || reason === 'explicit_clear' };
    } finally {
      isSaving = false;
    }
  };

  const enqueueSave = (reason, options = {}) => {
    const task = async () => runSave(reason, options);
    const chained = (savePromise || Promise.resolve()).then(task);
    savePromise = chained.catch(() => {}).then(() => {
      if (savePromise === chained) savePromise = null;
    });
    return chained;
  };

  const scheduleLocalSave = (reason) => {
    clearTimeout(localTimer);
    localTimer = setTimeout(() => {
      persistLocal(reason);
      if (!isSaving && !pendingCloudWrite) {
        updateStatus({ phase: 'ready', source: getOnline() ? 'local' : 'device', message: getOnline() ? 'Saved ✓' : 'Saved to device ✓' });
      }
    }, localDebounceMs);
  };

  const scheduleCloudSave = (reason) => {
    clearTimeout(cloudTimer);
    cloudTimer = setTimeout(() => {
      enqueueSave(reason).catch(() => {});
    }, cloudDebounceMs);
  };

  const setTrackIds = (ids, { reason = 'update', allowEmpty = false } = {}) => {
    const next = toSortedArray(ids);
    const current = toSortedArray(trackIds);
    if (JSON.stringify(next) === JSON.stringify(current)) return { skipped: true, reason: 'identical' };
    trackIds = new Set(next);
    markDirty();
    emitSnapshot();
    scheduleLocalSave(reason);
    scheduleCloudSave(reason);
    if (next.length === 0 && !allowEmpty && reason !== 'explicit_clear') {
      pendingCloudWrite = { reason, allowEmpty: false };
    }
    return { savedLocal: true, queued: true };
  };

  const updateOwned = (trackId, owned, reason = 'toggle') => {
    if (!trackId) return { skipped: true, reason: 'missing_id' };
    const next = new Set(trackIds);
    if (owned) {
      next.add(trackId);
    } else {
      next.delete(trackId);
    }
    return setTrackIds(Array.from(next), { reason });
  };

  const initForUser = async (nextUid, { legacyOwnedTracks = [], initialTrackIds = [], skipCloud = false } = {}) => {
    uid = nextUid || null;
    trackIds = new Set();
    dirty = false;
    dirtySince = null;
    pendingCloudWrite = null;
    isBooting = true;
    updateStatus({ phase: 'restoring', source: 'none', message: 'Restoring your library…' });

    const cachedSnapshot = typeof readCache === 'function' && uid ? readCache(uid) : null;
    const legacySnapshot = legacyOwnedTracks.length
      ? normalizeSnapshotWithFallback(normalizeSnapshot, legacyOwnedTracks, new Date().toISOString(), { reason: 'legacy' })
      : null;
    const initialSnapshot = initialTrackIds.length
      ? normalizeSnapshotWithFallback(normalizeSnapshot, initialTrackIds, new Date().toISOString(), { reason: 'initial' })
      : null;
    let localSnapshot = cachedSnapshot || initialSnapshot || legacySnapshot || null;

    if (localSnapshot?.trackIds?.length) {
      trackIds = new Set(localSnapshot.trackIds);
      emitSnapshot();
      updateStatus({ phase: 'restoring', source: 'cache', message: 'Restoring your library… Using cached library.' });
    }

    if (!uid || skipCloud || !getCloudEnabled() || !getOnline() || typeof readCloud !== 'function' || typeof buildPlan !== 'function') {
      if (localSnapshot && !cachedSnapshot && typeof writeCache === 'function') {
        writeCache(uid, localSnapshot);
      }
      isBooting = false;
      updateStatus({
        phase: 'ready',
        source: localSnapshot?.trackIds?.length ? 'cache' : 'local',
        message: localSnapshot?.trackIds?.length ? 'Library loaded (Cached)' : 'Library loaded (Local)'
      });
      return emitSnapshot();
    }

    try {
      let cloudSnapshot = null;
      try {
        cloudSnapshot = await readCloud(uid);
      } catch (err) {
        console.warn('[owned-library] cloud read failed', err);
      }
      const plan = buildPlan({ cache: localSnapshot, cloud: cloudSnapshot });
      if (plan?.chosen?.trackIds) {
        trackIds = new Set(plan.chosen.trackIds);
      }
      emitSnapshot();
      if (plan?.shouldUpdateCache && typeof writeCache === 'function') {
        writeCache(uid, plan.chosen);
      }
      if ((plan?.shouldSeedCloud || plan?.shouldWriteCloud) && plan?.chosen?.trackIds?.length) {
        await writeCloud(uid, plan.chosen);
      }
      const sourceLabel = plan?.source === 'cloud' ? 'Cloud' : plan?.source === 'cache' ? 'Cached' : 'Local';
      updateStatus({ phase: 'ready', source: plan?.source || 'local', message: `Library loaded (${sourceLabel})` });
    } catch (err) {
      console.warn('[owned-library] reconcile failed', err);
      updateStatus({
        phase: 'ready',
        source: localSnapshot?.trackIds?.length ? 'cache' : 'local',
        message: localSnapshot?.trackIds?.length ? 'Library loaded (Cached)' : 'Library loaded (Local)'
      });
    } finally {
      isBooting = false;
    }

    return emitSnapshot();
  };

  const flush = async (reason = 'manual', options = {}) => {
    return enqueueSave(reason, options);
  };

  const getSnapshot = () => ({ trackIds: toSortedArray(trackIds), count: trackIds.size });

  const hasUnsavedChanges = () => dirty || Boolean(pendingCloudWrite) || isSaving;

  return {
    initForUser,
    setOwned: (trackId, owned) => updateOwned(trackId, owned, 'toggle'),
    toggleOwned: (trackId) => updateOwned(trackId, !trackIds.has(trackId), 'toggle'),
    setOwnedList: (ids, reason = 'update', { allowEmpty = false } = {}) => (
      setTrackIds(ids, { reason, allowEmpty })
    ),
    setManyOwned: (ids, owned, reason = 'update') => {
      const base = new Set(trackIds);
      (Array.isArray(ids) ? ids : []).forEach((id) => {
        if (!id) return;
        if (owned) base.add(id);
        else base.delete(id);
      });
      return setTrackIds(Array.from(base), { reason });
    },
    markAllOwned: (ids) => setTrackIds(ids, { reason: 'mark_all' }),
    clearAllOwned: () => setTrackIds([], { reason: 'explicit_clear', allowEmpty: true }),
    flush,
    getSnapshot,
    hasUnsavedChanges,
    getStatus: () => ({ ...status }),
    getMeta: () => ({
      dirty,
      dirtySince,
      isBooting,
      isSaving,
      lastSavedAt,
      savePromise,
      uid
    })
  };
};

const flushOwnedLibraryBeforeLogout = async ({ store, signOut, setBusy }) => {
  const needsFlush = store?.hasUnsavedChanges?.() === true;
  if (needsFlush && typeof setBusy === 'function') setBusy(true);
  try {
    if (needsFlush) {
      await store.flush('logout');
    }
  } finally {
    if (needsFlush && typeof setBusy === 'function') setBusy(false);
  }
  if (typeof signOut === 'function') {
    await signOut();
  }
};

export {
  createOwnedLibraryStore,
  flushOwnedLibraryBeforeLogout,
  DEFAULT_LOCAL_DEBOUNCE_MS,
  DEFAULT_CLOUD_DEBOUNCE_MS
};

if (typeof window !== 'undefined') {
  window.ownedLibraryStore = {
    createOwnedLibraryStore,
    flushOwnedLibraryBeforeLogout,
    DEFAULT_LOCAL_DEBOUNCE_MS,
    DEFAULT_CLOUD_DEBOUNCE_MS
  };
}
