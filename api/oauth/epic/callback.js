import { COOKIE_MAX_AGE, COOKIE_NAME, buildClearCookie } from "./constants";
import { verifyFirebaseIdToken } from "./firebase-auth";
import { setEpicLink } from "./link-store";

const ERROR_CODES = {
  badRequest: "OAUTH_MISSING_PARAMS",
  noSession: "OAUTH_SESSION_MISSING",
  expired: "OAUTH_EXPIRED",
  stateMismatch: "OAUTH_STATE_MISMATCH",
  redirectMismatch: "OAUTH_REDIRECT_MISMATCH",
  accessDenied: "OAUTH_ACCESS_DENIED",
  codeReplay: "OAUTH_CODE_REPLAY",
  incomplete: "OAUTH_SESSION_INCOMPLETE",
  unauthenticated: "OAUTH_AUTH_REQUIRED",
  exchangeFailed: "TOKEN_EXCHANGE_FAILED",
  generic: "OAUTH_CALLBACK_FAILED",
};

function buildProfileRedirect(req) {
  const proto = (req.headers["x-forwarded-proto"] || "https").split(",")[0];
  const host = req.headers.host;
  const origin = process.env.APP_ORIGIN || `${proto}://${host}`;
  return `${origin.replace(/\/$/, "")}/`;
}

function parseCookies(cookieHeader = "") {
  return cookieHeader.split(";").reduce((acc, part) => {
    const [key, ...rest] = part.trim().split("=");
    if (!key) return acc;
    acc[key] = rest.join("=");
    return acc;
  }, {});
}

function buildRedirectUri(req, provided) {
  if (provided) return decodeURIComponent(provided);
  const proto = (req.headers["x-forwarded-proto"] || "https").split(",")[0];
  const host = req.headers.host;
  const origin = process.env.APP_ORIGIN || `${proto}://${host}`;
  return `${origin.replace(/\/$/, "")}/oauth-callback.html?oauth=epic`;
}

function clearCookie(res) {
  res.setHeader("Set-Cookie", buildClearCookie());
}

function sendError(res, status, message, code = ERROR_CODES.generic, redirectUri) {
  clearCookie(res);
  const payload = { ok: false, error: message, errorCode: code };
  if (redirectUri) payload.redirect = redirectUri;
  res.status(status).json(payload);
}

function extractIdToken(req) {
  const authHeader = req.headers.authorization || "";
  if (authHeader.startsWith("Bearer ")) return authHeader.slice(7).trim();
  return null;
}

function extractRequestValues(req) {
  const method = req.method || "GET";
  if (method === "POST") {
    return req.body || {};
  }
  return req.query || {};
}

