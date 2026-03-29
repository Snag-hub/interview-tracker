import { notFound, redirect } from "next/navigation";
import {
  ApplicationProgressPanel,
  type ApplicationProgress,
  type ProgressRound,
} from "@/components/application-progress-panel";
import { getSessionUser } from "@/lib/auth/session-user";
import { createSupabaseServerClient } from "@/lib/supabase/server-client";

type ApplicationPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ related?: string }>;
};

export default async function ApplicationProgressPage({ params, searchParams }: ApplicationPageProps) {
  const user = await getSessionUser();
  if (!user) {
    redirect("/auth/sign-in");
  }

  const { id } = await params;
  const query = await searchParams;
  const supabase = await createSupabaseServerClient();

  const { data: applicationData, error: applicationError } = await supabase
    .from("job_applications")
    .select("id, company, role, application_status, current_stage, notes, jd_url, platform, resume_version_id")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (applicationError) {
    throw new Error(applicationError.message);
  }

  if (!applicationData) {
    notFound();
  }

  const { data: resumeVersions } = await supabase
    .from("resume_versions")
    .select("id, version_label")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  const relatedIds = (query.related ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  const mergedApplicationIds = [...new Set([id, ...relatedIds])];

  const relatedApplicationsResult = await supabase
    .from("job_applications")
    .select("id")
    .in("id", mergedApplicationIds)
    .eq("user_id", user.id);

  if (relatedApplicationsResult.error) {
    throw new Error(relatedApplicationsResult.error.message);
  }

  const permittedIds = (relatedApplicationsResult.data ?? []).map((row) => row.id);
  const applicationIdsToQuery = permittedIds.length > 0 ? permittedIds : [id];

  const roundsResult = await supabase
    .from("interview_rounds")
    .select(
      "id, round_type, status, scheduled_start_utc, scheduled_end_utc, timezone, meeting_link, organizer_email, attendee_emails, notes",
    )
    .in("application_id", applicationIdsToQuery)
    .order("scheduled_start_utc", { ascending: true });

  let application: ApplicationProgress;
  let rounds: ProgressRound[];

  if (roundsResult.error?.message?.includes("organizer_email") || roundsResult.error?.message?.includes("attendee_emails")) {
    const fallbackRounds = await supabase
      .from("interview_rounds")
      .select("id, round_type, status, scheduled_start_utc, scheduled_end_utc, timezone, meeting_link, notes")
      .in("application_id", applicationIdsToQuery)
      .order("scheduled_start_utc", { ascending: true });

    if (fallbackRounds.error) {
      throw new Error(fallbackRounds.error.message);
    }

    application = {
      id: applicationData.id,
      company: applicationData.company,
      role: applicationData.role,
      applicationStatus: applicationData.application_status,
      currentStage: applicationData.current_stage,
      notes: applicationData.notes,
      jdUrl: applicationData.jd_url,
      platform: applicationData.platform,
      resumeVersionId: applicationData.resume_version_id,
    };

    rounds = (fallbackRounds.data ?? []).map((row) => ({
      id: row.id,
      roundType: row.round_type,
      status: row.status,
      scheduledStartUtc: row.scheduled_start_utc,
      scheduledEndUtc: row.scheduled_end_utc,
      timezone: row.timezone,
      meetingLink: row.meeting_link,
      organizerEmail: null,
      attendeeEmails: [],
      notes: row.notes,
    }));
  } else {
    if (roundsResult.error) {
      throw new Error(roundsResult.error.message);
    }

    application = {
      id: applicationData.id,
      company: applicationData.company,
      role: applicationData.role,
      applicationStatus: applicationData.application_status,
      currentStage: applicationData.current_stage,
      notes: applicationData.notes,
      jdUrl: applicationData.jd_url,
      platform: applicationData.platform,
      resumeVersionId: applicationData.resume_version_id,
    };

    rounds = (roundsResult.data ?? []).map((row) => ({
      id: row.id,
      roundType: row.round_type,
      status: row.status,
      scheduledStartUtc: row.scheduled_start_utc,
      scheduledEndUtc: row.scheduled_end_utc,
      timezone: row.timezone,
      meetingLink: row.meeting_link,
      organizerEmail: row.organizer_email,
      attendeeEmails: row.attendee_emails ?? [],
      notes: row.notes,
    }));
  }

  return (
    <main className="shell flex flex-1 justify-center px-6 py-10">
      <section className="w-full max-w-5xl">
        <ApplicationProgressPanel 
          application={application} 
          applicationIds={applicationIdsToQuery} 
          rounds={rounds} 
          resumeVersions={resumeVersions ?? []}
        />
      </section>
    </main>
  );
}
