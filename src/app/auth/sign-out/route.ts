import { NextResponse } from "next/server";
import { hasPublicSupabaseConfig } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server-client";

async function signOut(request: Request) {
  if (hasPublicSupabaseConfig()) {
    const supabase = await createSupabaseServerClient();
    await supabase.auth.signOut();
  }

  return NextResponse.redirect(new URL("/auth/sign-in", request.url), {
    status: 303,
  });
}

export async function GET(request: Request) {
  return signOut(request);
}

export async function POST(request: Request) {
  return signOut(request);
}
