import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { unauthorized, serviceUnavailable } from "@/lib/api/responses";
import { getSessionUser } from "@/lib/auth/session-user";
import { hasGoogleOAuthConfig } from "@/lib/env";
import { createGoogleOAuthClient, GMAIL_SCOPES } from "@/lib/gmail/oauth";

function createAuthRedirect(requestUrl: string) {
  const oauthClient = createGoogleOAuthClient();
  const state = randomUUID();

  const authUrl = oauthClient.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: GMAIL_SCOPES,
    state,
  });

  const response = NextResponse.redirect(authUrl);
  response.cookies.set("gmail_oauth_state", state, {
    httpOnly: true,
    secure: requestUrl.startsWith("https://"),
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 10,
  });

  return response;
}

export async function GET(request: Request) {
  if (!hasGoogleOAuthConfig()) {
    return serviceUnavailable("Google OAuth is not configured.");
  }

  const user = await getSessionUser();
  if (!user) {
    return unauthorized();
  }

  return createAuthRedirect(request.url);
}

export async function POST(request: Request) {
  if (!hasGoogleOAuthConfig()) {
    return serviceUnavailable("Google OAuth is not configured.");
  }

  const user = await getSessionUser();
  if (!user) {
    return unauthorized();
  }

  return createAuthRedirect(request.url);
}
