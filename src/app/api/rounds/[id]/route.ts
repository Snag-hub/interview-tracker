import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { badRequest, notFound, serviceUnavailable, unauthorized } from "@/lib/api/responses";
import { updateRoundSchema } from "@/lib/api/application-schemas";
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
    const payload = updateRoundSchema.parse(await request.json());
    const supabase = await createSupabaseServerClient();

    const { data: round, error: roundError } = await supabase
      .from("interview_rounds")
      .select("id, application_id")
      .eq("id", id)
      .maybeSingle();

    if (roundError) {
      return NextResponse.json({ error: roundError.message }, { status: 500 });
    }

    if (!round) {
      return notFound("Round not found");
    }

    const { data: application, error: applicationError } = await supabase
      .from("job_applications")
      .select("id")
      .eq("id", round.application_id)
      .eq("user_id", sessionUser.id)
      .maybeSingle();

    if (applicationError) {
      return NextResponse.json({ error: applicationError.message }, { status: 500 });
    }

    if (!application) {
      return notFound("Round not found");
    }

    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (payload.roundType !== undefined) updates.round_type = payload.roundType;
    if (payload.scheduledStartUtc !== undefined) {
      updates.scheduled_start_utc = payload.scheduledStartUtc;
    }
    if (payload.scheduledEndUtc !== undefined) updates.scheduled_end_utc = payload.scheduledEndUtc;
    if (payload.timezone !== undefined) updates.timezone = payload.timezone;
    if (payload.status !== undefined) updates.status = payload.status;
    if (payload.meetingLink !== undefined) updates.meeting_link = payload.meetingLink;
    if (payload.organizerEmail !== undefined) updates.organizer_email = payload.organizerEmail;
    if (payload.attendeeEmails !== undefined) updates.attendee_emails = payload.attendeeEmails;
    if (payload.notes !== undefined) updates.notes = payload.notes;

    const { data, error } = await supabase
      .from("interview_rounds")
      .update(updates)
      .eq("id", id)
      .select("*")
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data) {
      return notFound("Round not found");
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
      { status: 200 },
    );
  } catch (error) {
    if (error instanceof ZodError) {
      return badRequest(error.issues[0]?.message ?? "Invalid request payload");
    }

    return NextResponse.json({ error: "Unexpected server error" }, { status: 500 });
  }
}
