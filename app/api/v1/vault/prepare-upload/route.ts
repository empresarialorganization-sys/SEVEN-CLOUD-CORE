import { z } from "zod";
import { authExtension } from "@/lib/auth";
import { admin } from "@/lib/supabase-admin";
import { env } from "@/lib/env";
import { preflight,readJson,reply } from "@/lib/http";
import { safeSourceUrl,sanitizeFilename } from "@/lib/security";
import { resolveProjectId } from "@/lib/vault";
export const runtime="nodejs";
const Body=z.object({
 sessionId:z.string().uuid(),filename:z.string().min(1).max(240),mimeType:z.string().min(1).max(160),sizeBytes:z.number().int().positive(),sha256:z.string().regex(/^[0-9a-f]{64}$/i),
 kind:z.enum(["image","video","document","archive","text","other"]).optional(),project:z.string().max(160).nullable().optional(),niche:z.string().max(120).nullable().optional(),tags:z.array(z.string().max(60)).max(40).optional(),note:z.string().max(1000).nullable().optional(),
 sourceUrl:z.string().max(2200).nullable().optional(),sourceTitle:z.string().max(500).nullable().optional(),width:z.number().int().positive().max(100000).nullable().optional(),height:z.number().int().positive().max(100000).nullable().optional(),
});
function kindFor(mime:string){if(mime.startsWith("image/"))return "image";if(mime.startsWith("video/"))return "video";if(mime==="application/pdf")return "document";if(mime.includes("zip"))return "archive";if(mime.startsWith("text/")||mime==="application/json")return "text";return "other";}
export async function OPTIONS(r:Request){return preflight(r)!;}
export async function POST(request:Request){
 const p=preflight(request);if(p)return p;const parsed=Body.safeParse(await readJson(request));if(!parsed.success)return reply(request,{ok:false,error:"invalid_body"},400);const b=parsed.data;
 if(b.sizeBytes>env.maxVaultBytes)return reply(request,{ok:false,error:"asset_too_large",maxBytes:env.maxVaultBytes},413);
 const session=await authExtension(request,b.sessionId);if(!session)return reply(request,{ok:false,error:"unauthorized"},401);
 const sha=b.sha256.toLowerCase();
 const {data:existing}=await admin().from("seven_vault_assets").select("id,storage_path,name,mime_type,byte_size,sha256,project_id,niche,tags,metadata,created_at,status").eq("workspace_id",env.workspaceId).eq("sha256",sha).is("deleted_at",null).maybeSingle();
 if(existing?.status==="ready")return reply(request,{ok:true,deduplicated:true,asset:existing});
 const projectId=existing?.project_id||await resolveProjectId(b.project,b.niche);
 const id=existing?.id||crypto.randomUUID(), name=existing?.name||sanitizeFilename(b.filename),storagePath=existing?.storage_path||`${env.workspaceId}/${id}/${name}`;
 const sourceUrl=safeSourceUrl(b.sourceUrl);let sourceDomain:string|null=null;if(sourceUrl){try{sourceDomain=new URL(sourceUrl).hostname.slice(0,255)}catch{}}
 const metadata={...(existing?.metadata||{}),note:b.note||existing?.metadata?.note||null,uploadState:"uploading"};
 const row={id,workspace_id:env.workspaceId,project_id:projectId,kind:b.kind||kindFor(b.mimeType),name,mime_type:b.mimeType,byte_size:b.sizeBytes,sha256:sha,width:b.width||null,height:b.height||null,source_url:sourceUrl,source_domain:sourceDomain,source_title:b.sourceTitle||null,niche:b.niche||null,tags:b.tags||[],metadata,status:"uploading",deleted_at:null,updated_at:new Date().toISOString(),storage_path:storagePath};
 const {error:dbError}=await admin().from("seven_vault_assets").upsert(row,{onConflict:"id"});
 if(dbError)return reply(request,{ok:false,error:"vault_prepare_failed"},500);
 const {data,error}=await admin().storage.from(env.bucket).createSignedUploadUrl(storagePath,{upsert:!!existing});
 if(error||!data){if(!existing)await admin().from("seven_vault_assets").delete().eq("id",id);else await admin().from("seven_vault_assets").update({status:"failed"}).eq("id",id);return reply(request,{ok:false,error:"signed_upload_failed"},500);}
 return reply(request,{ok:true,deduplicated:false,assetId:id,path:storagePath,signedUrl:data.signedUrl,token:data.token,expiresInSeconds:7200});
}
