import { authExtension } from "@/lib/auth";
import { admin } from "@/lib/supabase-admin";
import { preflight, reply } from "@/lib/http";
export const runtime="nodejs";
export async function OPTIONS(r:Request){return preflight(r)!;}
export async function GET(request:Request){
  const p=preflight(request); if(p)return p;
  const sessionId=new URL(request.url).searchParams.get("session")||"";
  if(!(await authExtension(request,sessionId))) return reply(request,{ok:false,error:"unauthorized"},401);
  const {data}=await admin().from("seven_commands").select("id,payload,created_at")
    .eq("session_id",sessionId).eq("status","pending").order("created_at",{ascending:true}).limit(1).maybeSingle();
  await admin().from("seven_sessions").update({last_seen_at:new Date().toISOString()}).eq("session_id",sessionId);
  if(!data) return reply(request,{ok:true,command:null});
  await admin().from("seven_commands").update({delivered_at:new Date().toISOString()}).eq("id",data.id);
  return reply(request,{ok:true,command:{id:data.id,payload:data.payload,createdAt:data.created_at}});
}
