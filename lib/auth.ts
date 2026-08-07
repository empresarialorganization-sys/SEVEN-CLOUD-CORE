import { admin } from "./supabase-admin";
import { env } from "./env";
import { bearer, safeEqualHex, sha256Hex } from "./security";

export async function requireWorkspaceEnrollment(request: Request): Promise<boolean> {
  const token = bearer(request);
  if (!token || token.length < 24) return false;
  return safeEqualHex(sha256Hex(token), env.workspaceKeyHash);
}

export async function authExtension(request: Request, sessionId: string) {
  const token = bearer(request);
  if (!token || token.length < 32 || !sessionId) return null;
  const { data } = await admin().from("seven_sessions")
    .select("session_id,workspace_id,extension_token_hash,last_seen_at,revoked_at")
    .eq("session_id", sessionId).eq("workspace_id", env.workspaceId).maybeSingle();
  if (!data || data.revoked_at || !safeEqualHex(sha256Hex(token), data.extension_token_hash)) return null;
  return data;
}

export async function resolveHandle(handle: string) {
  if (!handle || handle.length < 32) return null;
  const hash = sha256Hex(handle);
  const { data } = await admin().from("seven_session_handles")
    .select("id,session_id,expires_at,revoked_at,last_used_at")
    .eq("handle_hash", hash).maybeSingle();
  if (!data || data.revoked_at || Date.parse(data.expires_at) <= Date.now()) return null;
  const { data: session } = await admin().from("seven_sessions")
    .select("session_id,workspace_id,revoked_at")
    .eq("session_id", data.session_id).eq("workspace_id", env.workspaceId).maybeSingle();
  if (!session || session.revoked_at) return null;
  await admin().from("seven_session_handles").update({ last_used_at: new Date().toISOString() }).eq("id", data.id);
  return { ...data, workspace_id: session.workspace_id };
}
