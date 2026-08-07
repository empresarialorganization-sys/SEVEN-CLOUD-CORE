import { z } from "zod";
import { authExtension } from "@/lib/auth";
import { admin } from "@/lib/supabase-admin";
import { MAX_RESULT_BYTES } from "@/lib/commands";
import { jsonBytes } from "@/lib/security";
import { preflight, readJson, reply } from "@/lib/http";
export const runtime="nodejs";
const Body=z.object({sessionId:z.string().uuid(),commandId:z.string().uuid(),payload:z.unknown()});
export async function OPTIONS(r:Request){return preflight(r)!;}
export async function POST(request:Request){
  const p=preflight(request);if(p)return p;
  const parsed=Body.safeParse(await readJson(request,MAX_RESULT_BYTES+8192)); if(!parsed.success)return reply(request,{ok:false,error:"invalid_body"},400);
  const b=parsed.data;if(jsonBytes(b.payload)>MAX_RESULT_BYTES)return reply(request,{ok:false,error:"result_too_large"},413);
  if(!(await authExtension(request,b.sessionId)))return reply(request,{ok:false,error:"unauthorized"},401);
  const {data:cmd}=await admin().from("seven_commands").select("id").eq("id",b.commandId).eq("session_id",b.sessionId).maybeSingle();
  if(!cmd)return reply(request,{ok:false,error:"command_not_found"},404);
  const {error}=await admin().from("seven_results").upsert({command_id:b.commandId,session_id:b.sessionId,payload:b.payload},{onConflict:"command_id"});
  if(error)return reply(request,{ok:false,error:"result_failed"},500);
  await admin().from("seven_commands").update({status:"completed",completed_at:new Date().toISOString()}).eq("id",b.commandId);
  return reply(request,{ok:true});
}
