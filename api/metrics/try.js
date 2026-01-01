import { adminFieldValue, adminTimestamp, getFirestore } from "../_firebaseAdmin";

function getCentralDateKey(date = new Date()) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = Object.fromEntries(
    formatter.formatToParts(date).map((p) => [p.type, p.value])
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function parseBody(req) {
  if (!req.body) return {};
  if (typeof req.body === "string") {
    try {
      return JSON.parse(req.body);
    } catch (err) {
      return {};
    }
  }
  return req.body;
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const { anonId } = parseBody(req);
  if (!anonId || typeof anonId !== "string" || anonId.length > 200) {
    return res.status(400).json({ error: "anonId is required" });
  }

  let firestore;
  try {
    firestore = getFirestore();
  } catch (err) {
    console.error("Admin init failed", err);
    return res.status(500).json({ error: "Admin not configured" });
  }

  const visitorRef = firestore.collection("metricsVisitors").doc(anonId);
  const statsRef = firestore.collection("stats").doc("global");
  const now = adminTimestamp.now();
  let totalTried = 0;

  try {
    await firestore.runTransaction(async (txn) => {
      const [visitorSnap, statsSnap] = await Promise.all([
        txn.get(visitorRef),
        txn.get(statsRef),
      ]);
      const alreadyExists = visitorSnap.exists;
      const baseTotal = statsSnap.exists ? Number(statsSnap.data()?.totalTried || 0) : 0;

      if (!alreadyExists) {
        txn.set(visitorRef, { createdAt: now }, { merge: false });
        txn.set(statsRef, { totalTried: adminFieldValue.increment(1) }, { merge: true });
      }
      totalTried = baseTotal + (alreadyExists ? 0 : 1);
    });
  } catch (err) {
    console.error("Failed to record try", err);
    return res.status(500).json({ error: "Failed to record try" });
  }

  const cutoff = adminTimestamp.fromMillis(Date.now() - 24 * 60 * 60 * 1000);
  let new24h = 0;
  try {
    const newSnap = await firestore
      .collection("metricsVisitors")
      .where("createdAt", ">=", cutoff)
      .get();
    new24h = newSnap.size;
  } catch (err) {
    console.error("Failed to query new24h", err);
  }

  let peakToday = 0;
  try {
    const todayKey = getCentralDateKey();
    const dailyDoc = await firestore.collection("stats").doc(`daily_${todayKey}`).get();
    peakToday = Number(dailyDoc.data()?.peakOnline || 0);
  } catch (err) {
    console.error("Failed to read peak", err);
  }

  return res.status(200).json({ totalTried, new24h, peakToday });
}
