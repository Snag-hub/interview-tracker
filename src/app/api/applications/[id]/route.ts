import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { notFound, badRequest, serviceUnavailable, unauthorized } from "@/lib/api/responses";
import { updateApplicationSchema } from "@/lib/api/application-schemas";
import { hasSupabaseConfig } from "@/lib/env";
import { getSessionUser } from "@/lib/auth/session-user";
import { createSupabaseServerClient } from "@/lib/supabase/server-client";

function mapApplication(row: Record<string, unknown>) {
  return {
    id: row.id,
    company: row.company,
    role: row.role,
    applicationStatus: row.application_status,
    currentStage: row.current_stage,
    appliedDate: row.applied_date,
    jobPostingUrl: row.job_posting_url,
    jdUrl: row.jd_url,
    platform: row.platform,
    resumeVersionId: row.resume_version_id,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

type Params = { params: Promise<{ id: string }> };

export async function GET(_: NextRequest, context: Params) {
  if (!hasSupabaseConfig()) {
    return serviceUnavailable("Supabase is not configured. Add env values from .env.example.");
  }

  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    return unauthorized();
  }

  const { id } = await context.params;
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("job_applications")
    .select("*")
    .eq("id", id)
    .eq("user_id", sessionUser.id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!data) {
    return notFound("Application not found");
  }

  return NextResponse.json({ application: mapApplication(data) }, { status: 200 });
}

export async function PATCH(request: NextRequest, context: Params) {
  if (!hasSupabaseConfig()) {
    return serviceUnavailable("Supabase is not configured. Add env values from .env.example.");
  }

  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    return unauthorized();
  }

  const { id } = await context.params;

  try {
    const payload = updateApplicationSchema.parse(await request.json());
    const supabase = await createSupabaseServerClient();

    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (payload.company !== undefined) updates.company = payload.company;
    if (payload.role !== undefined) updates.role = payload.role;
    if (payload.applicationStatus !== undefined) {
      updates.application_status = payload.applicationStatus;
    }
    if (payload.currentStage !== undefined) updates.current_stage = payload.currentStage;
    if (payload.appliedDate !== undefined) updates.applied_date = payload.appliedDate;
    
    // Convert empty strings to null for optional URL/ID fields
    if (payload.jobPostingUrl !== undefined) updates.job_posting_url = payload.jobPostingUrl || null;
    if (payload.jdUrl !== undefined) updates.jd_url = payload.jdUrl || null;
    if (payload.platform !== undefined) updates.platform = payload.platform || null;
    if (payload.resumeVersionId !== undefined) updates.resume_version_id = payload.resumeVersionId || null;
    if (payload.notes !== undefined) updates.notes = payload.notes || null;

    const { data, error } = await supabase
      .from("job_applications")
      .update(updates)
      .eq("id", id)
      .eq("user_id", sessionUser.id)
      .select("*")
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data) {
      return notFound("Application not found");
    }

    return NextResponse.json({ application: mapApplication(data) }, { status: 200 });
  } catch (error) {
    if (error instanceof ZodError) {
      return badRequest(error.issues[0]?.message ?? "Invalid request payload");
    }

    return NextResponse.json({ error: "Unexpected server error" }, { status: 500 });
  }
}

export async function DELETE(_: NextRequest, context: Params) {
  if (!hasSupabaseConfig()) {
    return serviceUnavailable("Supabase is not configured. Add env values from .env.example.");
  }

  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    return unauthorized();
  }

  const { id } = await context.params;
  const supabase = await createSupabaseServerClient();

  // 1. Fetch associated rounds to get source_email_ids before deletion
  const { data: rounds } = await supabase
    .from("interview_rounds")
    .select("source_email_id")
    .eq("application_id", id)
    .not("source_email_id", "is", null);

  if (rounds && rounds.length > 0) {
    const exclusionPayloads = rounds
      .map((r) => ({
        user_id: sessionUser.id,
        source_email_id: r.source_email_id as string,
      }))
      .filter((val, index, self) => 
        self.findIndex(t => t.source_email_id === val.source_email_id) === index
      );

    if (exclusionPayloads.length > 0) {
      await supabase.from("sync_exclusions").upsert(exclusionPayloads, {
        onConflict: "user_id,source_email_id",
      });
    }
  }

  // 2. Perform the deletion
  const { data, error } = await supabase
    .from("job_applications")
    .delete()
    .eq("id", id)
    .eq("user_id", sessionUser.id)
    .select("id")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!data) {
    return notFound("Application not found");
  }

  return NextResponse.json({ deleted: true, id: data.id }, { status: 200 });
}
