const EPIC_CATALOG_URL =
  "https://fortnitecontent-website-prod07.ol.epicgames.com/content/api/pages/fortnite-game/spark-tracks";
const REQUEST_TIMEOUT_MS = 9000;

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const upstream = await fetch(EPIC_CATALOG_URL, {
      cache: "no-store",
      signal: controller.signal,
    });
    if (!upstream.ok) {
      return res
        .status(upstream.status)
        .json({ error: `Upstream error (${upstream.status})` });
    }
    const payload = await upstream.json();
    return res.status(200).json(payload);
  } catch (err) {
    const message =
      err?.name === "AbortError"
        ? "Upstream request timed out"
        : err?.message || "Upstream request failed";
    return res.status(502).json({ error: message });
  } finally {
    clearTimeout(timeoutId);
  }
}
