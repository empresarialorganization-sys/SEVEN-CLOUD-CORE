import { admin } from "./supabase-admin";
import { env } from "./env";

export type VaultSearchArgs = {
  query?: string; project?: string; niche?: string; tags?: string[]; mimeType?: string; limit?: number;
};

function projectSlug(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "project";
}

export async function resolveProjectId(project?: string | null, niche?: string | null): Promise<string | null> {
  const name = project?.trim();
  if (!name) return null;
  const slug = projectSlug(name);
  const { data: existing } = await admin().from("seven_projects")
    .select("id").eq("workspace_id", env.workspaceId).eq("slug", slug).maybeSingle();
  if (existing?.id) return String(existing.id);
  const { data, error } = await admin().from("seven_projects")
    .upsert({ workspace_id: env.workspaceId, name: name.slice(0, 160), slug, niche: niche?.trim() || null }, { onConflict: "workspace_id,slug" })
    .select("id").single();
  if (error || !data) throw new Error("project_resolve_failed");
  return String(data.id);
}

export async function vaultSearch(args: VaultSearchArgs) {
  const { data, error } = await admin().rpc("seven_vault_search", {
    _workspace: env.workspaceId,
    _query: args.query?.trim() || null,
    _project: args.project?.trim() || null,
    _niche: args.niche?.trim() || null,
    _tags: args.tags?.length ? args.tags : null,
    _mime_type: args.mimeType?.trim() || null,
    _limit: Math.max(1, Math.min(100, Number(args.limit || 20))),
  });
  if (error) throw new Error("vault_search_failed");
  return data || [];
}

export async function vaultAsset(assetId: string) {
  const { data } = await admin().from("seven_vault_assets")
    .select("id,workspace_id,project_id,kind,name,mime_type,storage_path,sha256,byte_size,width,height,source_url,source_domain,source_title,niche,tags,metadata,status,created_at,updated_at,deleted_at")
    .eq("id", assetId).eq("workspace_id", env.workspaceId).eq("status", "ready").is("deleted_at", null).maybeSingle();
  return data || null;
}

export function publicAssetMeta(a: any) {
  return {
    id:a.id, filename:a.name, name:a.name, mimeType:a.mime_type, sizeBytes:a.byte_size, sha256:a.sha256,
    projectId:a.project_id || null, project:a.project_name || a.project_slug || null, niche:a.niche, tags:a.tags || [],
    note:a.metadata?.note || null, sourceUrl:a.source_url, sourceDomain:a.source_domain, sourceTitle:a.source_title,
    width:a.width, height:a.height, kind:a.kind, createdAt:a.created_at, updatedAt:a.updated_at,
  };
}
