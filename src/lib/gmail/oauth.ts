import { google } from "googleapis";
import { getGoogleOAuthEnv } from "@/lib/env";

export const GMAIL_SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/userinfo.email",
];

export function createGoogleOAuthClient() {
  const env = getGoogleOAuthEnv();
  return new google.auth.OAuth2(env.clientId, env.clientSecret, env.redirectUri);
}
