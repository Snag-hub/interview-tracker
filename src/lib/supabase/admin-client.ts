import { createClient } from "@supabase/supabase-js";
import { getServiceSupabaseEnv } from "@/lib/env";

export function createAdminClient() {
  const env = getServiceSupabaseEnv();
  return createClient(env.url, env.serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
