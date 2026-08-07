import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env } from "./env";
let cached: SupabaseClient | null = null;
export function admin(): SupabaseClient {
  if (!cached) {
    cached = createClient(env.supabaseUrl, env.serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return cached;
}
