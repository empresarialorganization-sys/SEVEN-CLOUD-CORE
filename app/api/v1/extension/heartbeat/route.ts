import { z } from "zod";
import { authExtension } from "@/lib/auth";
import { admin } from "@/lib/supabase-admin";
import { preflight,readJson,reply } from "@/lib/http";
export const runtime="nodejs";
const Body=z.object({sessionId:z.string().uuid(),tabId:z.union([z.string(),z.number()]).optional(),pageOrigin:z.string().max(500).nullable().optional()});
export async function OPTIONS(r:Request){return preflight(r)!;}
export async function POST(request:Request){
 const p=preflight(request);if(p)return p;const parsed=Body.safeParse(await readJson(request));if(!parsed.success)return reply(request,{ok:false,error:"invalid_body"},400);
 const b=parsed.data;if(!(await authExtension(request,b.sessionId)))return reply(request,{ok:false,error:"unauthorized"},401);
 let origin:string|null=null;try{if(b.pageOrigin)origin=new URL(b.pageOrigin).origin;}catch{}
 await admin().from("seven_sessions").update({last_seen_at:new Date().toISOString(),page_origin:origin,tab_id:b.tabId==null?null:String(b.tabId).slice(0,64)}).eq("session_id",b.sessionId);
 return reply(request,{ok:true,serverTime:new Date().toISOString()});
}
