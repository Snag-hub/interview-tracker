import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { badRequest, notFound, serviceUnavailable, unauthorized } from "@/lib/api/responses";
import { updateApplicationStatusSchema } from "@/lib/api/application-schemas";
import { hasSupabaseConfig } from "@/lib/env";
import { getSessionUser } from "@/lib/auth/session-user";
import { createSupabaseServerClient } from "@/lib/supabase/server-client";

type Params = { params: Promise<{ id: string }> };

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
    const payload = updateApplicationStatusSchema.parse(await request.json());
    const supabase = await createSupabaseServerClient();

    const { data, error } = await supabase
      .from("job_applications")
      .update({
        application_status: payload.applicationStatus,
        current_stage: payload.currentStage,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("user_id", sessionUser.id)
      .select("id, application_status, current_stage, updated_at")
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data) {
      return notFound("Application not found");
    }

    return NextResponse.json(
      {
        id: data.id,
        applicationStatus: data.application_status,
        currentStage: data.current_stage,
        updatedAt: data.updated_at,
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
