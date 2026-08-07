import { z } from "zod";
import { authExtension } from "@/lib/auth";
import { admin } from "@/lib/supabase-admin";
import { env } from "@/lib/env";
import { preflight,readJson,reply } from "@/lib/http";
export const runtime="nodejs";
const Body=z.object({sessionId:z.string().uuid(),assetId:z.string().uuid()});
export async function OPTIONS(r:Request){return preflight(r)!;}
export async function POST(request:Request){
 const p=preflight(request);if(p)return p;const parsed=Body.safeParse(await readJson(request));if(!parsed.success)return reply(request,{ok:false,error:"invalid_body"},400);const b=parsed.data;
 if(!(await authExtension(request,b.sessionId)))return reply(request,{ok:false,error:"unauthorized"},401);
 const {data:asset}=await admin().from("seven_vault_assets").select("id,storage_path,name,byte_size,status,metadata").eq("id",b.assetId).eq("workspace_id",env.workspaceId).maybeSingle();if(!asset)return reply(request,{ok:false,error:"asset_not_found"},404);
 const slash=asset.storage_path.lastIndexOf("/");const folder=asset.storage_path.slice(0,slash),name=asset.storage_path.slice(slash+1);
 const {data:list,error}=await admin().storage.from(env.bucket).list(folder,{search:name,limit:20});
 const obj=list?.find((x:any)=>x.name===name);if(error||!obj)return reply(request,{ok:false,error:"storage_object_missing"},409);
 const actual=Number(obj.metadata?.size||obj.metadata?.contentLength||0);if(actual&&Number(asset.byte_size)!==actual)return reply(request,{ok:false,error:"size_mismatch",expected:asset.byte_size,actual},409);
 await admin().from("seven_vault_assets").update({status:"ready",metadata:{...(asset.metadata||{}),uploadState:"ready"},updated_at:new Date().toISOString()}).eq("id",b.assetId);
 return reply(request,{ok:true,assetId:b.assetId,status:"ready"});
}
