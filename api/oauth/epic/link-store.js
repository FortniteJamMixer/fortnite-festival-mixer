const FIRESTORE_API = "https://firestore.googleapis.com/v1";

function requireEnv(key) {
  const value = (process.env[key] || "").trim();
  return value || null;
}

function buildHeaders(idToken) {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${idToken}`,
  };
}

function buildDocPath(projectId, uid) {
  return `${FIRESTORE_API}/projects/${projectId}/databases/(default)/documents/users/${encodeURIComponent(
    uid
  )}/integrations/epic`;
}

function buildCollectionPath(projectId, uid) {
  return `${FIRESTORE_API}/projects/${projectId}/databases/(default)/documents/users/${encodeURIComponent(
    uid
  )}/integrations`;
}

function toTimestamp(value) {
  const date = value ? new Date(value) : new Date();
  return date.toISOString();
}

function toFirestorePayload(payload) {
  const fields = {
    linked: { booleanValue: true },
    epicAccountId: { stringValue: payload.epicAccountId || "" },
    linkedAt: { timestampValue: toTimestamp(payload.linkedAt) },
    lastValidatedAt: { timestampValue: toTimestamp(payload.lastValidatedAt) },
  };
  if (payload.displayName) {
    fields.displayName = { stringValue: payload.displayName };
  }
  return { fields };
}

function fromFirestoreDocument(doc) {
  if (!doc?.fields) return null;
  const f = doc.fields;
  const parseTime = (ts) => (ts?.timestampValue ? Date.parse(ts.timestampValue) : null);
  return {
    linked: !!f.linked?.booleanValue,
    epicAccountId: f.epicAccountId?.stringValue || null,
    displayName: f.displayName?.stringValue || null,
    linkedAt: parseTime(f.linkedAt),
    lastValidatedAt: parseTime(f.lastValidatedAt),
  };
}

export async function setEpicLink(uid, payload, idToken) {
  const projectId = requireEnv("FIREBASE_PROJECT_ID");
  if (!uid || !payload || !idToken || !projectId) {
    throw new Error("Missing required data for Epic link persistence");
  }

  const docUrl = buildDocPath(projectId, uid);
  const body = JSON.stringify(toFirestorePayload(payload));

  let resp = await fetch(docUrl, {
    method: "PATCH",
    headers: buildHeaders(idToken),
    body,
  });

  if (resp.status === 404) {
    const collectionUrl = `${buildCollectionPath(projectId, uid)}?documentId=epic`;
    resp = await fetch(collectionUrl, {
      method: "POST",
      headers: buildHeaders(idToken),
      body,
    });
  }

  const data = await resp.json().catch(() => null);
  if (!resp.ok) {
    const message = data?.error?.message || "Failed to persist Epic link";
    throw new Error(message);
  }

  return fromFirestoreDocument(data);
}

export async function getEpicLink(uid, idToken) {
  const projectId = requireEnv("FIREBASE_PROJECT_ID");
  if (!uid || !idToken || !projectId) return null;

  const docUrl = buildDocPath(projectId, uid);
  const resp = await fetch(docUrl, {
    method: "GET",
    headers: buildHeaders(idToken),
  });

  if (resp.status === 404) return null;
  if (!resp.ok) {
    throw new Error("Failed to read Epic link");
  }

  const data = await resp.json().catch(() => null);
  return fromFirestoreDocument(data);
}

export async function clearEpicLink(uid, idToken) {
  const projectId = requireEnv("FIREBASE_PROJECT_ID");
  if (!uid || !idToken || !projectId) return false;

  const docUrl = buildDocPath(projectId, uid);
  const resp = await fetch(docUrl, {
    method: "DELETE",
    headers: buildHeaders(idToken),
  });

  if (resp.status === 404) return true;
  return resp.ok;
}
