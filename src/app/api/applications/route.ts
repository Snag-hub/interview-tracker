import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { createApplicationSchema } from "@/lib/api/application-schemas";
import { badRequest, serviceUnavailable, unauthorized } from "@/lib/api/responses";
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
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

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
    .from("job_applications")
    .select("*")
    .eq("user_id", sessionUser.id)
    .order("updated_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ applications: data.map(mapApplication) }, { status: 200 });
}

export async function POST(request: NextRequest) {
  if (!hasSupabaseConfig()) {
    return serviceUnavailable("Supabase is not configured. Add env values from .env.example.");
  }

  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    return unauthorized();
  }

  try {
    const payload = createApplicationSchema.parse(await request.json());
    const supabase = await createSupabaseServerClient();

    const { data, error } = await supabase
      .from("job_applications")
      .insert({
        user_id: sessionUser.id,
        company: payload.company,
        role: payload.role,
        application_status: payload.applicationStatus ?? "Applied",
        current_stage: payload.currentStage ?? "None",
        applied_date: payload.appliedDate ?? null,
        job_posting_url: payload.jobPostingUrl ?? null,
        jd_url: payload.jdUrl ?? null,
        notes: payload.notes ?? null,
      })
      .select("*")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ application: mapApplication(data) }, { status: 201 });
  } catch (error) {
    if (error instanceof ZodError) {
      return badRequest(error.issues[0]?.message ?? "Invalid request payload");
    }

    return NextResponse.json({ error: "Unexpected server error" }, { status: 500 });
  }
}
