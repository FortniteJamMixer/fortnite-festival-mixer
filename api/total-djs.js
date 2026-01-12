import {
  ensureCacheDoc,
  getAdminAuth,
  getFirestore,
  isStale,
  refreshWithTimeout,
  toResponsePayload,
} from "./_totalDjs.js";

const CACHE_HEADER = "s-maxage=60, stale-while-revalidate=300";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", CACHE_HEADER);

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    const firestore = getFirestore();
    const cache = await ensureCacheDoc(firestore);

    const stale = isStale(cache);
    let response = toResponsePayload(cache, stale);

    if (stale) {
      try {
        const auth = getAdminAuth();
        const { cache: refreshedCache, stale: stillStale } = await refreshWithTimeout(firestore, auth, cache);
        response = toResponsePayload(refreshedCache, stillStale);
      } catch (refreshErr) {
        console.error("[total-djs] Unable to refresh", refreshErr);
      }
    }

    return res.status(200).json(response);
  } catch (err) {
    console.error("Failed to load total DJs", err);
    return res.status(500).json({ error: "Failed to load total DJs" });
  }
}
