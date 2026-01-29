export default async function handler(req, res) {
  try {
    const url = 'https://fortnitecontent-website-prod07.ol.epicgames.com/content/api/pages/fortnite-game/spark-tracks';
    const r = await fetch(url, { headers: { 'user-agent': 'jam-mixer' } });
    if (!r.ok) {
      return res.status(502).json({ error: 'CATALOG_FETCH_FAILED', status: r.status });
    }

    const data = await r.json();
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=3600');
    return res.status(200).json(data);
  } catch (e) {
    return res.status(502).json({ error: 'CATALOG_FETCH_FAILED', message: String(e) });
  }
}
