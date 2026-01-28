const EPIC_CATALOG_ENDPOINTS = [
  "https://fortnitecontent-website-prod07.ol.epicgames.com/content/api/pages/fortnite-game/spark-tracks",
  "https://fortnitecontent-website-prod07.ol.epicgames.com/content/api/pages/fortnite-game/jam-tracks",
];
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
    payload.data?.catalog?.trackMap,
    payload.data?.catalog?.trackList,
    payload.data?.jamTracks,
    payload.data?.sparkTracks,
    payload.jamTracks,
    payload.sparkTracks,
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
  const looksLikeTrack = (entry) => {
    if (!entry || typeof entry !== "object") return false;
    const id = entry.id || entry.trackId || entry.trackID;
    const title = entry.title || entry.tt || entry.name;
    const artist = entry.artist || entry.an || entry.creator || entry.author;
    return Boolean(id && (title || artist));
  };
  const visited = new Set();
  const queue = [payload];
  while (queue.length) {
    const node = queue.shift();
    if (!node || typeof node !== "object") continue;
    if (visited.has(node)) continue;
    visited.add(node);
    if (Array.isArray(node)) {
      const matches = node.filter(looksLikeTrack);
      if (matches.length >= Math.min(5, node.length)) {
        return node;
      }
      queue.push(...node);
    } else {
      const values = Object.values(node);
      const matches = values.filter(looksLikeTrack);
      if (matches.length >= Math.min(5, values.length)) {
        return matches;
      }
      values.forEach((value) => {
        if (value && typeof value === "object") {
          queue.push(value);
        }
      });
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

  let lastError = null;
  for (const endpoint of EPIC_CATALOG_ENDPOINTS) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const upstream = await fetch(endpoint, {
        cache: "no-store",
        signal: controller.signal,
        headers: {
          Accept: "application/json",
          "User-Agent": "Mozilla/5.0 (compatible; FortniteJamMixer/1.0)",
        },
      });
      if (!upstream.ok) {
        lastError = new Error(`Upstream error (${upstream.status})`);
        continue;
      }
      const payload = await upstream.json();
      const extracted = extractTracksFromPayload(payload);
      if (Array.isArray(extracted) && extracted.length) {
        return res
          .status(200)
          .json({ tracks: extracted, source: endpoint });
      }
      lastError = new Error("Catalog payload missing tracks");
    } catch (err) {
      lastError =
        err?.name === "AbortError"
          ? new Error("Upstream request timed out")
          : err;
    } finally {
      clearTimeout(timeoutId);
    }
  }
  return res
    .status(502)
    .json({ error: lastError?.message || "Upstream request failed" });
}
