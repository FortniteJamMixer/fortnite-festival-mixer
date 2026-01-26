const PROFILE_CACHE_KEY = 'ffjm_profile_cache_v1';
const OWNED_TRACKS_CACHE_VERSION = 'v1';
const OWNED_TRACKS_CACHE_KEY_PREFIX = 'ownedTracksCache';
const OWNED_TRACKS_META_KEY_PREFIX = 'ownedTracksMeta';
const OWNED_TRACKS_LOCAL_BACKUP_KEY_PREFIX = 'ownedTracksBackup';
const OWNED_LIBRARY_SCHEMA_VERSION = 1;

const normalizeArray = (value) => {
  if (!Array.isArray(value)) return [];
  return value.filter(Boolean);
};

const normalizeObject = (value) => (value && typeof value === 'object' ? value : {});
const normalizeBoolean = (value) => value === true;
const normalizeStreamUrl = (value) => {
  if (typeof value !== 'string') return '';
  return value.trim();
};
const resolveLiveStartedAt = (profile) => profile.liveStartedAt || profile.liveSince || null;

const normalizeProfile = (profile = {}) => ({
  uid: profile.uid || '',
  email: profile.email || '',
  djName: profile.djName || '',
  streamUrl: normalizeStreamUrl(profile.streamUrl || ''),
  isLive: normalizeBoolean(profile.isLive),
  liveStartedAt: resolveLiveStartedAt(profile),
  ownedTracks: normalizeArray(profile.ownedTracks),
  setlist: normalizeArray(profile.setlist),
  genreOverrides: normalizeObject(profile.genreOverrides),
  bandMembers: normalizeArray(profile.bandMembers).filter(Boolean),
  createdAt: profile.createdAt,
  updatedAt: profile.updatedAt,
  migratedFromLocalAt: profile.migratedFromLocalAt ?? null
});

const normalizeOwnedTrackIds = (value) => {
  const arr = Array.isArray(value) ? value.filter(Boolean).map((item) => String(item)) : [];
  return Array.from(new Set(arr)).sort();
};

const computeOwnedTracksHash = (trackIds = []) => {
  const str = trackIds.join('|');
  let hash = 5381;
  for (let i = 0; i < str.length; i += 1) {
    hash = ((hash << 5) + hash) + str.charCodeAt(i);
    hash &= 0xffffffff;
  }
  return `${hash}`;
};

const normalizeOwnedLibrarySnapshot = (snapshot = {}) => {
  const trackIds = normalizeOwnedTrackIds(snapshot.trackIds || snapshot.ownedTracks || []);
  const count = Number.isFinite(snapshot.count) ? snapshot.count : trackIds.length;
  const schemaVersion = snapshot.schemaVersion || OWNED_LIBRARY_SCHEMA_VERSION;
  const updatedAt = snapshot.updatedAt ?? null;
  const hash = snapshot.hash || computeOwnedTracksHash(trackIds);
  const libraryVersion = Number.isFinite(snapshot.libraryVersion)
    ? snapshot.libraryVersion
    : Number(snapshot.libraryVersion) || 0;
  return {
    trackIds,
    count,
    schemaVersion,
    updatedAt,
    hash,
    libraryVersion
  };
};

const parseUpdatedAt = (value) => {
  if (!value) return null;
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? null : parsed;
  }
  if (typeof value === 'object') {
    if (typeof value.toDate === 'function') {
      return value.toDate().getTime();
    }
    if (Number.isFinite(value.seconds)) {
      return value.seconds * 1000;
    }
  }
  return null;
};

const getOwnedTracksCacheKey = (uid) => `${OWNED_TRACKS_CACHE_KEY_PREFIX}:${uid || 'anonymous'}`;
const getLegacyOwnedTracksCacheKey = (uid) => `ownedTracks:${OWNED_TRACKS_CACHE_VERSION}:${uid || 'anonymous'}`;
const getOwnedTracksMetaKey = (uid, field) => `${OWNED_TRACKS_META_KEY_PREFIX}:${field}:${uid || 'anonymous'}`;
const getOwnedTracksBackupKey = (uid) => `${OWNED_TRACKS_LOCAL_BACKUP_KEY_PREFIX}:${uid || 'anonymous'}`;

