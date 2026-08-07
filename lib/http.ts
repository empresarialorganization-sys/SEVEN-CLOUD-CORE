const CHAT_ORIGINS = new Set(["https://chatgpt.com", "https://www.chatgpt.com", "https://chat.openai.com"]);
export function allowedOrigin(origin: string | null): boolean {
  if (!origin) return true;
  if (CHAT_ORIGINS.has(origin)) return true;
  if (/^(chrome|opera|moz)-extension:\/\/[a-z0-9._-]+$/i.test(origin)) return true;
  if (/^https:\/\/[a-z0-9-]+(?:-[a-z0-9-]+)*\.vercel\.app$/i.test(origin)) return true;
  if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin)) return true;
  return false;
}
export function headers(origin: string | null): HeadersInit {
  return {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store, max-age=0",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    "Access-Control-Allow-Origin": origin && allowedOrigin(origin) ? origin : "null",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Authorization,Content-Type,X-SEVEN-Session",
    "Access-Control-Max-Age": "3600",
    "Vary": "Origin",
  };
}
export function preflight(request: Request): Response | null {
  const origin = request.headers.get("origin");
  if (origin && !allowedOrigin(origin)) return reply(request, { ok:false, error:"origin_not_allowed" }, 403);
  if (request.method === "OPTIONS") return new Response(null, { status:204, headers:headers(origin) });
  return null;
}
export function reply(request: Request, body: unknown, status=200): Response {
  return new Response(JSON.stringify(body), { status, headers: headers(request.headers.get("origin")) });
}
export async function readJson<T = Record<string, unknown>>(request: Request, maxBytes=128*1024): Promise<T | null> {
  try {
    const raw = await request.text();
    if (Buffer.byteLength(raw, "utf8") > maxBytes) return null;
    const obj = JSON.parse(raw);
    return obj && typeof obj === "object" ? obj as T : null;
  } catch { return null; }
}
