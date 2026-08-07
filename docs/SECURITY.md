# Security model

- Extension registration requires a private **workspace enrollment key**. Only its SHA-256 hash is stored in Vercel env.
- Extension auth uses `Authorization: Bearer <extensionToken>`; tokens are never in URLs.
- MCP receives a short-lived `sessionHandle`, not the extension token. Only its SHA-256 hash is persisted.
- Pair codes are six digits, one-use and expire after five minutes; rate limiting applies.
- Supabase service-role key is server-only and must never use a `NEXT_PUBLIC_` prefix.
- All SEVEN tables have RLS enabled with no anon/authenticated policies. Storage bucket is private.
- Vault upload uses signed upload URLs; Vercel does not proxy large file bodies.
- Source URLs are metadata only. Cloud Core does not fetch arbitrary web URLs on behalf of the browser, reducing SSRF risk.
- Sensitive browser actions remain protected by the extension's safety gate. Password fields remain blocked.
- Logs must not contain enrollment keys, extension tokens, session handles, command payloads, page contents, or file bytes.