export default async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "POST") {
    sendError(res, 405, "Method not allowed", ERROR_CODES.badRequest, buildProfileRedirect(req));
    return;
  }

  res.setHeader("Cache-Control", "no-store");

  const values = extractRequestValues(req);
  const code = values.code;
  const state = values.state;
  const redirectParam = values.redirect_uri;
  const reportedError = values.error;
  const redirectBack = buildProfileRedirect(req);

  if (reportedError === "access_denied") {
    sendError(
      res,
      400,
      "Epic sign-in was cancelled. Restart linking from the app when ready.",
      ERROR_CODES.accessDenied,
      redirectBack
    );
    return;
  }

  if (!code || !state) {
    sendError(
      res,
      400,
      "Missing Epic authorization details. Restart the link from the app.",
      ERROR_CODES.badRequest,
      redirectBack
    );
    return;
  }

  const clientId = process.env.EPIC_CLIENT_ID;
  if (!clientId) {
    sendError(res, 500, "Missing EPIC_CLIENT_ID env", ERROR_CODES.generic, redirectBack);
    return;
  }

  const cookies = parseCookies(req.headers.cookie || "");
  const oauthCookie = cookies[COOKIE_NAME] ? decodeURIComponent(cookies[COOKIE_NAME]) : null;
  if (!oauthCookie) {
    sendError(
      res,
      400,
      "Epic sign-in timed out. Please try linking again.",
      ERROR_CODES.noSession,
      redirectBack
    );
    return;
  }

  let parsed;
  try {
    parsed = JSON.parse(oauthCookie);
  } catch (e) {
    sendError(
      res,
      400,
      "Epic sign-in session was invalid. Please restart the link.",
      ERROR_CODES.noSession,
      redirectBack
    );
    return;
  }

  if (!parsed.issuedAt || Date.now() - parsed.issuedAt > COOKIE_MAX_AGE * 1000) {
    sendError(
      res,
      400,
      "Epic sign-in expired. Restart the link from the app.",
      ERROR_CODES.expired,
      redirectBack
    );
    return;
  }

  if (!parsed.state || parsed.state !== state) {
    sendError(
      res,
      400,
      "Epic sign-in could not be verified. Restart the link from the app.",
      ERROR_CODES.stateMismatch,
      redirectBack
    );
    return;
  }

  const storedRedirectUri = parsed.redirectUri || buildRedirectUri(req, redirectParam);
  if (redirectParam) {
    const provided = decodeURIComponent(redirectParam);
    if (storedRedirectUri && provided !== storedRedirectUri) {
      sendError(
        res,
        400,
        "Epic redirect URI mismatch. Ensure the configured URI matches exactly.",
        ERROR_CODES.redirectMismatch,
        redirectBack
      );
      return;
    }
  }
  const redirectUri = storedRedirectUri;

  if (!redirectUri || !parsed.codeVerifier) {
    sendError(
      res,
      400,
      "Epic session incomplete. Restart the link from the app.",
      ERROR_CODES.incomplete,
      redirectBack
    );
    return;
  }

  const idToken = extractIdToken(req);
  const firebaseUser = await verifyFirebaseIdToken(idToken);
  if (!firebaseUser?.uid) {
    sendError(
      res,
      401,
      "Please sign in before linking your Epic account.",
      ERROR_CODES.unauthenticated,
      redirectBack
    );
    return;
  }

  const tokenEndpoint = "https://api.epicgames.dev/epic/oauth/v1/token";
  const form = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
    code_verifier: parsed.codeVerifier,
  });

  const headers = { "Content-Type": "application/x-www-form-urlencoded" };
  const clientSecret = process.env.EPIC_CLIENT_SECRET;
  if (clientSecret) {
    const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
    headers.Authorization = `Basic ${basicAuth}`;
  } else {
    form.set("client_id", clientId);
  }

  try {
    const resp = await fetch(tokenEndpoint, {
      method: "POST",
      headers,
      body: form.toString(),
    });

    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      const isCodeReplay = data.error === "invalid_grant";
      if (isCodeReplay) {
        sendError(
          res,
          resp.status,
          "That Epic sign-in link was already used or expired. Restart the link from the app.",
          ERROR_CODES.codeReplay,
          redirectBack
        );
        return;
      }
      const clientMismatch = data.error === "invalid_client" || data.error === "unauthorized_client";
      const redirectMismatch = data.error === "invalid_request" && data.error_description?.includes("redirect");
      const message = clientMismatch
        ? "Epic rejected the app credentials. Verify the client id/secret and redirect URI."
        : redirectMismatch
        ? "Epic rejected the redirect URI. Ensure it matches the configured callback exactly."
        : "Epic token exchange failed. Please retry linking.";
      sendError(
        res,
        resp.status,
        message,
        ERROR_CODES.exchangeFailed,
        redirectBack
      );
      return;
    }

    const epicAccountId = data.account_id || data.sub || data.accountId || null;
    const displayName = data.display_name || data.displayName || null;
    const scopes = ["basic_profile"]; // limited, future providers can expand
    const now = Date.now();

    if (!epicAccountId) {
      sendError(res, 400, "Epic account identifier missing", ERROR_CODES.exchangeFailed, redirectBack);
      return;
    }

    // OAuth linking does not grant Jam Track ownership. Account identifiers are kept solely
    // for future entitlement checks if Epic later allows them. Do not assume ownership today.
    const linkPayload = {
      provider: "epic",
      linked: true,
      accountId: epicAccountId,
      epicAccountId,
      providerUserId: epicAccountId,
      displayName,
      scopes,
      status: "linked",
      linkedAt: now,
      lastValidatedAt: now,
      lastUpdatedAt: now,
      metadata: { oauthVersion: "pkce" },
    };
    try {
      await setEpicLink(firebaseUser.uid, linkPayload, idToken);
    } catch (err) {
      sendError(res, 500, "Failed to store Epic link", ERROR_CODES.generic, redirectBack);
      return;
    }

    clearCookie(res);
    res
      .status(200)
      .json({ ok: true, linked: true, epicAccountId, displayName, linkedAt: now, lastValidatedAt: now });
  } catch (e) {
    sendError(res, 500, "OAuth callback failed", ERROR_CODES.generic, redirectBack);
  }
}
