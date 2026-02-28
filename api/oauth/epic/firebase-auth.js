const FIREBASE_LOOKUP_ENDPOINT =
  "https://identitytoolkit.googleapis.com/v1/accounts:lookup";

export async function verifyFirebaseIdToken(idToken) {
  const apiKey = process.env.FIREBASE_API_KEY;
  if (!idToken || !apiKey) return null;

  try {
    const resp = await fetch(`${FIREBASE_LOOKUP_ENDPOINT}?key=${apiKey}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ idToken }),
    });

    if (!resp.ok) return null;

    const data = await resp.json().catch(() => null);
    const user = data?.users?.[0];
    if (!user?.localId) return null;

    return {
      uid: user.localId,
      displayName: user.displayName || "",
      email: user.email || "",
    };
  } catch (e) {
    return null;
  }
}
