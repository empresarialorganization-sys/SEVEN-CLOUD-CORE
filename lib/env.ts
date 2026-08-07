function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}
export const env = {
  get supabaseUrl() { return required("SUPABASE_URL"); },
  get serviceRoleKey() { return required("SUPABASE_SERVICE_ROLE_KEY"); },
  get workspaceId() { return required("SEVEN_WORKSPACE_ID"); },
  get workspaceKeyHash() { return required("SEVEN_WORKSPACE_KEY_HASH").toLowerCase(); },
  get bucket() { return process.env.SEVEN_STORAGE_BUCKET?.trim() || "seven-vault"; },
  get handleTtlHours() { return Math.max(1, Math.min(168, Number(process.env.SEVEN_HANDLE_TTL_HOURS || 12))); },
  get maxVaultBytes() { return Math.max(1_048_576, Number(process.env.SEVEN_MAX_VAULT_BYTES || 52_428_800)); },
  get maxInlineImageBytes() { return Math.max(262_144, Number(process.env.SEVEN_MAX_INLINE_IMAGE_BYTES || 8_388_608)); },
};
