import { adminTimestamp, getFirestore } from "../_firebaseAdmin";

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

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const { onlineNow } = parseBody(req);
  const numericOnline = Number.isFinite(Number(onlineNow)) ? Number(onlineNow) : NaN;
  if (Number.isNaN(numericOnline)) {
    return res.status(400).json({ error: "onlineNow must be a number" });
  }
  const clampedOnline = Math.min(Math.max(Math.floor(numericOnline), 0), 5000);

  let firestore;
  try {
    firestore = getFirestore();
  } catch (err) {
    console.error("Admin init failed", err);
    return res.status(500).json({ error: "Admin not configured" });
  }

  const todayKey = getCentralDateKey();
  const dailyRef = firestore.collection("stats").doc(`daily_${todayKey}`);
  let peakToday = clampedOnline;

  try {
    await firestore.runTransaction(async (txn) => {
      const snap = await txn.get(dailyRef);
      const current = snap.exists ? Number(snap.data()?.peakOnline || 0) : 0;
      peakToday = Math.max(current, clampedOnline);
      if (peakToday !== current) {
        txn.set(
          dailyRef,
          { peakOnline: peakToday, updatedAt: adminTimestamp.now() },
          { merge: true }
        );
      } else if (!snap.exists) {
        txn.set(
          dailyRef,
          { peakOnline: peakToday, updatedAt: adminTimestamp.now() },
          { merge: true }
        );
      }
    });
  } catch (err) {
    console.error("Failed to update peak", err);
    return res.status(500).json({ error: "Failed to update peak" });
  }

  return res.status(200).json({ peakToday });
}