const readLocalProfileCache = () => {
  if (typeof localStorage === 'undefined') return {};
  const raw = localStorage.getItem(PROFILE_CACHE_KEY);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return normalizeProfile(parsed);
  } catch (err) {
    console.warn('[profileStore] Failed to parse local cache', err);
    return {};
  }
};

const writeLocalProfileCache = (profile) => {
  if (typeof localStorage === 'undefined') return;
  const existing = readLocalProfileCache();
  const merged = normalizeProfile({ ...existing, ...profile });
  localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(merged));
};

const readOwnedTracksCache = (uid) => {
  if (typeof localStorage === 'undefined' || !uid) return null;
  const key = getOwnedTracksCacheKey(uid);
  const raw = localStorage.getItem(key) || localStorage.getItem(getLegacyOwnedTracksCacheKey(uid));
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    const normalized = normalizeOwnedLibrarySnapshot(parsed);
    localStorage.setItem(key, JSON.stringify(normalized));
    return normalized;
  } catch (err) {
    console.warn('[profileStore] Failed to parse owned tracks cache', err);
    return null;
  }
};

const writeOwnedTracksCache = (uid, snapshot) => {
  if (typeof localStorage === 'undefined' || !uid) return null;
  const normalized = normalizeOwnedLibrarySnapshot(snapshot);
  localStorage.setItem(getOwnedTracksCacheKey(uid), JSON.stringify(normalized));
  return normalized;
};

const readOwnedTracksMetaField = (uid, field) => {
  if (typeof localStorage === 'undefined' || !uid) return null;
  const raw = localStorage.getItem(getOwnedTracksMetaKey(uid, field));
  if (!raw) return null;
  const parsed = Number(raw);
  return Number.isNaN(parsed) ? raw : parsed;
};

const writeOwnedTracksMetaField = (uid, field, value) => {
  if (typeof localStorage === 'undefined' || !uid) return;
  localStorage.setItem(getOwnedTracksMetaKey(uid, field), String(value ?? ''));
};

const readLastGoodOwnedCount = (uid) => readOwnedTracksMetaField(uid, 'lastGoodOwnedCount');
const writeLastGoodOwnedCount = (uid, value) => writeOwnedTracksMetaField(uid, 'lastGoodOwnedCount', value);
const readLastSyncAt = (uid) => readOwnedTracksMetaField(uid, 'lastSyncAt');
const writeLastSyncAt = (uid, value) => writeOwnedTracksMetaField(uid, 'lastSyncAt', value);
const readLastSyncHash = (uid) => readOwnedTracksMetaField(uid, 'lastSyncHash');
const writeLastSyncHash = (uid, value) => writeOwnedTracksMetaField(uid, 'lastSyncHash', value);
const readLastBackupAt = (uid) => readOwnedTracksMetaField(uid, 'lastBackupAt');
const writeLastBackupAt = (uid, value) => writeOwnedTracksMetaField(uid, 'lastBackupAt', value);
const readLastLocalBackupAt = (uid) => readOwnedTracksMetaField(uid, 'lastLocalBackupAt');
const writeLastLocalBackupAt = (uid, value) => writeOwnedTracksMetaField(uid, 'lastLocalBackupAt', value);

const readOwnedTracksBackup = (uid) => {
  if (typeof localStorage === 'undefined' || !uid) return null;
  const raw = localStorage.getItem(getOwnedTracksBackupKey(uid));
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return normalizeOwnedLibrarySnapshot(parsed);
  } catch (err) {
    console.warn('[profileStore] Failed to parse owned tracks backup', err);
    return null;
  }
};

const writeOwnedTracksBackup = (uid, snapshot) => {
  if (typeof localStorage === 'undefined' || !uid) return null;
  const normalized = normalizeOwnedLibrarySnapshot(snapshot);
  localStorage.setItem(getOwnedTracksBackupKey(uid), JSON.stringify(normalized));
  return normalized;
};

let firestoreRef = null;
let firebaseRef = null;

const setFirestore = (firestoreInstance) => {
  firestoreRef = firestoreInstance;
};

const setFirebase = (firebaseInstance) => {
  firebaseRef = firebaseInstance;
};

