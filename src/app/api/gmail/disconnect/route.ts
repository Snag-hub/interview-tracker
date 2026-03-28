import { NextResponse } from "next/server";
import { serviceUnavailable, unauthorized } from "@/lib/api/responses";
import { getSessionUser } from "@/lib/auth/session-user";
import { hasSupabaseConfig } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server-client";

export async function POST(request: Request) {
  if (!hasSupabaseConfig()) {
    return serviceUnavailable("Supabase is not configured. Add env values from .env.example.");
  }

  const user = await getSessionUser();
  if (!user) {
    return unauthorized();
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("gmail_accounts").delete().eq("user_id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("application/x-www-form-urlencoded")) {
    const redirectUrl = new URL("/settings", request.url);
    redirectUrl.searchParams.set("gmail", "disconnected");
    return NextResponse.redirect(redirectUrl);
  }

  return NextResponse.json({ disconnected: true }, { status: 200 });
}
