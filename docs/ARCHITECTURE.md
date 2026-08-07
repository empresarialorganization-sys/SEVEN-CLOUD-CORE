# Architecture

SEVEN v0.8 separates four responsibilities:

- **Cloud Core / Vercel:** MCP endpoint, validation, short-lived handles, command orchestration, signed Vault upload creation.
- **Supabase:** private Postgres state and private Storage.
- **Browser extension:** structural browser execution, local Vault staging, downloads, tab hygiene; stores the extension token and enrollment key locally.
- **Dev Companion:** remains local on the user's machine for source files, Git, commands, tests and dev servers.

Browser secrets never need to be returned by the MCP. `seven_pair` exchanges a one-time 6-digit code for a short-lived opaque `sessionHandle` whose hash is stored in Supabase.

## Dev loop through the same MCP

The Cloud Core exposes Dev Companion tools by sending utility commands through the paired extension. This keeps the local workspace private and avoids opening a public terminal. Initial tools cover status, listing/search, read/write, bounded commands, persistent dev processes, Git status and Git diff.
