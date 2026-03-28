import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { badRequest, notFound, serviceUnavailable, unauthorized } from "@/lib/api/responses";
import { createRoundSchema } from "@/lib/api/application-schemas";
import { hasSupabaseConfig } from "@/lib/env";
import { getSessionUser } from "@/lib/auth/session-user";
import { createSupabaseServerClient } from "@/lib/supabase/server-client";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: Params) {
  if (!hasSupabaseConfig()) {
    return serviceUnavailable("Supabase is not configured. Add env values from .env.example.");
  }

  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    return unauthorized();
  }

  const { id } = await context.params;

  try {
    const payload = createRoundSchema.parse(await request.json());
    const supabase = await createSupabaseServerClient();

    const { data: application, error: applicationError } = await supabase
      .from("job_applications")
      .select("id")
      .eq("id", id)
      .eq("user_id", sessionUser.id)
      .maybeSingle();

    if (applicationError) {
      return NextResponse.json({ error: applicationError.message }, { status: 500 });
    }

    if (!application) {
      return notFound("Application not found");
    }

    const { data, error } = await supabase
      .from("interview_rounds")
      .insert({
        application_id: id,
        round_type: payload.roundType,
        scheduled_start_utc: payload.scheduledStartUtc,
        scheduled_end_utc: payload.scheduledEndUtc ?? null,
        timezone: payload.timezone ?? null,
        status: payload.status ?? "Scheduled",
        meeting_link: payload.meetingLink ?? null,
        organizer_email: payload.organizerEmail ?? null,
        attendee_emails: payload.attendeeEmails ?? [],
        notes: payload.notes ?? null,
      })
      .select("*")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(
      {
        round: {
          id: data.id,
          applicationId: data.application_id,
          roundType: data.round_type,
          scheduledStartUtc: data.scheduled_start_utc,
          scheduledEndUtc: data.scheduled_end_utc,
          timezone: data.timezone,
          status: data.status,
          meetingLink: data.meeting_link,
          organizerEmail: data.organizer_email,
          attendeeEmails: data.attendee_emails,
          notes: data.notes,
          createdAt: data.created_at,
          updatedAt: data.updated_at,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof ZodError) {
      return badRequest(error.issues[0]?.message ?? "Invalid request payload");
    }

    return NextResponse.json({ error: "Unexpected server error" }, { status: 500 });
  }
}
