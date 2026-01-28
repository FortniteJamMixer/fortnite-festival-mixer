export default async function handler(req, res) {
  res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=3600");

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    const upstream = await fetch(
      "https://fortnitecontent-website-prod07.ol.epicgames.com/content/api/pages/fortnite-game/spark-tracks"
    );

    if (!upstream.ok) {
      throw new Error(`Upstream catalog fetch failed: ${upstream.status}`);
    }

    const payload = await upstream.json();
    return res.status(200).json(payload);
  } catch (err) {
    console.error("Catalog fetch failed", err);
    return res.status(502).json({ error: "CATALOG_FETCH_FAILED" });
  }
}
