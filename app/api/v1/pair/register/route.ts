import { z } from "zod";
import { admin } from "@/lib/supabase-admin";
import { env } from "@/lib/env";
import { requireWorkspaceEnrollment } from "@/lib/auth";
import { sha256Hex } from "@/lib/security";
import { preflight, readJson, reply } from "@/lib/http";
import { clientIp, rateLimit } from "@/lib/rate-limit";
export const runtime="nodejs";
const Body=z.object({
  pairCode:z.string().regex(/^\d{6}$/), sessionId:z.string().uuid(), extensionToken:z.string().min(32).max(256),
  browserKind:z.enum(["opera","chrome","chromium","other"]).default("other"), browserVersion:z.string().max(80).optional(),
});
export async function OPTIONS(r:Request){ return preflight(r)!; }
export async function POST(request:Request){
  const p=preflight(request); if(p) return p;
  if(!(await requireWorkspaceEnrollment(request))) return reply(request,{ok:false,error:"workspace_enrollment_denied"},401);
  if(!(await rateLimit(`register:${clientIp(request)}`,20,60))) return reply(request,{ok:false,error:"rate_limited"},429);
  const parsed=Body.safeParse(await readJson(request)); if(!parsed.success) return reply(request,{ok:false,error:"invalid_body"},400);
  const b=parsed.data, now=new Date(), expiry=new Date(Date.now()+5*60*1000);
  await admin().from("seven_sessions").update({pair_code:null}).eq("workspace_id",env.workspaceId).eq("pair_code",b.pairCode).lt("pair_expires_at",now.toISOString());
  const {error}=await admin().from("seven_sessions").upsert({
    session_id:b.sessionId,workspace_id:env.workspaceId,extension_token_hash:sha256Hex(b.extensionToken),pair_code:b.pairCode,
    pair_expires_at:expiry.toISOString(),claimed_at:null,last_seen_at:now.toISOString(),browser_kind:b.browserKind,browser_version:b.browserVersion||null,
    revoked_at:null,
  },{onConflict:"session_id"});
  if(error) return reply(request,{ok:false,error:"pair_code_unavailable"},409);
  return reply(request,{ok:true,sessionId:b.sessionId,expiresAt:expiry.toISOString()});
}
