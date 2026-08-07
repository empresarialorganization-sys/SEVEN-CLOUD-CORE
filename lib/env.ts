function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

// These defaults are intentionally non-secret. The workspace enrollment secret itself
// stays local in the SEVEN extension; only its SHA-256 is safe to keep here.
const PUBLIC_DEFAULTS = {
  supabaseUrl: "https://duzwnryljrjyxavbjmdv.supabase.co",
  workspaceId: "3ae8e98a-874b-451e-bd8b-f68977bbcc71",
  workspaceKeyHash: "ec7166cf6c2ad6fa57711a0555434cf6c36282f0c774f3604f35decfab1c7cda",
};

function jwtRole(value: string): string | null {
  try {
    const parts=value.split("."); if(parts.length<2) return null;
    const raw=parts[1].replace(/-/g,"+").replace(/_/g,"/");
    const json=Buffer.from(raw,"base64").toString("utf8");
    return JSON.parse(json)?.role || null;
  } catch { return null; }
}

function resolveServiceRoleKey(): string {
  const candidates=[
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    process.env.supabase2,
    process.env.supabeto1,
  ].map(v=>v?.trim()).filter((v):v is string=>!!v);
  const modern=candidates.find(v=>v.startsWith("sb_secret_"));
  if(modern) return modern;
  const legacy=candidates.find(v=>jwtRole(v)==="service_role");
  if(legacy) return legacy;
  return required("SUPABASE_SERVICE_ROLE_KEY");
}

export const env = {
  get supabaseUrl() { return process.env.SUPABASE_URL?.trim() || PUBLIC_DEFAULTS.supabaseUrl; },
  get serviceRoleKey() { return resolveServiceRoleKey(); },
  get workspaceId() { return process.env.SEVEN_WORKSPACE_ID?.trim() || PUBLIC_DEFAULTS.workspaceId; },
  get workspaceKeyHash() { return (process.env.SEVEN_WORKSPACE_KEY_HASH?.trim() || PUBLIC_DEFAULTS.workspaceKeyHash).toLowerCase(); },
  get bucket() { return process.env.SEVEN_STORAGE_BUCKET?.trim() || "seven-vault"; },
  get handleTtlHours() { return Math.max(1, Math.min(168, Number(process.env.SEVEN_HANDLE_TTL_HOURS || 12))); },
  get maxVaultBytes() { return Math.max(1_048_576, Number(process.env.SEVEN_MAX_VAULT_BYTES || 52_428_800)); },
  get maxInlineImageBytes() { return Math.max(262_144, Number(process.env.SEVEN_MAX_INLINE_IMAGE_BYTES || 8_388_608)); },
};
