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

function buildArrayField(values = []) {
  if (!Array.isArray(values) || values.length === 0) return null;
  return { arrayValue: { values: values.map((v) => ({ stringValue: v })) } };
}

function toFirestorePayload(payload) {
  const providerUserId = payload.providerUserId || payload.epicAccountId || "";
  const scopesField = buildArrayField(payload.scopes);
  const fields = {
    provider: { stringValue: payload.provider || "epic" },
    providerUserId: { stringValue: providerUserId },
    epicAccountId: { stringValue: providerUserId },
    linked: { booleanValue: payload.linked !== false },
    status: { stringValue: payload.status || "linked" },
    linkedAt: { timestampValue: toTimestamp(payload.linkedAt) },
    lastValidatedAt: { timestampValue: toTimestamp(payload.lastValidatedAt) },
    lastUpdatedAt: { timestampValue: toTimestamp(payload.lastUpdatedAt) },
  };

  if (payload.displayName) {
    fields.displayName = { stringValue: payload.displayName };
  }
  if (scopesField) {
    fields.scopes = scopesField;
  }
  if (payload.metadata && typeof payload.metadata === "object") {
    fields.metadata = {
      mapValue: {
        fields: Object.fromEntries(
          Object.entries(payload.metadata).map(([key, value]) => [
            key,
            { stringValue: String(value) },
          ])
        ),
      },
    };
  }

  return { fields };
}

function fromFirestoreDocument(doc) {
  if (!doc?.fields) return null;
  const f = doc.fields;
  const parseTime = (ts) => (ts?.timestampValue ? Date.parse(ts.timestampValue) : null);
  const parseArray = (arr) =>
    arr?.arrayValue?.values?.map((v) => v.stringValue).filter(Boolean) || [];

  return {
    provider: f.provider?.stringValue || "epic",
    linked: !!f.linked?.booleanValue,
    status: f.status?.stringValue || "linked",
    epicAccountId: f.epicAccountId?.stringValue || null,
    providerUserId: f.providerUserId?.stringValue || f.epicAccountId?.stringValue || null,
    displayName: f.displayName?.stringValue || null,
    scopes: parseArray(f.scopes),
    linkedAt: parseTime(f.linkedAt),
    lastValidatedAt: parseTime(f.lastValidatedAt),
    lastUpdatedAt: parseTime(f.lastUpdatedAt),
    metadata: f.metadata?.mapValue?.fields
      ? Object.fromEntries(
          Object.entries(f.metadata.mapValue.fields).map(([key, value]) => [
            key,
            value.stringValue,
          ])
        )
      : undefined,
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
