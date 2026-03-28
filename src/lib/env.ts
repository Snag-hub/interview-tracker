export function hasSupabaseConfig(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

export function hasServiceSupabaseConfig(): boolean {
  return Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export function hasPublicSupabaseConfig(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

export function getPublicSupabaseEnv() {
  const missing: string[] = [];
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    missing.push("NEXT_PUBLIC_SUPABASE_URL");
  }
  if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    missing.push("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
  }

  return {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string,
  };
}

export function getServiceSupabaseEnv() {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Missing required environment variables: SUPABASE_SERVICE_ROLE_KEY");
  }

  const publicEnv = getPublicSupabaseEnv();

  return {
    ...publicEnv,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY as string,
  };
}

export function hasGoogleOAuthConfig(): boolean {
  return Boolean(
    process.env.GOOGLE_CLIENT_ID &&
      process.env.GOOGLE_CLIENT_SECRET &&
      process.env.GOOGLE_OAUTH_REDIRECT_URI,
  );
}

export function getGoogleOAuthEnv() {
  const missing: string[] = [];

  if (!process.env.GOOGLE_CLIENT_ID) {
    missing.push("GOOGLE_CLIENT_ID");
  }
  if (!process.env.GOOGLE_CLIENT_SECRET) {
    missing.push("GOOGLE_CLIENT_SECRET");
  }
  if (!process.env.GOOGLE_OAUTH_REDIRECT_URI) {
    missing.push("GOOGLE_OAUTH_REDIRECT_URI");
  }

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
  }

  return {
    clientId: process.env.GOOGLE_CLIENT_ID as string,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
    redirectUri: process.env.GOOGLE_OAUTH_REDIRECT_URI as string,
  };
}

export function hasEncryptionConfig(): boolean {
  return Boolean(process.env.APP_ENCRYPTION_KEY);
}

export function getEncryptionKey(): string {
  if (!process.env.APP_ENCRYPTION_KEY) {
    throw new Error("Missing required environment variables: APP_ENCRYPTION_KEY");
  }

  return process.env.APP_ENCRYPTION_KEY;
}

export function hasGeminiConfig(): boolean {
  const enabled = (process.env.GEMINI_ENABLED ?? "true").toLowerCase() !== "false";
  return enabled && Boolean(process.env.GEMINI_API_KEY);
}

export function getGeminiEnv() {
  const missing: string[] = [];

  if (!process.env.GEMINI_API_KEY) {
    missing.push("GEMINI_API_KEY");
  }

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
  }

  const timeoutRaw = process.env.GEMINI_TIMEOUT_MS;
  const timeoutMs = timeoutRaw ? Number.parseInt(timeoutRaw, 10) : 12_000;
  const maxCallsRaw = process.env.GEMINI_MAX_CALLS_PER_SYNC;
  const maxCallsPerSync = maxCallsRaw ? Number.parseInt(maxCallsRaw, 10) : 5;

  return {
    apiKey: process.env.GEMINI_API_KEY as string,
    model: process.env.GEMINI_MODEL || "gemini-1.5-flash",
    timeoutMs: Number.isNaN(timeoutMs) ? 12_000 : timeoutMs,
    maxCallsPerSync:
      Number.isNaN(maxCallsPerSync) || maxCallsPerSync < 1
        ? 5
        : Math.min(maxCallsPerSync, 50),
  };
}
