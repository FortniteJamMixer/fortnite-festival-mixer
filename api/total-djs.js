import { getAdminApp, admin } from "./_firebaseAdmin";

const CACHE_TTL_MS = 2 * 60 * 1000; // 2 minutes
let cachedTotal = null;
let cacheExpiresAt = 0;

async function countAuthUsers() {
  const now = Date.now();
  if (cachedTotal !== null && now < cacheExpiresAt) return cachedTotal;

  const app = getAdminApp();
  const auth = admin.auth(app);
  let total = 0;
  let nextPageToken;

  do {
    const result = await auth.listUsers(1000, nextPageToken);
    total += result.users.length;
    nextPageToken = result.pageToken;
  } while (nextPageToken);

  cachedTotal = total;
  cacheExpiresAt = now + CACHE_TTL_MS;
  return total;
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "s-maxage=120, stale-while-revalidate=300");

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    const totalDjs = await countAuthUsers();
    res.status(200).json({ totalDjs });
  } catch (err) {
    console.error("Failed to load total DJs", err);
    res.status(500).json({ error: "Failed to load total DJs" });
  }
}