const readCloudProfile = async (uid) => {
  if (!firestoreRef || !uid) return null;
  const doc = await firestoreRef.collection('users').doc(uid).get();
  if (!doc.exists) return null;
  return normalizeProfile({ uid, ...doc.data() });
};

const readOwnedLibraryDoc = async (uid) => {
  if (!firestoreRef || !uid) return null;
  const doc = await firestoreRef.collection('users').doc(uid).collection('library').doc('owned').get();
  if (!doc.exists) return null;
  return normalizeOwnedLibrarySnapshot(doc.data());
};

const writeCloudProfile = async (uid, patch) => {
  if (!firestoreRef || !uid) return;
  const serverTimestamp = firebaseRef?.firestore?.FieldValue?.serverTimestamp;
  const payload = {
    ...patch,
    updatedAt: serverTimestamp ? serverTimestamp() : new Date().toISOString()
  };
  await firestoreRef.collection('users').doc(uid).set(payload, { merge: true });
};

const writeOwnedLibraryDoc = async (uid, snapshot) => {
  if (!firestoreRef || !uid) return null;
  const serverTimestamp = firebaseRef?.firestore?.FieldValue?.serverTimestamp;
  const normalized = normalizeOwnedLibrarySnapshot(snapshot);
  const meta = snapshot?.meta && typeof snapshot.meta === 'object' ? snapshot.meta : null;
  const payload = {
    trackIds: normalized.trackIds,
    count: normalized.trackIds.length,
    schemaVersion: OWNED_LIBRARY_SCHEMA_VERSION,
    libraryVersion: normalized.libraryVersion || 0,
    hash: normalized.hash,
    updatedAt: serverTimestamp ? serverTimestamp() : new Date().toISOString(),
    ...(meta ? { meta } : {})
  };
  await firestoreRef.collection('users').doc(uid).collection('library').doc('owned').set(payload, { merge: true });
  return payload;
};

const writeOwnedLibraryBackup = async (uid, snapshot) => {
  if (!firestoreRef || !uid) return null;
  const normalized = normalizeOwnedLibrarySnapshot(snapshot);
  const serverTimestamp = firebaseRef?.firestore?.FieldValue?.serverTimestamp;
  const payload = {
    trackIds: normalized.trackIds,
    count: normalized.trackIds.length,
    schemaVersion: OWNED_LIBRARY_SCHEMA_VERSION,
    libraryVersion: normalized.libraryVersion || 0,
    hash: normalized.hash,
    createdAt: serverTimestamp ? serverTimestamp() : new Date().toISOString(),
    updatedAt: normalized.updatedAt ?? null
  };
  const docId = `${Date.now()}`;
  await firestoreRef.collection('users').doc(uid).collection('backups').doc(docId).set(payload);
  return payload;
};

const readLatestOwnedLibraryBackup = async (uid) => {
  if (!firestoreRef || !uid) return null;
  const snapshot = await firestoreRef.collection('users').doc(uid)
    .collection('backups')
    .orderBy('createdAt', 'desc')
    .limit(1)
    .get();
  const doc = snapshot.docs[0];
  if (!doc?.exists) return null;
  return normalizeOwnedLibrarySnapshot(doc.data());
};

const cleanupOwnedLibraryBackups = async (uid, keep = 10) => {
  if (!firestoreRef || !uid) return;
  const snapshot = await firestoreRef.collection('users').doc(uid)
    .collection('backups')
    .orderBy('createdAt', 'desc')
    .get();
  const docsToDelete = snapshot.docs.slice(keep);
  if (!docsToDelete.length) return;
  const batch = firestoreRef.batch();
  docsToDelete.forEach((doc) => batch.delete(doc.ref));
  if (docsToDelete.length) {
    await batch.commit();
  }
};

const union = (primary = [], secondary = []) => {
  const seen = new Set();
  const merged = [];
  [...primary, ...secondary].forEach((item) => {
    if (!item || seen.has(item)) return;
    seen.add(item);
    merged.push(item);
  });
  return merged;
};

const mergeOrder = (cloud = [], local = []) => union(cloud, local);

const mergeGenreOverrides = (local = {}, cloud = {}) => ({
  ...normalizeObject(local),
  ...normalizeObject(cloud)
});

