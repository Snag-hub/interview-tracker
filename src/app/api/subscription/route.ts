import { NextResponse } from "next/server";
import { hasSupabaseConfig } from "@/lib/env";
import { serviceUnavailable, unauthorized } from "@/lib/api/responses";
import { getSessionUser } from "@/lib/auth/session-user";
import { createSupabaseServerClient } from "@/lib/supabase/server-client";

export async function GET() {
  if (!hasSupabaseConfig()) {
    return serviceUnavailable("Supabase is not configured. Add env values from .env.example.");
  }

  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    return unauthorized();
  }

  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("user_id", sessionUser.id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(
    {
      subscription: data
        ? {
            id: data.id,
            planCode: data.plan_code,
            status: data.status,
            trialEndsAt: data.trial_ends_at,
            currentPeriodEnd: data.current_period_end,
          }
        : null,
    },
    { status: 200 },
  );
}
