const EPIC_CATALOG_URL =
  "https://fortnitecontent-website-prod07.ol.epicgames.com/content/api/pages/fortnite-game/spark-tracks";
const REQUEST_TIMEOUT_MS = 9000;

function extractTracksFromPayload(payload) {
  if (!payload) return null;
  if (Array.isArray(payload)) return payload;
  const normalizeCollection = (collection) => {
    if (!collection) return null;
    if (Array.isArray(collection)) return collection;
    if (typeof collection === "object") {
      const values = Object.values(collection);
      return values.length ? values : null;
    }
    return null;
  };
  const directCandidates = [
    payload.tracks,
    payload.trackMap,
    payload.trackList,
    payload.items,
    payload.data?.tracks,
    payload.data?.trackMap,
    payload.data?.trackList,
    payload.data?.items,
    payload.data?.catalog?.tracks,
    payload.data?.catalog?.items,
  ];
  const direct = directCandidates
    .map(normalizeCollection)
    .find((candidate) => Array.isArray(candidate) && candidate.length);
  if (direct) return direct;
  const pages = payload.data?.pages || payload.pages;
  if (pages && typeof pages === "object") {
    const pageEntries = Object.values(pages);
    for (const page of pageEntries) {
      const pageTracks = normalizeCollection(page?.data?.tracks || page?.data?.trackMap);
      if (Array.isArray(pageTracks) && pageTracks.length) {
        return pageTracks;
      }
    }
  }
  return null;
}

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
      headers: {
        Accept: "application/json",
        "User-Agent": "Mozilla/5.0 (compatible; FortniteJamMixer/1.0)",
      },
    });
    if (!upstream.ok) {
      return res
        .status(upstream.status)
        .json({ error: `Upstream error (${upstream.status})` });
    }
    const payload = await upstream.json();
    const extracted = extractTracksFromPayload(payload);
    if (Array.isArray(extracted) && extracted.length) {
      return res.status(200).json({ tracks: extracted });
    }
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
