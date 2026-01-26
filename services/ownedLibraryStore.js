const DEFAULT_LOCAL_DEBOUNCE_MS = 150;
const DEFAULT_CLOUD_DEBOUNCE_MS = 900;

const toSortedArray = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) return [...new Set(value)].filter(Boolean).sort();
  return Array.from(value).filter(Boolean).sort();
};

const normalizeSnapshotWithFallback = (normalizeSnapshot, trackIds, updatedAt, meta = null, libraryVersion = 0) => {
  const payload = {
    trackIds: toSortedArray(trackIds),
    updatedAt: updatedAt || new Date().toISOString(),
    libraryVersion,
    ...(meta ? { meta } : {})
  };
  if (typeof normalizeSnapshot === 'function') {
    return normalizeSnapshot(payload);
  }
  return {
    ...payload,
    count: payload.trackIds.length,
    schemaVersion: 1,
    libraryVersion,
    hash: payload.trackIds.join('|')
  };
};

const createOwnedLibraryStore = ({
  readCache,
  writeCache,
  readCloud,
  writeCloud,
  readBackup,
  writeBackup,
  cleanupBackups,
  buildPlan,
  normalizeSnapshot,
  getOnline = () => true,
  getCloudEnabled = () => false,
  readLastGoodCount,
  writeLastGoodCount,
  readLastSyncAt,
  writeLastSyncAt,
  readLastBackupAt,
  writeLastBackupAt,
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
  let lastKnownRemoteCount = 0;
  let libraryVersion = 0;

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
    const snapshot = normalizeSnapshotWithFallback(normalizeSnapshot, trackIds, new Date().toISOString(), { reason }, libraryVersion);
    writeCache(uid, snapshot);
    if (typeof writeLastGoodCount === 'function') {
      writeLastGoodCount(uid, snapshot.trackIds.length);
    }
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
    if (ids.length === 0 && lastKnownRemoteCount > 0 && !allowEmpty) {
      pendingCloudWrite = { reason, allowEmpty: false };
      return null;
    }
    const snapshot = normalizeSnapshotWithFallback(normalizeSnapshot, ids, new Date().toISOString(), { reason }, libraryVersion);
    await writeCloud(uid, snapshot);
    lastKnownRemoteCount = ids.length;
    if (typeof writeLastSyncAt === 'function') {
      writeLastSyncAt(uid, Date.now());
    }
    if (typeof writeBackup === 'function') {
      const lastBackupAt = typeof readLastBackupAt === 'function' ? readLastBackupAt(uid) : null;
      const now = Date.now();
      if (!lastBackupAt || now - Number(lastBackupAt) > 24 * 60 * 60 * 1000) {
        await writeBackup(uid, snapshot);
        if (typeof cleanupBackups === 'function') {
          await cleanupBackups(uid, 10);
        }
        if (typeof writeLastBackupAt === 'function') {
          writeLastBackupAt(uid, now);
        }
      }
    }
    pendingCloudWrite = null;
    lastSavedAt = Date.now();
    return snapshot;
  };

  const runSave = async (reason, options = {}) => {
    clearTimeout(localTimer);
    clearTimeout(cloudTimer);
    isSaving = true;
    updateStatus({ phase: 'saving', source: getOnline() ? 'cloud' : 'device', message: 'Syncing library…' });
    try {
      persistLocal(reason);
      const allowEmpty = options.allowEmpty === true || reason === 'explicit_clear';
      await persistCloud(reason, { allowEmpty });
      const offline = !getOnline();
      const cloudPaused = !getCloudEnabled();
      if (offline) {
        updateStatus({ phase: 'ready', source: 'device', message: 'Offline — showing last saved library' });
      } else if (cloudPaused) {
        updateStatus({ phase: 'ready', source: 'local', message: 'Sync paused' });
      } else {
        updateStatus({ phase: 'ready', source: 'cloud', message: 'Synced ✅' });
      }
    } catch (err) {
      console.warn('[owned-library] save failed', err);
      updateStatus({ phase: 'ready', source: 'device', message: 'Couldn’t sync — your library is safe locally' });
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
        updateStatus({ phase: 'ready', source: getOnline() ? 'local' : 'device', message: getOnline() ? 'Synced ✅' : 'Offline — showing last saved library' });
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
    libraryVersion += 1;
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
    lastKnownRemoteCount = 0;
    libraryVersion = 0;
    isBooting = true;
    updateStatus({ phase: 'syncing', source: 'none', message: 'Syncing library…' });

    const cachedSnapshot = typeof readCache === 'function' && uid ? readCache(uid) : null;
    const cachedLastGood = typeof readLastGoodCount === 'function' && uid ? readLastGoodCount(uid) : null;
    if (Number.isFinite(cachedLastGood)) {
      lastKnownRemoteCount = cachedLastGood;
    }
    const legacySnapshot = legacyOwnedTracks.length
      ? normalizeSnapshotWithFallback(normalizeSnapshot, legacyOwnedTracks, new Date().toISOString(), { reason: 'legacy' }, libraryVersion)
      : null;
    const initialSnapshot = initialTrackIds.length
      ? normalizeSnapshotWithFallback(normalizeSnapshot, initialTrackIds, new Date().toISOString(), { reason: 'initial' }, libraryVersion)
      : null;
    let localSnapshot = cachedSnapshot || initialSnapshot || legacySnapshot || null;
    if (localSnapshot?.libraryVersion) {
      libraryVersion = localSnapshot.libraryVersion;
    }

    if (localSnapshot?.trackIds?.length) {
      trackIds = new Set(localSnapshot.trackIds);
      emitSnapshot();
      updateStatus({ phase: 'syncing', source: 'cache', message: 'Syncing library…' });
    }

    if (!uid || skipCloud || !getCloudEnabled() || !getOnline() || typeof readCloud !== 'function' || typeof buildPlan !== 'function') {
      if (localSnapshot && !cachedSnapshot && typeof writeCache === 'function') {
        writeCache(uid, localSnapshot);
      }
      isBooting = false;
      const offline = !getOnline();
      const cloudPaused = !getCloudEnabled();
      updateStatus({
        phase: 'ready',
        source: localSnapshot?.trackIds?.length ? 'cache' : 'local',
        message: offline ? 'Offline — showing last saved library' : cloudPaused ? 'Sync paused' : 'Synced ✅'
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
      if (cloudSnapshot) {
        if (cloudSnapshot.trackIds?.length) {
          lastKnownRemoteCount = cloudSnapshot.trackIds.length;
        }
        libraryVersion = Math.max(libraryVersion, cloudSnapshot.libraryVersion || 0);
      }
      let backupSnapshot = null;
      if (!cloudSnapshot?.trackIds?.length && typeof readBackup === 'function') {
        try {
          backupSnapshot = await readBackup(uid);
        } catch (err) {
          console.warn('[owned-library] backup read failed', err);
        }
      }
      const plan = buildPlan({ cache: localSnapshot, cloud: cloudSnapshot, backup: backupSnapshot });
      if (plan?.chosen?.trackIds) {
        trackIds = new Set(plan.chosen.trackIds);
        libraryVersion = plan.chosen.libraryVersion || libraryVersion;
      }
      emitSnapshot();
      if (plan?.shouldUpdateCache && typeof writeCache === 'function') {
        writeCache(uid, plan.chosen);
      }
      if ((plan?.shouldSeedCloud || plan?.shouldWriteCloud) && plan?.chosen?.trackIds?.length) {
        await writeCloud(uid, plan.chosen);
        lastKnownRemoteCount = plan.chosen.trackIds.length;
        if (typeof writeLastSyncAt === 'function') {
          writeLastSyncAt(uid, Date.now());
        }
        if (typeof writeBackup === 'function') {
          await writeBackup(uid, plan.chosen);
          if (typeof cleanupBackups === 'function') {
            await cleanupBackups(uid, 10);
          }
          if (typeof writeLastBackupAt === 'function') {
            writeLastBackupAt(uid, Date.now());
          }
        }
      }
      const recovered = plan?.recovered;
      if (recovered) {
        updateStatus({ phase: 'ready', source: plan?.source || 'local', message: 'Recovered your library from backup ✅' });
      } else {
        updateStatus({
          phase: 'ready',
          source: plan?.source || 'local',
          message: getOnline() ? 'Synced ✅' : 'Offline — showing last saved library'
        });
      }
    } catch (err) {
      console.warn('[owned-library] reconcile failed', err);
      updateStatus({
        phase: 'ready',
        source: localSnapshot?.trackIds?.length ? 'cache' : 'local',
        message: 'Couldn’t sync — your library is safe locally'
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
