import { reply, preflight } from "@/lib/http";
export const runtime = "nodejs";
export async function OPTIONS(request: Request){ return preflight(request)!; }
export async function GET(request: Request){
  const p=preflight(request); if(p) return p;
  return reply(request,{ok:true,service:"seven-cloud-core",version:"0.8.0",time:new Date().toISOString()});
}
