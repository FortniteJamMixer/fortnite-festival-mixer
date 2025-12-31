# Epic OAuth Firestore Schema & Ops Playbook

This document locks in the Firestore layout for Epic OAuth links and codifies the operational guardrails needed for production. The schema is provider-agnostic so other OAuth providers can reuse the same shape without migrations.

## Collection layout

- `users/{uid}/integrations/{provider}` (subcollection per user)
  - `provider` **(string)**: provider id (`"epic"`, `"spotify"`, etc.).
  - `providerUserId` **(string)**: canonical account id from the provider.
  - `epicAccountId` **(string)**: alias kept for compatibility with current code; mirrors `providerUserId`.
  - `displayName` **(string, optional)**: friendly name returned during link.
  - `linked` **(bool)**: true when the account is active; deletion removes the doc.
  - `status` **(string)**: lifecycle marker (`"linked"`, `"revoked"`, `"error"`, etc.).
  - `scopes` **(array<string>)**: scopes granted when the link was created. Defaults to `["basic_profile"]` for Epic.
  - `linkedAt` **(timestamp)**: when the user first linked.
  - `lastValidatedAt` **(timestamp)**: last time tokens/claims were validated server-side.
  - `lastUpdatedAt` **(timestamp)**: last write to the document.
  - `metadata` **(map<string,string>, optional)**: small, provider-specific facts (e.g., `oauthVersion: "pkce"`).

### Why this structure

- Per-provider docs avoid future rewrites when adding new OAuth providers.
- `scopes` and `metadata` keep us forward-compatible with richer auth flows without storing tokens.
- `epicAccountId` remains for backward compatibility while `providerUserId` is the canonical key.

## Access patterns

- Writes happen only from server functions with a Firebase ID token (REST API with Bearer token).
- Reads for the client go through `/api/oauth/epic/status` to enforce auth and strip sensitive fields.
- Deletes use document deletion (`unlink`) to guarantee complete removal of provider details.

## Security & Firestore rules

Recommended rule snippet (align with the schema above):

```rules
match /databases/{database}/documents {
  match /users/{userId}/integrations/{provider} {
    allow read, write: if request.auth.uid == userId
      && request.resource.data.provider == provider
      && !('tokens' in request.resource.data); // defensive: tokens not stored
  }
}
```

Operational expectations:
- Reject storing OAuth tokens or refresh tokens entirely; only metadata is allowed.
- Enforce same-origin redirects via `APP_ORIGIN` to prevent code exfiltration (mirrors `/api/oauth/epic/start`).
- Use short-lived, HttpOnly, Secure cookies for PKCE state (already implemented).

## Operational checklist

### Pre-production
- [ ] Set `APP_ORIGIN`, `EPIC_CLIENT_ID`, `EPIC_CLIENT_SECRET`, `FIREBASE_API_KEY`, and `FIREBASE_PROJECT_ID` in Vercel/hosting environment.
- [ ] Register redirect: `<APP_ORIGIN>/oauth-callback.html?oauth=epic` in Epic Developer Portal; no wildcards.
- [ ] Confirm Firestore rules deny token storage and restrict writes to authenticated users only.
- [ ] Enable structured logging/sanitization so authorization codes, tokens, and cookies never hit logs.
- [ ] Turn on monitoring for `/api/oauth/epic/*` (latency, 4xx/5xx, rate limits).

### Runbook highlights
- OAuth cookies are single-use and cleared on success/failure; retry by restarting the link flow.
- Token exchange failures return `TOKEN_EXCHANGE_FAILED`; client should surface a generic retry message.
- Unlink deletes the `integrations/{provider}` doc; status endpoint caches nothing and always re-reads Firestore.
- To add another provider, reuse the same document shape with a new `{provider}` id and provider-specific scopes.

## Future-proofing notes

- Keep `metadata` limited to safe strings (no PII beyond display names/account ids) to avoid schema churn.
- If provider tokens ever need storage, create a separate `tokens` subcollection to avoid rewriting this doc.
- Scope expansions should append to the `scopes` array; avoid overwriting past grants for auditability.
