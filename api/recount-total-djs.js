import {
  ensureCacheDoc,
  getAdminAuth,
  getFirestore,
  recountAndPersistTotals,
  toResponsePayload,
} from "./_totalDjs";

const CACHE_HEADER = "no-store";

function isAuthorized(req) {
  const headerSecret = req.headers["x-cron-secret"];
  const querySecret = req.query?.secret;
  const envSecret = process.env.CRON_SECRET;

  return envSecret && (headerSecret === envSecret || querySecret === envSecret);
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", CACHE_HEADER);

  if (req.method !== "POST" && req.method !== "GET") {
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  if (!isAuthorized(req)) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const firestore = getFirestore();
    const auth = getAdminAuth();
    const cache = await ensureCacheDoc(firestore);

    const refreshedCache = await recountAndPersistTotals(firestore, auth, cache.totalDjs);
    const response = toResponsePayload(refreshedCache, false);

    return res.status(200).json(response);
  } catch (err) {
    console.error("Manual recount failed", err);
    return res.status(500).json({ error: "Failed to recount total DJs" });
  }
}
