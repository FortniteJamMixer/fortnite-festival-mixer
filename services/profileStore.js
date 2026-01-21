const PROFILE_CACHE_KEY = 'ffjm_profile_cache_v1';

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

const writeCloudProfile = async (uid, patch) => {
  if (!firestoreRef || !uid) return;
  const serverTimestamp = firebaseRef?.firestore?.FieldValue?.serverTimestamp;
  const payload = {
    ...patch,
    updatedAt: serverTimestamp ? serverTimestamp() : new Date().toISOString()
  };
  await firestoreRef.collection('users').doc(uid).set(payload, { merge: true });
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
    (profile.ownedTracks && profile.ownedTracks.length) ||
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
      ownedTracks: union(normalizedCloud.ownedTracks, normalizedLocal.ownedTracks),
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

export {
  PROFILE_CACHE_KEY,
  readLocalProfileCache,
  writeLocalProfileCache,
  readCloudProfile,
  writeCloudProfile,
  setFirestore,
  setFirebase,
  union,
  mergeOrder,
  mergeGenreOverrides,
  mergeBandMembers,
  buildSyncPlan,
  hasMeaningfulProfileData,
  normalizeProfile
};

if (typeof window !== 'undefined') {
  window.profileStore = {
    PROFILE_CACHE_KEY,
    readLocalProfileCache,
    writeLocalProfileCache,
    readCloudProfile,
    writeCloudProfile,
    setFirestore,
    setFirebase,
    union,
    mergeOrder,
    mergeGenreOverrides,
    mergeBandMembers,
    buildSyncPlan,
    hasMeaningfulProfileData,
    normalizeProfile
  };
}
