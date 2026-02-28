import { getFirestore, getAdminAuth, admin, adminFieldValue } from "./_firebaseAdmin.js";

const STALE_AFTER_MS = 15 * 60 * 1000; // 15 minutes
const REFRESH_TIMEOUT_MS = 4500; // timeout for in-request refresh
const RECOUNT_BUDGET_MS = 8000; // hard limit for auth recount
const MAX_PAGES = 200; // safety stop for pagination

function statsDocRef(firestore) {
  return firestore.collection("stats").doc("public");
}

function sanitizeTimestamp(value) {
  if (value instanceof admin.firestore.Timestamp) return value;
  if (value instanceof Date) return admin.firestore.Timestamp.fromDate(value);
  return null;
}

function sanitizeCache(raw = {}) {
  const updatedAt = sanitizeTimestamp(raw.updatedAt) || null;
  const lastAttemptAt = sanitizeTimestamp(raw.lastAttemptAt) || null;
  const total = typeof raw.totalDjs === "number" && Number.isFinite(raw.totalDjs) ? raw.totalDjs : null;

  return {
    totalDjs: total,
    updatedAt,
    source: raw.source || "manual",
    lastError: raw.lastError || null,
    lastAttemptAt,
  };
}

async function ensureCacheDoc(firestore) {
  const ref = statsDocRef(firestore);
  const snap = await ref.get();
  if (!snap.exists) {
    const initial = {
      totalDjs: 0,
      updatedAt: admin.firestore.Timestamp.now(),
      source: "manual",
      lastError: "Initialized without recount",
    };
    await ref.set(initial, { merge: true });
    return sanitizeCache(initial);
  }
  return sanitizeCache(snap.data() || {});
}

function isStale(cache) {
  if (cache.source === "manual") return true;
  if (!cache.updatedAt) return true;
  return Date.now() - cache.updatedAt.toMillis() > STALE_AFTER_MS;
}

async function countAuthUsersWithLimits(auth) {
  const start = Date.now();
  let nextPageToken;
  let total = 0;
  let pages = 0;

  do {
    if (Date.now() - start > RECOUNT_BUDGET_MS) {
      throw new Error("Recount exceeded time budget");
    }
    if (pages >= MAX_PAGES) {
      throw new Error("Recount aborted: pagination safety limit hit");
    }

    // eslint-disable-next-line no-await-in-loop
    const result = await auth.listUsers(1000, nextPageToken);
    total += result.users.length;
    nextPageToken = result.pageToken;
    pages += 1;
  } while (nextPageToken);

  return total;
}

async function persistRecount(firestore, totalDjs, previousTotal) {
  const ref = statsDocRef(firestore);
  const payload = {
    totalDjs,
    updatedAt: admin.firestore.Timestamp.now(),
    source: "auth-recount",
    lastAttemptAt: admin.firestore.Timestamp.now(),
    lastError: adminFieldValue.delete(),
  };

  if (typeof previousTotal === "number" && totalDjs < previousTotal) {
    console.warn("[total-djs] Recount lower than cache", { previousTotal, nextTotal: totalDjs });
  }

  await ref.set(payload, { merge: true });
  return sanitizeCache(payload);
}

async function recordRecountFailure(firestore, err, cache = {}) {
  const ref = statsDocRef(firestore);
  const errorMessage = err?.message || "Recount failed";
  const payload = {
    lastError: errorMessage,
    lastAttemptAt: admin.firestore.Timestamp.now(),
  };
  await ref.set(payload, { merge: true });
  return sanitizeCache({ ...cache, ...payload });
}

async function recountAndPersistTotals(firestore, auth, previousTotal) {
  const totalDjs = await countAuthUsersWithLimits(auth);
  return persistRecount(firestore, totalDjs, previousTotal);
}

function toResponsePayload(cache, stale) {
  const total = typeof cache.totalDjs === "number" && Number.isFinite(cache.totalDjs)
    ? (cache.source === "manual" && cache.totalDjs === 0 ? null : cache.totalDjs)
    : null;
  return {
    totalDjs: total,
    updatedAt: cache.updatedAt ? cache.updatedAt.toDate().toISOString() : null,
    source: cache.source,
    stale,
    lastError: cache.lastError || null,
    lastAttemptAt: cache.lastAttemptAt ? cache.lastAttemptAt.toDate().toISOString() : null,
  };
}

async function refreshWithTimeout(firestore, auth, cache) {
  let timedOut = false;
  const timeout = new Promise((resolve) => {
    setTimeout(() => {
      timedOut = true;
      resolve(null);
    }, REFRESH_TIMEOUT_MS);
  });

  try {
    const refresh = recountAndPersistTotals(firestore, auth, cache.totalDjs);
    const result = await Promise.race([refresh, timeout]);
    if (!result && timedOut) {
      console.warn("[total-djs] Refresh timed out, keeping cache", { cacheUpdatedAt: cache.updatedAt?.toMillis?.() });
      return { cache, stale: true };
    }
    return { cache: result || cache, stale: false };
  } catch (err) {
    console.error("[total-djs] Refresh failed", err);
    const failureCache = await recordRecountFailure(firestore, err, cache);
    return { cache: { ...cache, ...failureCache }, stale: true };
  }
}

export {
  ensureCacheDoc,
  getFirestore,
  getAdminAuth,
  isStale,
  refreshWithTimeout,
  toResponsePayload,
  recordRecountFailure,
  recountAndPersistTotals,
};
