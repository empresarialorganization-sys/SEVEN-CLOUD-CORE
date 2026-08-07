import { reply, preflight } from "@/lib/http";
import { admin } from "@/lib/supabase-admin";
import { env } from "@/lib/env";

export const runtime = "nodejs";

function classify(value?: string){
  const v=value?.trim();
  if(!v) return "missing";
  if(v.startsWith("sb_secret_")) return "secret";
  if(v.startsWith("sb_publishable_")) return "publishable";
  if(v.split(".").length>=3){
    try{
      const raw=v.split(".")[1].replace(/-/g,"+").replace(/_/g,"/");
      const role=JSON.parse(Buffer.from(raw,"base64").toString("utf8"))?.role;
      if(role==="service_role") return "jwt_service_role";
      if(role==="anon") return "jwt_anon";
      return "jwt_other";
    }catch{return "jwt_invalid";}
  }
  return "other";
}

export async function OPTIONS(request: Request){ return preflight(request)!; }

export async function GET(request: Request){
  const p=preflight(request); if(p) return p;
  let database="error";
  try {
    const { data, error } = await admin().from("seven_workspaces").select("id").eq("id",env.workspaceId).maybeSingle();
    if(!error && data?.id===env.workspaceId) database="ok";
  } catch {}
  const credentials={
    SUPABASE_SERVICE_ROLE_KEY: classify(process.env.SUPABASE_SERVICE_ROLE_KEY),
    supabase2: classify(process.env.supabase2),
    supabeto1: classify(process.env.supabeto1),
  };
  return reply(request,{ok:database==="ok",service:"seven-cloud-core",version:"0.8.0",database,credentials,time:new Date().toISOString()},database==="ok"?200:503);
}
