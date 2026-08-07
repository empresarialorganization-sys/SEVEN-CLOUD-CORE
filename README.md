# SEVEN Cloud Core v0.8

Private cloud core for SEVEN: ChatGPT MCP + browser command bridge + persistent Supabase Vault.

## Architecture

`ChatGPT -> /mcp (Vercel) -> Supabase command queue -> SEVEN extension -> Opera/Chrome`

Assets follow a separate persistent path:

`browser/local file -> SEVEN extension -> signed upload -> private Supabase Storage -> MCP fetch -> ChatGPT`

The Vault is workspace-scoped, not browser-session-scoped, so assets survive reconnects and browser restarts.

## Quick deployment

1. Create a private GitHub repository and push this folder.
2. Create a Supabase project and apply the SQL files in `supabase/migrations/` in filename order.
3. Read `SEVEN_WORKSPACE_ID` from the workspace row created by the migration and generate a high-entropy enrollment key. Store only its SHA-256 as `SEVEN_WORKSPACE_KEY_HASH` in Vercel.
4. Import the GitHub repo into Vercel and set all variables from `.env.example`.
5. Deploy; verify `https://YOUR_DOMAIN/api/health` and `https://YOUR_DOMAIN/mcp`.
6. Configure the v0.8 SEVEN extension with Cloud Core URL + plaintext enrollment key once, then generate a fresh 6-digit pairing code.
7. Refresh/recreate the private ChatGPT plugin pointing at `https://YOUR_DOMAIN/mcp`.

See `docs/DEPLOY.md`, `docs/SECURITY.md`, `docs/VAULT.md`.
