import { createMcpHandler } from "mcp-handler";
import { z } from "zod";
import { admin } from "@/lib/supabase-admin";
import { env } from "@/lib/env";
import { randomToken,sha256Hex } from "@/lib/security";
import { resolveHandle } from "@/lib/auth";
import { pushCommand,awaitResult } from "@/lib/commands";
import { vaultAsset,vaultSearch,publicAssetMeta } from "@/lib/vault";
import { rateLimit } from "@/lib/rate-limit";

export const runtime="nodejs";
export const maxDuration=60;
const Handle=z.string().min(32).max(512).describe("Opaque short-lived session handle returned by seven_pair.");
const Target=z.object({tabId:z.number().int().optional(),titleContains:z.string().optional(),urlPrefix:z.string().optional(),active:z.boolean().optional()}).optional();
const text=(data:unknown)=>({content:[{type:"text" as const,text:JSON.stringify(data,null,2)}]});
const err=(message:string,extra:Record<string,unknown>={})=>({isError:true,content:[{type:"text" as const,text:JSON.stringify({ok:false,error:message,...extra})}]});

async function handleSession(sessionHandle:string){return await resolveHandle(sessionHandle);}
async function runBrowser(sessionHandle:string,envelope:unknown,timeout:number){
 const h=await handleSession(sessionHandle);if(!h)return {error:"invalid_or_expired_session" as const};
 const commandId=await pushCommand(h.session_id,envelope);const outcome=await awaitResult(h.session_id,commandId,timeout);
 return {h,commandId,outcome};
}

