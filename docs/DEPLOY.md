# Deploy: GitHub + Vercel + Supabase

## Supabase
- Create one project in an Americas region near the user.
- Keep automatic public table exposure off where possible; use RLS.
- Apply every migration in `supabase/migrations` in filename order.
- Read the workspace UUID with `select id from public.seven_workspaces where slug='seven';` and use it as `SEVEN_WORKSPACE_ID`.
- Copy Project URL and **service role** key only into Vercel server environment variables.

## Secrets
Generate only the enrollment credential locally (the workspace UUID comes from Supabase):

```bash
node -e "const c=require('crypto'); const k=c.randomBytes(32).toString('base64url'); console.log('ENROLLMENT_KEY='+k); console.log('SEVEN_WORKSPACE_KEY_HASH='+c.createHash('sha256').update(k).digest('hex'))"
```

Keep `ENROLLMENT_KEY` for the extension. Never commit it. Vercel gets only its hash.

## Vercel
- Import the private GitHub repository.
- Node 20+.
- Add variables from `.env.example`.
- Deploy and test `/api/health`.
- MCP endpoint is `/mcp` over Streamable HTTP.

## ChatGPT
Create/update the private SEVEN Operator plugin to point to the deployed `/mcp` URL. Tool-only UI is intentional for v0.8.
