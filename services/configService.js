(() => {
  const HELP_CACHE_KEY = 'help_cache_v1';
  const WHATSNEW_CACHE_KEY = 'whatsnew_cache_v1';

  let helpCache = null;
  let whatsNewCache = null;

  const toCleanString = (value) => {
    if (value === null || typeof value === 'undefined') return '';
    return String(value).trim();
  };

  const toStringArray = (value) => {
    if (!Array.isArray(value)) return [];
    return value.map(item => toCleanString(item)).filter(Boolean);
  };

  const readCache = (key) => {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return null;
      return parsed;
    } catch (err) {
      console.warn('[config] cache read failed', err);
      return null;
    }
  };

  const writeCache = (key, data) => {
    try {
      localStorage.setItem(key, JSON.stringify({ savedAt: Date.now(), data }));
    } catch (err) {
      console.warn('[config] cache write failed', err);
    }
  };

  const normalizeSection = (section) => {
    if (!section || typeof section !== 'object') return null;
    const id = toCleanString(section.id);
    const title = toCleanString(section.title);
    const body = toStringArray(section.body);
    if (!id || !title || body.length === 0) return null;
    return { id, title, body };
  };

  const normalizeFaq = (faq) => {
    if (!faq || typeof faq !== 'object') return null;
    const id = toCleanString(faq.id);
    const q = toCleanString(faq.q);
    const a = toStringArray(faq.a);
    if (!id || !q || a.length === 0) return null;
    return { id, q, a };
  };

  const normalizeWhatsNewItem = (item) => {
    if (!item || typeof item !== 'object') return null;
    const id = toCleanString(item.id);
    const text = toCleanString(item.text);
    if (!id || !text) return null;
    const requires = Array.isArray(item.requires)
      ? item.requires.map(req => toCleanString(req)).filter(Boolean)
      : [];
    const date = toCleanString(item.date);
    const normalized = { id, text };
    if (requires.length) normalized.requires = requires;
    if (date) normalized.date = date;
    return normalized;
  };

  const validateHelpDoc = (doc) => {
    if (!doc || typeof doc !== 'object') return null;
    const basic = doc.basic && typeof doc.basic === 'object' ? doc.basic : null;
    const advanced = doc.advanced && typeof doc.advanced === 'object' ? doc.advanced : null;
    if (!basic || !advanced) return null;
    const quickStart = toStringArray(basic.quickStart);
    const basicSections = Array.isArray(basic.sections)
      ? basic.sections.map(normalizeSection).filter(Boolean)
      : [];
    const faq = Array.isArray(basic.faq)
      ? basic.faq.map(normalizeFaq).filter(Boolean)
      : [];
    const advancedSections = Array.isArray(advanced.sections)
      ? advanced.sections.map(normalizeSection).filter(Boolean)
      : [];
    if (!quickStart.length || !basicSections.length || !advancedSections.length) return null;
    return {
      version: Number(doc.version) || 1,
      updatedAt: doc.updatedAt || null,
      updatedBy: toCleanString(doc.updatedBy || ''),
      basic: {
        quickStart,
        sections: basicSections,
        faq
      },
      advanced: {
        sections: advancedSections
      }
    };
  };

  const validateWhatsNewDoc = (doc) => {
    if (!doc || typeof doc !== 'object') return null;
    const items = Array.isArray(doc.items)
      ? doc.items.map(normalizeWhatsNewItem).filter(Boolean)
      : [];
    if (!items.length) return null;
    return {
      version: Number(doc.version) || 1,
      updatedAt: doc.updatedAt || null,
      updatedBy: toCleanString(doc.updatedBy || ''),
      items
    };
  };

  const getHelpContent = async ({ firestore, defaults }) => {
    if (helpCache) return helpCache;
    const cached = readCache(HELP_CACHE_KEY);
    if (!firestore) {
      helpCache = cached?.data || defaults || null;
      return helpCache;
    }
    try {
      const doc = await firestore.collection('appConfig').doc('help').get();
      if (doc.exists) {
        const normalized = validateHelpDoc(doc.data());
        if (normalized) {
          helpCache = normalized;
          writeCache(HELP_CACHE_KEY, normalized);
          return normalized;
        }
      }
    } catch (err) {
      console.warn('[config] help fetch failed', err);
    }
    if (cached?.data) {
      helpCache = cached.data;
      return helpCache;
    }
    helpCache = defaults || null;
    return helpCache;
  };

  const getWhatsNew = async ({ firestore, defaults }) => {
    if (whatsNewCache) return whatsNewCache;
    const cached = readCache(WHATSNEW_CACHE_KEY);
    if (!firestore) {
      whatsNewCache = cached?.data || defaults || null;
      return whatsNewCache;
    }
    try {
      const doc = await firestore.collection('appConfig').doc('whatsNew').get();
      if (doc.exists) {
        const normalized = validateWhatsNewDoc(doc.data());
        if (normalized) {
          whatsNewCache = normalized;
          writeCache(WHATSNEW_CACHE_KEY, normalized);
          return normalized;
        }
      }
    } catch (err) {
      console.warn('[config] whatsNew fetch failed', err);
    }
    if (cached?.data) {
      whatsNewCache = cached.data;
      return whatsNewCache;
    }
    whatsNewCache = defaults || null;
    return whatsNewCache;
  };

  const saveHelpContent = async ({ firestore, data, updatedBy }) => {
    if (!firestore) throw new Error('Firestore unavailable');
    const normalized = validateHelpDoc(data);
    if (!normalized) throw new Error('Help content failed validation');
    const serverTimestamp = firebase?.firestore?.FieldValue?.serverTimestamp;
    const payload = {
      ...normalized,
      updatedBy: toCleanString(updatedBy || normalized.updatedBy || ''),
      updatedAt: serverTimestamp ? serverTimestamp() : new Date().toISOString()
    };
    await firestore.collection('appConfig').doc('help').set(payload, { merge: true });
    helpCache = payload;
    writeCache(HELP_CACHE_KEY, payload);
    return payload;
  };

  const saveWhatsNew = async ({ firestore, data, updatedBy }) => {
    if (!firestore) throw new Error('Firestore unavailable');
    const normalized = validateWhatsNewDoc(data);
    if (!normalized) throw new Error('What\'s New content failed validation');
    const serverTimestamp = firebase?.firestore?.FieldValue?.serverTimestamp;
    const payload = {
      ...normalized,
      updatedBy: toCleanString(updatedBy || normalized.updatedBy || ''),
      updatedAt: serverTimestamp ? serverTimestamp() : new Date().toISOString()
    };
    await firestore.collection('appConfig').doc('whatsNew').set(payload, { merge: true });
    whatsNewCache = payload;
    writeCache(WHATSNEW_CACHE_KEY, payload);
    return payload;
  };

  window.configService = {
    getHelpContent,
    getWhatsNew,
    saveHelpContent,
    saveWhatsNew,
    validateHelpDoc,
    validateWhatsNewDoc
  };
})();