const handler=createMcpHandler(async(server)=>{
 server.registerTool("seven_pair",{
  title:"Pair with SEVEN",description:"Use this when the user gives a fresh 6-digit code from the SEVEN extension. Claims the browser session and returns an opaque short-lived sessionHandle. No browser secret is returned.",
  inputSchema:z.object({code:z.string().regex(/^\d{6}$/)}),annotations:{readOnlyHint:false,destructiveHint:false,idempotentHint:false,openWorldHint:true},
 },async({code})=>{
  if(!(await rateLimit(`mcp-pair:${code}`,8,300)))return err("rate_limited");
  const now=new Date().toISOString();const {data:s}=await admin().from("seven_sessions").select("session_id,workspace_id,pair_expires_at,last_seen_at").eq("workspace_id",env.workspaceId).eq("pair_code",code).is("claimed_at",null).gt("pair_expires_at",now).maybeSingle();
  if(!s)return err("pairing_not_available");
  const handle=randomToken(32),expiresAt=new Date(Date.now()+env.handleTtlHours*3600_000).toISOString();
  const {error}=await admin().from("seven_session_handles").insert({session_id:s.session_id,handle_hash:sha256Hex(handle),expires_at:expiresAt});
  if(error)return err("pairing_failed");
  await admin().from("seven_sessions").update({claimed_at:now,pair_code:null}).eq("session_id",s.session_id);
  return text({ok:true,sessionHandle:handle,expiresAt,connected:!!s.last_seen_at&&Date.now()-Date.parse(s.last_seen_at)<15000});
 });

 server.registerTool("seven_status",{
  title:"SEVEN status",description:"Use this when you need to verify whether the paired browser is online before a browser action.",inputSchema:z.object({sessionHandle:Handle}),
  annotations:{readOnlyHint:true,destructiveHint:false,idempotentHint:true,openWorldHint:true},
 },async({sessionHandle})=>{const h=await handleSession(sessionHandle);if(!h)return err("invalid_or_expired_session");const {data:s}=await admin().from("seven_sessions").select("last_seen_at,page_origin,browser_kind,browser_version,revoked_at").eq("session_id",h.session_id).maybeSingle();if(!s||s.revoked_at)return err("session_revoked");const {count}=await admin().from("seven_commands").select("id",{count:"exact",head:true}).eq("session_id",h.session_id).eq("status","pending");return text({ok:true,connected:!!s.last_seen_at&&Date.now()-Date.parse(s.last_seen_at)<15000,lastSeenAt:s.last_seen_at,pageOrigin:s.page_origin,browser:s.browser_kind,browserVersion:s.browser_version,pendingCommands:count||0});});

 server.registerTool("seven_vision",{
  title:"See browser structurally",description:"Use this when you need a structured, screenshot-free view of the paired browser. diff=true returns only changes since the previous vision.",inputSchema:z.object({sessionHandle:Handle,target:Target,diff:z.boolean().optional(),max:z.number().int().min(1).max(500).optional()}),
  annotations:{readOnlyHint:true,destructiveHint:false,idempotentHint:true,openWorldHint:true},
 },async({sessionHandle,target,diff,max})=>{try{const r=await runBrowser(sessionHandle,{v:1,action:diff?"visionDiff":"vision",target,args:{max:max||60,includeContext:true}},20000);if("error" in r)return err(r.error);if(r.outcome.status!=="completed")return err("browser_timeout",{commandId:r.commandId});return text({ok:true,commandId:r.commandId,result:r.outcome.result});}catch{return err("vision_failed");}});

 server.registerTool("seven_mission",{
  title:"Run browser mission",description:"Use this when you need to navigate, click, type, scroll, extract, or run an ordered browser workflow. It changes browser state; the extension safety gate still stops sensitive actions for user confirmation.",inputSchema:z.object({sessionHandle:Handle,target:Target,steps:z.array(z.record(z.unknown())).min(1).max(100),finalVision:z.union([z.literal("full"),z.literal("diff"),z.literal(false)]).optional(),visionMax:z.number().int().min(1).max(500).optional(),maxRuntimeMs:z.number().int().min(1000).max(45000).optional()}),
  annotations:{readOnlyHint:false,destructiveHint:true,idempotentHint:false,openWorldHint:true},
 },async({sessionHandle,target,steps,finalVision,visionMax,maxRuntimeMs})=>{try{const r=await runBrowser(sessionHandle,{v:1,action:"mission",target,steps,finalVision,visionMax,maxRuntimeMs},50000);if("error" in r)return err(r.error);if(r.outcome.status!=="completed")return err("mission_timeout",{commandId:r.commandId});return text({ok:true,commandId:r.commandId,result:r.outcome.result});}catch{return err("mission_failed");}});


 server.registerTool("seven_dev_status",{
  title:"SEVEN Dev status",description:"Use this when you need to check whether the local SEVEN Dev Companion is online and which authorized workspace it controls.",inputSchema:z.object({sessionHandle:Handle}),
  annotations:{readOnlyHint:true,destructiveHint:false,idempotentHint:true,openWorldHint:false},
 },async({sessionHandle})=>{try{const r=await runBrowser(sessionHandle,{v:1,action:"devStatus"},12000);if("error" in r)return err(r.error);if(r.outcome.status!=="completed")return err("dev_timeout");return text({ok:true,result:r.outcome.result});}catch{return err("dev_status_failed");}});

 server.registerTool("seven_dev_list",{
  title:"List project files",description:"Use this when you need to inspect files/folders inside the Dev Companion's authorized local workspace.",inputSchema:z.object({sessionHandle:Handle,path:z.string().max(800).default("."),limit:z.number().int().min(1).max(500).default(200)}),
  annotations:{readOnlyHint:true,destructiveHint:false,idempotentHint:true,openWorldHint:false},
 },async({sessionHandle,path,limit})=>{const r=await runBrowser(sessionHandle,{v:1,action:"devList",args:{path,limit}},15000);if("error" in r)return err(r.error);return r.outcome.status==="completed"?text({ok:true,result:r.outcome.result}):err("dev_timeout");});

 server.registerTool("seven_dev_search",{
  title:"Search project code",description:"Use this when you need to find text, symbols, components, functions, errors, or configuration inside the authorized local code workspace.",inputSchema:z.object({sessionHandle:Handle,query:z.string().min(1).max(300),path:z.string().max(800).default("."),maxResults:z.number().int().min(1).max(200).default(80)}),
  annotations:{readOnlyHint:true,destructiveHint:false,idempotentHint:true,openWorldHint:false},
 },async({sessionHandle,query,path,maxResults})=>{const r=await runBrowser(sessionHandle,{v:1,action:"devSearch",args:{query,path,maxResults}},18000);if("error" in r)return err(r.error);return r.outcome.status==="completed"?text({ok:true,result:r.outcome.result}):err("dev_timeout");});

 server.registerTool("seven_dev_read",{
  title:"Read project file",description:"Use this when you need source/configuration text from a file inside the authorized local Dev workspace.",inputSchema:z.object({sessionHandle:Handle,path:z.string().min(1).max(800),maxBytes:z.number().int().min(256).max(20000).default(12000)}),
  annotations:{readOnlyHint:true,destructiveHint:false,idempotentHint:true,openWorldHint:false},
 },async({sessionHandle,path,maxBytes})=>{const r=await runBrowser(sessionHandle,{v:1,action:"devRead",args:{path,maxBytes}},15000);if("error" in r)return err(r.error);return r.outcome.status==="completed"?text({ok:true,result:r.outcome.result}):err("dev_timeout");});

 server.registerTool("seven_dev_write",{
  title:"Write project file",description:"Use this when you need to create or replace a text file inside the authorized local Dev workspace. The Dev Companion creates a backup by default and blocks paths outside the workspace.",inputSchema:z.object({sessionHandle:Handle,path:z.string().min(1).max(800),text:z.string().max(500000),createBackup:z.boolean().default(true)}),
  annotations:{readOnlyHint:false,destructiveHint:false,idempotentHint:false,openWorldHint:false},
 },async({sessionHandle,path,text:createText,createBackup})=>{const r=await runBrowser(sessionHandle,{v:1,action:"devWrite",args:{path,text:createText,createBackup}},20000);if("error" in r)return err(r.error);return r.outcome.status==="completed"?text({ok:true,result:r.outcome.result}):err("dev_timeout");});

 server.registerTool("seven_dev_run",{
  title:"Run project command",description:"Use this when you need to run a bounded command such as tests, build, package scripts, or an allowed development utility in the local Dev workspace. The local companion's safe-mode allowlist remains authoritative.",inputSchema:z.object({sessionHandle:Handle,argv:z.array(z.string().max(1000)).min(1).max(40),timeoutMs:z.number().int().min(1000).max(30000).default(20000)}),
  annotations:{readOnlyHint:false,destructiveHint:true,idempotentHint:false,openWorldHint:false},
 },async({sessionHandle,argv,timeoutMs})=>{const r=await runBrowser(sessionHandle,{v:1,action:"devRun",args:{argv,timeoutMs}},35000);if("error" in r)return err(r.error);return r.outcome.status==="completed"?text({ok:true,result:r.outcome.result}):err("dev_timeout");});

 server.registerTool("seven_dev_process",{
  title:"Manage dev process",description:"Use this for a long-running local development process: start a dev server, read its status/logs, or stop it. Safe-mode restrictions remain enforced locally.",inputSchema:z.object({sessionHandle:Handle,operation:z.enum(["start","status","logs","stop"]),argv:z.array(z.string().max(1000)).max(40).optional(),processId:z.string().max(120).optional(),tail:z.number().int().min(1).max(500).default(120)}),
  annotations:{readOnlyHint:false,destructiveHint:true,idempotentHint:false,openWorldHint:false},
 },async({sessionHandle,operation,argv,processId,tail})=>{const map={start:"devProcessStart",status:"devProcessStatus",logs:"devProcessLogs",stop:"devProcessStop"} as const;const args=operation==="start"?{argv:argv||[]}:{processId:processId||"",tail};const r=await runBrowser(sessionHandle,{v:1,action:map[operation],args},18000);if("error" in r)return err(r.error);return r.outcome.status==="completed"?text({ok:true,result:r.outcome.result}):err("dev_timeout");});

 server.registerTool("seven_dev_git_status",{
  title:"Git status",description:"Use this when you need a read-only Git status for the authorized local project.",inputSchema:z.object({sessionHandle:Handle}),annotations:{readOnlyHint:true,destructiveHint:false,idempotentHint:true,openWorldHint:false},
 },async({sessionHandle})=>{const r=await runBrowser(sessionHandle,{v:1,action:"devGitStatus"},12000);if("error" in r)return err(r.error);return r.outcome.status==="completed"?text({ok:true,result:r.outcome.result}):err("dev_timeout");});

 server.registerTool("seven_dev_git_diff",{
  title:"Git diff",description:"Use this when you need a read-only Git diff from the authorized local project before or after code changes.",inputSchema:z.object({sessionHandle:Handle,path:z.string().max(800).optional(),maxBytes:z.number().int().min(256).max(20000).default(16000)}),annotations:{readOnlyHint:true,destructiveHint:false,idempotentHint:true,openWorldHint:false},
 },async({sessionHandle,path,maxBytes})=>{const r=await runBrowser(sessionHandle,{v:1,action:"devGitDiff",args:{path:path||null,maxBytes}},12000);if("error" in r)return err(r.error);return r.outcome.status==="completed"?text({ok:true,result:r.outcome.result}):err("dev_timeout");});

 server.registerTool("seven_vault_search",{
  title:"Search SEVEN Vault",description:"Use this when you need an image, video, PDF, logo, product asset, reference, or other file previously saved in the user's persistent SEVEN Vault. Search works across every niche and project.",inputSchema:z.object({sessionHandle:Handle,query:z.string().max(300).optional(),project:z.string().max(120).optional(),niche:z.string().max(120).optional(),tags:z.array(z.string().max(60)).max(20).optional(),mimeType:z.string().max(120).optional(),limit:z.number().int().min(1).max(100).optional()}),
  annotations:{readOnlyHint:true,destructiveHint:false,idempotentHint:true,openWorldHint:false},
 },async({sessionHandle,...args})=>{if(!(await handleSession(sessionHandle)))return err("invalid_or_expired_session");try{return text({ok:true,assets:await vaultSearch(args)});}catch{return err("vault_search_failed");}});

 server.registerTool("seven_vault_fetch",{
  title:"Fetch SEVEN Vault asset",description:"Use this after seven_vault_search to retrieve one saved asset. Images up to the configured inline limit are returned as actual MCP image content so the model can inspect/use them without the user manually attaching the file.",inputSchema:z.object({sessionHandle:Handle,assetId:z.string().uuid(),mode:z.enum(["auto","inline","url"]).default("auto")}),
  annotations:{readOnlyHint:true,destructiveHint:false,idempotentHint:true,openWorldHint:false},
 },async({sessionHandle,assetId,mode})=>{if(!(await handleSession(sessionHandle)))return err("invalid_or_expired_session");const a=await vaultAsset(assetId);if(!a)return err("asset_not_found");const meta=publicAssetMeta(a);const image=String(a.mime_type).startsWith("image/");
   if(image&&mode!=="url"&&Number(a.byte_size)<=env.maxInlineImageBytes){const {data,error}=await admin().storage.from(env.bucket).download(a.storage_path);if(!error&&data){const b64=Buffer.from(await data.arrayBuffer()).toString("base64");return {content:[{type:"text" as const,text:JSON.stringify({ok:true,asset:meta})},{type:"image" as const,data:b64,mimeType:a.mime_type}]};}}
   const {data,error}=await admin().storage.from(env.bucket).createSignedUrl(a.storage_path,600,{download:a.name});if(error||!data)return err("asset_url_failed");return text({ok:true,asset:meta,signedUrl:data.signedUrl,expiresInSeconds:600});
 });
}, {}, {basePath:"",verboseLogs:false,maxDuration:60,disableSse:true});
export {handler as GET,handler as POST,handler as DELETE};
