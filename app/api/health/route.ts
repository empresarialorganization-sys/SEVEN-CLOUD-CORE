import { reply, preflight } from "@/lib/http";
import { admin } from "@/lib/supabase-admin";
import { env } from "@/lib/env";

export const runtime = "nodejs";

export async function OPTIONS(request: Request){ return preflight(request)!; }

export async function GET(request: Request){
  const p=preflight(request); if(p) return p;
  let database="error";
  try {
    const { data, error } = await admin().from("seven_workspaces").select("id").eq("id",env.workspaceId).maybeSingle();
    if(!error && data?.id===env.workspaceId) database="ok";
  } catch {}
  return reply(request,{ok:database==="ok",service:"seven-cloud-core",version:"0.8.0",database,time:new Date().toISOString()},database==="ok"?200:503);
}
