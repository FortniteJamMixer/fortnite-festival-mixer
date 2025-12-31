const memoryStore = new Map();

export function setEpicLink(uid, payload) {
  if (!uid || !payload) return;
  memoryStore.set(uid, { ...payload });
}

export function getEpicLink(uid) {
  if (!uid) return null;
  const stored = memoryStore.get(uid);
  return stored ? { ...stored } : null;
}

export function clearEpicLink(uid) {
  if (!uid) return;
  memoryStore.delete(uid);
}
