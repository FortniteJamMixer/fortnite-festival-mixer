export default async function handler(req, res) {
  try {
    const response = await fetch(
      "https://fortnitecontent-website-prod07.ol.epicgames.com/content/api/pages/fortnite-game/spark-tracks",
      { headers: { "User-Agent": "Mozilla/5.0" } }
    );
    if (!response.ok) {
      return res.status(response.status).json({ error: "Epic API error" });
    }
    const data = await response.json();
    res.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate");
    res.setHeader("Access-Control-Allow-Origin", "*");
    return res.status(200).json(data);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
