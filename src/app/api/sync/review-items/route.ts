import { NextRequest, NextResponse } from "next/server";
import { serviceUnavailable, unauthorized } from "@/lib/api/responses";
import { hasSupabaseConfig } from "@/lib/env";
import { getSessionUser } from "@/lib/auth/session-user";
import { syncReviewStatusSchema } from "@/lib/api/sync-review-schemas";
import { createSupabaseServerClient } from "@/lib/supabase/server-client";

export async function GET(request: NextRequest) {
  if (!hasSupabaseConfig()) {
    return serviceUnavailable("Supabase is not configured. Add env values from .env.example.");
  }

  const user = await getSessionUser();
  if (!user) {
    return unauthorized();
  }

  const statusParam = request.nextUrl.searchParams.get("status") ?? "pending";
  const parsedStatus = syncReviewStatusSchema.safeParse(statusParam);
  if (!parsedStatus.success) {
    return NextResponse.json({ error: "Invalid review status filter." }, { status: 400 });
  }

  const limitRaw = request.nextUrl.searchParams.get("limit");
  const limit = limitRaw ? Number.parseInt(limitRaw, 10) : 25;
  const safeLimit = Number.isNaN(limit) ? 25 : Math.min(Math.max(limit, 1), 100);

  const supabase = await createSupabaseServerClient();
  const [pendingCountResult, appliedCountResult, dismissedCountResult] = await Promise.all([
    supabase
      .from("sync_review_items")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("review_status", "pending"),
    supabase
      .from("sync_review_items")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("review_status", "applied"),
    supabase
      .from("sync_review_items")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("review_status", "dismissed"),
  ]);

  const countError = pendingCountResult.error || appliedCountResult.error || dismissedCountResult.error;
  if (countError) {
    return NextResponse.json({ error: countError.message }, { status: 500 });
  }

  const { data, error } = await supabase
    .from("sync_review_items")
    .select(
      "id, created_at, source_email_id, source_thread_id, signature, application_id, raw_subject, raw_from, raw_snippet, proposed_company, proposed_role, proposed_round_type, proposed_status, parser_source, confidence, reason, ai_used, review_status, resolved_company, resolved_role, resolved_at",
    )
    .eq("user_id", user.id)
    .eq("review_status", parsedStatus.data)
    .order("created_at", { ascending: false })
    .limit(safeLimit);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(
    {
      items: data ?? [],
      counts: {
        pending: pendingCountResult.count ?? 0,
        applied: appliedCountResult.count ?? 0,
        dismissed: dismissedCountResult.count ?? 0,
      },
    },
    { status: 200 },
  );
}
