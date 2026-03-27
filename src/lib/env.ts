const requiredPublicEnv = ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY"] as const;
const requiredServiceEnv = ["SUPABASE_SERVICE_ROLE_KEY"] as const;

export function hasSupabaseConfig(): boolean {
  return [...requiredPublicEnv, ...requiredServiceEnv].every((key) => Boolean(process.env[key]));
}

export function hasPublicSupabaseConfig(): boolean {
  return requiredPublicEnv.every((key) => Boolean(process.env[key]));
}

export function getPublicSupabaseEnv() {
  const missing = requiredPublicEnv.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
  }

  return {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string,
  };
}

export function getServiceSupabaseEnv() {
  const missing = requiredServiceEnv.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
  }

  const publicEnv = getPublicSupabaseEnv();

  return {
    ...publicEnv,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY as string,
  };
}
