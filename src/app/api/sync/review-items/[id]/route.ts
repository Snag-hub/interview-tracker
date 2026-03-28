import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { badRequest, notFound, serviceUnavailable, unauthorized } from "@/lib/api/responses";
import { updateSyncReviewItemSchema } from "@/lib/api/sync-review-schemas";
import { hasSupabaseConfig } from "@/lib/env";
import { getSessionUser } from "@/lib/auth/session-user";
import { createSupabaseServerClient } from "@/lib/supabase/server-client";

type Params = { params: Promise<{ id: string }> };

type ReviewItemRow = {
  id: string;
  user_id: string;
  source_thread_id: string | null;
  signature: string | null;
  application_id: string | null;
  proposed_company: string | null;
  review_status: string;
};

function normalizeCompany(value: string | null): string {
  return (value ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "").trim();
}

function shouldIncludeByScope(item: ReviewItemRow, base: ReviewItemRow, scope: string): boolean {
  if (scope === "single") return item.id === base.id;
  if (scope === "thread") return Boolean(base.source_thread_id && item.source_thread_id === base.source_thread_id);
  if (scope === "signature") return Boolean(base.signature && item.signature === base.signature);

  const threadMatch = Boolean(base.source_thread_id && item.source_thread_id === base.source_thread_id);
  const signatureMatch = Boolean(base.signature && item.signature === base.signature);

  if (scope === "thread+signature+company") {
    const baseCompany = normalizeCompany(base.proposed_company);
    const itemCompany = normalizeCompany(item.proposed_company);
    const companyMatch = Boolean(baseCompany && itemCompany && baseCompany === itemCompany);
    return threadMatch || signatureMatch || companyMatch || item.id === base.id;
  }

  return threadMatch || signatureMatch || item.id === base.id;
}

export async function PATCH(request: NextRequest, context: Params) {
  if (!hasSupabaseConfig()) {
    return serviceUnavailable("Supabase is not configured. Add env values from .env.example.");
  }

  const user = await getSessionUser();
  if (!user) {
    return unauthorized();
  }

  const { id } = await context.params;

  try {
    const payload = updateSyncReviewItemSchema.parse(await request.json());
    const supabase = await createSupabaseServerClient();

    const { data: baseItem, error: baseError } = await supabase
      .from("sync_review_items")
      .select("id, user_id, source_thread_id, signature, application_id, proposed_company, review_status")
      .eq("id", id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (baseError) {
      return NextResponse.json({ error: baseError.message }, { status: 500 });
    }

    if (!baseItem) {
      return notFound("Review item not found");
    }

    if (payload.action === "dismiss") {
      const { error: dismissError } = await supabase
        .from("sync_review_items")
        .update({
          review_status: "dismissed",
          resolved_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .eq("user_id", user.id);

      if (dismissError) {
        return NextResponse.json({ error: dismissError.message }, { status: 500 });
      }

      return NextResponse.json({ ok: true, action: "dismissed" }, { status: 200 });
    }

    const scope = payload.scope ?? "thread+signature+company";

    const { data: pendingItems, error: pendingError } = await supabase
      .from("sync_review_items")
      .select("id, user_id, source_thread_id, signature, application_id, proposed_company, review_status")
      .eq("user_id", user.id)
      .eq("review_status", "pending")
      .limit(2000);

    if (pendingError) {
      return NextResponse.json({ error: pendingError.message }, { status: 500 });
    }

    const pendingList = (pendingItems ?? []) as ReviewItemRow[];
    const targetItems = pendingList.filter((item) => shouldIncludeByScope(item, baseItem as ReviewItemRow, scope));
    const targetIds = targetItems.map((item) => item.id);

    if (targetIds.length === 0) {
      return NextResponse.json({ ok: true, action: "applied", updatedApplications: 0, resolvedItems: 0 }, { status: 200 });
    }

    const applicationIds = new Set<string>();
    for (const item of targetItems) {
      if (item.application_id) {
        applicationIds.add(item.application_id);
      }
    }

    if (applicationIds.size === 0 && baseItem.source_thread_id) {
      const { data: threadRounds, error: threadError } = await supabase
        .from("interview_rounds")
        .select("application_id")
        .eq("source_thread_id", baseItem.source_thread_id);

      if (threadError) {
        return NextResponse.json({ error: threadError.message }, { status: 500 });
      }

      for (const row of threadRounds ?? []) {
        if (row.application_id) {
          applicationIds.add(row.application_id);
        }
      }
    }

    if ((scope === "thread+signature+company" || scope === "signature") && baseItem.proposed_company) {
      const { data: companyApplications, error: companyError } = await supabase
        .from("job_applications")
        .select("id")
        .eq("user_id", user.id)
        .ilike("company", baseItem.proposed_company);

      if (companyError) {
        return NextResponse.json({ error: companyError.message }, { status: 500 });
      }

      for (const app of companyApplications ?? []) {
        if (app.id) {
          applicationIds.add(app.id);
        }
      }
    }

    for (const applicationId of applicationIds) {
      const { error: updateError } = await supabase
        .from("job_applications")
        .update({
          company: payload.company,
          role: payload.role,
          updated_at: new Date().toISOString(),
        })
        .eq("id", applicationId)
        .eq("user_id", user.id);

      if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 500 });
      }
    }

    const { error: resolveError } = await supabase
      .from("sync_review_items")
      .update({
        review_status: "applied",
        resolved_company: payload.company,
        resolved_role: payload.role,
        resolved_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", user.id)
      .in("id", targetIds);

    if (resolveError) {
      return NextResponse.json({ error: resolveError.message }, { status: 500 });
    }

    if (baseItem.signature) {
      const { error: resolutionError } = await supabase.from("parser_resolutions").upsert(
        {
          user_id: user.id,
          signature: baseItem.signature,
          company: payload.company,
          role: payload.role,
          confidence: 1,
          source: "manual_review",
          last_used_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,signature" },
      );

      if (resolutionError) {
        return NextResponse.json({ error: resolutionError.message }, { status: 500 });
      }
    }

    return NextResponse.json(
      {
        ok: true,
        action: "applied",
        scope,
        updatedApplications: applicationIds.size,
        resolvedItems: targetIds.length,
      },
      { status: 200 },
    );
  } catch (error) {
    if (error instanceof ZodError) {
      return badRequest(error.issues[0]?.message ?? "Invalid request payload");
    }

    return NextResponse.json({ error: "Unexpected server error" }, { status: 500 });
  }
}
