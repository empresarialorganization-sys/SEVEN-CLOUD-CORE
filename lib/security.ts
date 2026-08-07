import crypto from "node:crypto";

export function sha256Hex(value: string): string {
  return crypto.createHash("sha256").update(value, "utf8").digest("hex");
}
export function randomToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString("base64url");
}
export function safeEqualHex(a: string, b: string): boolean {
  if (!/^[0-9a-f]+$/i.test(a) || !/^[0-9a-f]+$/i.test(b) || a.length !== b.length || a.length % 2) return false;
  return crypto.timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex"));
}
export function bearer(request: Request): string | null {
  const value = request.headers.get("authorization") || "";
  const m = value.match(/^Bearer\s+([^\s]+)$/i);
  return m?.[1] || null;
}
export function sanitizeFilename(raw: string): string {
  const base = raw.replace(/[/\\\0<>:"|?*]/g, "_").replace(/\s+/g, " ").trim();
  return (base || `seven-asset-${Date.now()}.bin`).slice(0, 180);
}
export function safeSourceUrl(raw?: string | null): string | null {
  if (!raw) return null;
  try {
    const u = new URL(raw);
    return ["http:", "https:"].includes(u.protocol) ? u.toString().slice(0, 2000) : null;
  } catch { return null; }
}
export function jsonBytes(value: unknown): number {
  return Buffer.byteLength(JSON.stringify(value), "utf8");
}
