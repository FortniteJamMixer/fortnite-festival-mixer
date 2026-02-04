const OWNED_KEY = 'jamMixer.owned.v1';
const SETTINGS_KEY = 'jamMixer.settings.v1';

const safeParse = (raw, fallback) => {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw);
  } catch (err) {
    console.warn('[localStorageStore] Failed to parse data', err);
    return fallback;
  }
};

const loadOwned = () => {
  if (typeof localStorage === 'undefined') return [];
  const data = safeParse(localStorage.getItem(OWNED_KEY), []);
  return Array.isArray(data) ? data.filter(Boolean) : [];
};

const saveOwned = (ownedSet = []) => {
  if (typeof localStorage === 'undefined') return [];
  const normalized = Array.isArray(ownedSet) ? ownedSet.filter(Boolean) : [];
  const unique = Array.from(new Set(normalized)).sort();
  localStorage.setItem(OWNED_KEY, JSON.stringify(unique));
  return unique;
};

const loadSettings = () => {
  if (typeof localStorage === 'undefined') return {};
  const data = safeParse(localStorage.getItem(SETTINGS_KEY), {});
  return data && typeof data === 'object' ? data : {};
};

const saveSettings = (settings = {}) => {
  if (typeof localStorage === 'undefined') return {};
  const payload = settings && typeof settings === 'object' ? settings : {};
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(payload));
  return payload;
};

if (typeof window !== 'undefined') {
  window.localStore = {
    loadOwned,
    saveOwned,
    loadSettings,
    saveSettings,
    OWNED_KEY,
    SETTINGS_KEY
  };
}