const mergeBandMembers = (cloud = [], local = []) => {
  const merged = [];
  const seen = new Set();
  const addMember = (member) => {
    if (!member || typeof member !== 'object') return;
    const key = member.uid || member.djName;
    if (!key || seen.has(key)) return;
    seen.add(key);
    merged.push(member);
  };
  cloud.forEach(addMember);
  local.forEach(addMember);
  return merged;
};

const hasMeaningfulProfileData = (profile = {}) => {
  if (!profile) return false;
  const streamUrl = normalizeStreamUrl(profile.streamUrl || '');
  return Boolean(
    streamUrl ||
    (profile.setlist && profile.setlist.length) ||
    (profile.genreOverrides && Object.keys(profile.genreOverrides).length) ||
    (profile.bandMembers && profile.bandMembers.length)
  );
};

const resolveLiveFields = ({ cloud, local }) => {
  const cloudStream = normalizeStreamUrl(cloud?.streamUrl || '');
  const localStream = normalizeStreamUrl(local?.streamUrl || '');
  if (cloudStream) {
    return {
      streamUrl: cloudStream,
      isLive: normalizeBoolean(cloud?.isLive),
      liveStartedAt: resolveLiveStartedAt(cloud)
    };
  }
  if (localStream) {
    return {
      streamUrl: localStream,
      isLive: normalizeBoolean(local?.isLive),
      liveStartedAt: resolveLiveStartedAt(local)
    };
  }
  return {
    streamUrl: '',
    isLive: false,
    liveStartedAt: null
  };
};

const buildSyncPlan = ({ cloud = null, local = {} } = {}) => {
  const normalizedCloud = cloud ? normalizeProfile(cloud) : null;
  const normalizedLocal = normalizeProfile(local);
  const cloudEmpty = !normalizedCloud || !hasMeaningfulProfileData(normalizedCloud);
  const localHasData = hasMeaningfulProfileData(normalizedLocal);

  let merged = normalizedCloud || normalizedLocal;
  let shouldWriteCloud = false;

  if (cloudEmpty && localHasData) {
    merged = { ...normalizedLocal };
    shouldWriteCloud = true;
  } else if (normalizedCloud && localHasData) {
    merged = {
      ...normalizedCloud,
      setlist: mergeOrder(normalizedCloud.setlist, normalizedLocal.setlist),
      genreOverrides: mergeGenreOverrides(normalizedLocal.genreOverrides, normalizedCloud.genreOverrides),
      bandMembers: mergeBandMembers(normalizedCloud.bandMembers, normalizedLocal.bandMembers)
    };
    shouldWriteCloud = true;
  }

  if (normalizedCloud || normalizedLocal) {
    merged = {
      ...merged,
      ...resolveLiveFields({ cloud: normalizedCloud, local: normalizedLocal })
    };
  }

  return {
    merged,
    shouldWriteCloud,
    cloudEmpty,
    localHasData
  };
};

const buildOwnedLibraryPlan = ({ cache = null, cloud = null, backup = null } = {}) => {
  const normalizedCache = cache ? normalizeOwnedLibrarySnapshot(cache) : null;
  const normalizedCloud = cloud ? normalizeOwnedLibrarySnapshot(cloud) : null;
  const normalizedBackup = backup ? normalizeOwnedLibrarySnapshot(backup) : null;
  const cacheIds = normalizedCache?.trackIds || [];
  const cloudIds = normalizedCloud?.trackIds || [];
  const backupIds = normalizedBackup?.trackIds || [];
  const cacheHasData = cacheIds.length > 0;
  const cloudHasData = cloudIds.length > 0;
  const backupHasData = backupIds.length > 0;

  if (!normalizedCloud && !normalizedCache && !normalizedBackup) {
    return {
      chosen: normalizeOwnedLibrarySnapshot({ trackIds: [] }),
      source: 'none',
      shouldSeedCloud: false,
      shouldUpdateCache: false,
      shouldWriteCloud: false,
      recovered: false
    };
  }

  const mergedIds = union(cloudIds, union(cacheIds, backupIds));
  const mergedSnapshot = normalizeOwnedLibrarySnapshot({
    trackIds: mergedIds,
    updatedAt: normalizedCloud?.updatedAt || normalizedCache?.updatedAt || normalizedBackup?.updatedAt || new Date().toISOString(),
    libraryVersion: Math.max(
      normalizedCloud?.libraryVersion || 0,
      normalizedCache?.libraryVersion || 0,
      normalizedBackup?.libraryVersion || 0
    )
  });

  const recovered = (!cloudHasData && (cacheHasData || backupHasData)) || (!cacheHasData && backupHasData);
  const shouldWriteCloud = mergedIds.length > 0 && JSON.stringify(cloudIds) !== JSON.stringify(mergedIds);
  const shouldUpdateCache = mergedIds.length > 0 && JSON.stringify(cacheIds) !== JSON.stringify(mergedIds);
  const source = cloudHasData ? 'cloud' : cacheHasData ? 'cache' : backupHasData ? 'backup' : 'none';

  return {
    chosen: mergedSnapshot,
    source,
    shouldSeedCloud: !cloudHasData && (cacheHasData || backupHasData),
    shouldUpdateCache,
    shouldWriteCloud,
    recovered
  };
};

