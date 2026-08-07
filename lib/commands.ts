import { admin } from "./supabase-admin";
import { jsonBytes } from "./security";

export const MAX_COMMAND_BYTES = 64 * 1024;
export const MAX_RESULT_BYTES = 256 * 1024;

export async function pushCommand(sessionId: string, payload: unknown): Promise<string> {
  if (jsonBytes(payload) > MAX_COMMAND_BYTES) throw new Error("command_too_large");
  const { data, error } = await admin().from("seven_commands")
    .insert({ session_id: sessionId, payload, status:"pending" })
    .select("id").single();
  if (error || !data) throw new Error("push_failed");
  return String(data.id);
}
export async function awaitResult(sessionId: string, commandId: string, timeoutMs: number) {
  const deadline = Date.now() + timeoutMs;
  let delay = 180;
  while (Date.now() < deadline) {
    const { data } = await admin().from("seven_results")
      .select("payload").eq("command_id", commandId).eq("session_id", sessionId).maybeSingle();
    if (data) return { status:"completed" as const, result:data.payload };
    await new Promise(r => setTimeout(r, delay));
    delay = Math.min(650, Math.floor(delay * 1.35));
  }
  return { status:"timeout" as const };
}
