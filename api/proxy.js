const ALLOWED_HOSTS = new Set([
  "fortnitecontent-website-prod07.ol.epicgames.com"
]);

const MAX_RESPONSE_BYTES = 1_500_000;
const REQUEST_TIMEOUT_MS = 8_000;

function getTargetUrl(rawUrl) {
  if (!rawUrl) return null;
  try {
    return new URL(rawUrl);
  } catch (err) {
    return null;
  }
}

async function readUpstreamBody(upstream, res) {
  const contentLength = Number(upstream.headers.get("content-length") || 0);
  if (contentLength && contentLength > MAX_RESPONSE_BYTES) {
    res.status(413).json({ error: "Upstream payload too large" });
    return null;
  }

  if (upstream.body && typeof upstream.body.getReader === "function") {
    const reader = upstream.body.getReader();
    const chunks = [];
    let total = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_RESPONSE_BYTES) {
        res.status(413).json({ error: "Upstream payload too large" });
        return null;
      }
      chunks.push(Buffer.from(value));
    }

    return Buffer.concat(chunks, total);
  }

  const arrayBuffer = await upstream.arrayBuffer();
  if (arrayBuffer.byteLength > MAX_RESPONSE_BYTES) {
    res.status(413).json({ error: "Upstream payload too large" });
    return null;
  }
  return Buffer.from(arrayBuffer);
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=86400");

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const rawUrl = Array.isArray(req.query?.url) ? req.query.url[0] : req.query?.url;
  const targetUrl = getTargetUrl(rawUrl);

  if (!targetUrl || !["http:", "https:"].includes(targetUrl.protocol)) {
    return res.status(400).json({ error: "Invalid target URL" });
  }

  if (!ALLOWED_HOSTS.has(targetUrl.hostname)) {
    return res.status(400).json({ error: "URL host is not allowlisted" });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let upstream;
  try {
    upstream = await fetch(targetUrl.toString(), {
      signal: controller.signal,
      headers: { "user-agent": "fortnite-festival-mixer" }
    });
  } catch (err) {
    clearTimeout(timeout);
    const message = err?.name === "AbortError" ? "Upstream request timed out" : "Upstream request failed";
    return res.status(504).json({ error: message });
  }
  clearTimeout(timeout);

  if (!upstream.ok) {
    return res.status(upstream.status).json({ error: "Upstream request failed", status: upstream.status });
  }

  const body = await readUpstreamBody(upstream, res);
  if (!body) return;

  const contentType = upstream.headers.get("content-type");
  if (contentType) res.setHeader("Content-Type", contentType);
  const etag = upstream.headers.get("etag");
  if (etag) res.setHeader("ETag", etag);
  const lastModified = upstream.headers.get("last-modified");
  if (lastModified) res.setHeader("Last-Modified", lastModified);

  res.setHeader("Content-Length", body.length);
  res.status(200).send(body);
}
