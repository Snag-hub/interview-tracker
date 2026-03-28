import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { google } from "googleapis";
import { badRequest, serviceUnavailable, unauthorized } from "@/lib/api/responses";
import { getSessionUser } from "@/lib/auth/session-user";
import { encryptSecret } from "@/lib/crypto/secrets";
import { hasEncryptionConfig, hasGoogleOAuthConfig } from "@/lib/env";
import { createGoogleOAuthClient } from "@/lib/gmail/oauth";
import { createSupabaseServerClient } from "@/lib/supabase/server-client";

export async function GET(request: Request) {
  if (!hasGoogleOAuthConfig()) {
    return serviceUnavailable("Google OAuth is not configured.");
  }

  if (!hasEncryptionConfig()) {
    return serviceUnavailable("Encryption key is missing. Configure APP_ENCRYPTION_KEY.");
  }

  const user = await getSessionUser();
  if (!user) {
    return unauthorized();
  }

  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");

  if (!code || !state) {
    return badRequest("Missing OAuth code or state.");
  }

  const cookieStore = await cookies();
  const savedState = cookieStore.get("gmail_oauth_state")?.value;

  if (!savedState || state !== savedState) {
    return badRequest("Invalid OAuth state.");
  }

  const oauthClient = createGoogleOAuthClient();
  const { tokens } = await oauthClient.getToken(code);

  if (!tokens.refresh_token || !tokens.access_token) {
    return badRequest("Google did not return required tokens. Try reconnecting with consent.");
  }

  oauthClient.setCredentials(tokens);
  const oauth2 = google.oauth2({ version: "v2", auth: oauthClient });
  const profile = await oauth2.userinfo.get();
  const googleEmail = profile.data.email;

  if (!googleEmail) {
    return badRequest("Unable to read Gmail account email from Google profile.");
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("gmail_accounts").upsert(
    {
      user_id: user.id,
      google_email: googleEmail,
      access_token_encrypted: encryptSecret(tokens.access_token),
      refresh_token_encrypted: encryptSecret(tokens.refresh_token),
      token_expiry: tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const response = NextResponse.redirect(new URL("/settings?gmail=connected", request.url));
  response.cookies.set("gmail_oauth_state", "", { path: "/", maxAge: 0 });
  return response;
}