export {
  PROFILE_CACHE_KEY,
  OWNED_TRACKS_CACHE_VERSION,
  OWNED_LIBRARY_SCHEMA_VERSION,
  readLocalProfileCache,
  writeLocalProfileCache,
  readOwnedTracksCache,
  writeOwnedTracksCache,
  readCloudProfile,
  writeCloudProfile,
  readOwnedLibraryDoc,
  writeOwnedLibraryDoc,
  writeOwnedLibraryBackup,
  readLatestOwnedLibraryBackup,
  cleanupOwnedLibraryBackups,
  setFirestore,
  setFirebase,
  union,
  mergeOrder,
  mergeGenreOverrides,
  mergeBandMembers,
  buildSyncPlan,
  buildOwnedLibraryPlan,
  hasMeaningfulProfileData,
  normalizeProfile,
  normalizeOwnedTrackIds,
  normalizeOwnedLibrarySnapshot,
  computeOwnedTracksHash,
  parseUpdatedAt,
  getOwnedTracksCacheKey,
  getLegacyOwnedTracksCacheKey,
  readLastGoodOwnedCount,
  writeLastGoodOwnedCount,
  readLastSyncAt,
  writeLastSyncAt,
  readLastSyncHash,
  writeLastSyncHash,
  readLastBackupAt,
  writeLastBackupAt,
  readLastLocalBackupAt,
  writeLastLocalBackupAt,
  readOwnedTracksBackup,
  writeOwnedTracksBackup
};

if (typeof window !== 'undefined') {
  window.profileStore = {
    PROFILE_CACHE_KEY,
    OWNED_TRACKS_CACHE_VERSION,
    OWNED_LIBRARY_SCHEMA_VERSION,
    readLocalProfileCache,
    writeLocalProfileCache,
    readOwnedTracksCache,
    writeOwnedTracksCache,
    readCloudProfile,
    writeCloudProfile,
    readOwnedLibraryDoc,
    writeOwnedLibraryDoc,
    writeOwnedLibraryBackup,
    readLatestOwnedLibraryBackup,
    cleanupOwnedLibraryBackups,
    setFirestore,
    setFirebase,
    union,
    mergeOrder,
    mergeGenreOverrides,
    mergeBandMembers,
    buildSyncPlan,
    buildOwnedLibraryPlan,
    hasMeaningfulProfileData,
    normalizeProfile,
    normalizeOwnedTrackIds,
    normalizeOwnedLibrarySnapshot,
    computeOwnedTracksHash,
    parseUpdatedAt,
    getOwnedTracksCacheKey,
    getLegacyOwnedTracksCacheKey,
    readLastGoodOwnedCount,
    writeLastGoodOwnedCount,
    readLastSyncAt,
    writeLastSyncAt,
    readLastBackupAt,
    writeLastBackupAt,
    readLastSyncHash,
    writeLastSyncHash,
    readLastLocalBackupAt,
    writeLastLocalBackupAt,
    readOwnedTracksBackup,
    writeOwnedTracksBackup
  };
}
