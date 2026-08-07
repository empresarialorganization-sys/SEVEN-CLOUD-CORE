import { admin } from "./supabase-admin";
export function clientIp(request: Request): string {
  return request.headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim()
    || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || "unknown";
}
export async function rateLimit(key: string, limit: number, windowSeconds: number): Promise<boolean> {
  const { data, error } = await admin().rpc("seven_rate_limit", {
    _key: key, _limit: limit, _window_seconds: windowSeconds,
  });
  if (error) return false; // fail closed for security-sensitive endpoints
  return data === true;
}
