import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session-user";
import { createSupabaseServerClient } from "@/lib/supabase/server-client";
import {
  DashboardApplicationsTable,
  type DashboardApplicationRow,
} from "@/components/dashboard-applications-table";
import { DashboardAddInterviewForm } from "@/components/dashboard-add-interview-form";

type ApplicationRow = {
  id: string;
  company: string;
  role: string;
  application_status: string;
  current_stage: string;
};

type RoundRow = {
  id: string;
  application_id: string;
  round_type: string;
  status: string;
  scheduled_start_utc: string;
  organizer_email?: string | null;
  attendee_emails?: string[] | null;
};

function normalizeCompanyForGrouping(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "").trim();
}

function normalizeRoleForGrouping(value: string) {
  const lowered = value.toLowerCase();
  const canonicalTokens = [
    "full stack",
    "fullstack",
    ".net",
    "dot net",
    "react",
    "backend",
    "frontend",
    "developer",
    "engineer",
    "architect",
    "analyst",
    "manager",
    "qa",
    "sdet",
    "software",
  ];

  const picked = canonicalTokens.filter((token) => lowered.includes(token));
  if (picked.length > 0) {
    return picked.join(" ");
  }

  return lowered
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .slice(0, 6)
    .join(" ");
}

export default async function DashboardPage() {
  const user = await getSessionUser();
  if (!user) {
    redirect("/auth/sign-in?next=/dashboard");
  }

  const supabase = await createSupabaseServerClient();

  const [{ data: applications, error: applicationError }, roundsResult] = await Promise.all([
    supabase
      .from("job_applications")
      .select("id, company, role, application_status, current_stage")
      .eq("user_id", user.id),
    supabase
      .from("interview_rounds")
      .select("id, application_id, round_type, status, scheduled_start_utc, organizer_email, attendee_emails")
      .order("scheduled_start_utc", { ascending: false })
      .limit(1000),
  ]);

  let rounds = roundsResult.data as RoundRow[] | null;
  let roundsError = roundsResult.error;

  if (roundsError?.message?.includes("organizer_email") || roundsError?.message?.includes("attendee_emails")) {
    const fallbackRounds = await supabase
      .from("interview_rounds")
      .select("id, application_id, round_type, status, scheduled_start_utc")
      .order("scheduled_start_utc", { ascending: false })
      .limit(1000);

    rounds = (fallbackRounds.data as RoundRow[] | null) ?? [];
    roundsError = fallbackRounds.error;
  }

  if (applicationError || roundsError) {
    throw new Error(applicationError?.message ?? roundsError?.message ?? "Failed to load dashboard");
  }

  const roundsByApplication = new Map<string, RoundRow[]>();
  for (const round of rounds ?? []) {
    const items = roundsByApplication.get(round.application_id) ?? [];
    items.push(round);
    roundsByApplication.set(round.application_id, items);
  }

  const grouped = new Map<string, DashboardApplicationRow>();

  for (const application of applications as ApplicationRow[]) {
    const companyKey = normalizeCompanyForGrouping(application.company);
    const roleKey = normalizeRoleForGrouping(application.role);
    const groupKey = `${companyKey}|${roleKey}`;
    const applicationRounds = roundsByApplication.get(application.id) ?? [];
    const latestRound = applicationRounds[0] ?? null;

    const existing = grouped.get(groupKey);
    if (!existing) {
      grouped.set(groupKey, {
        applicationId: application.id,
        relatedApplicationIds: [application.id],
        company: application.company,
        role: application.role,
        applicationStatus: application.application_status,
        currentStage: application.current_stage,
        latestRoundType: latestRound?.round_type ?? null,
        latestRoundStatus: latestRound?.status ?? null,
        latestRoundAt: latestRound?.scheduled_start_utc ?? null,
        totalRounds: applicationRounds.length,
      });
      continue;
    }

    existing.relatedApplicationIds.push(application.id);
    existing.totalRounds += applicationRounds.length;

    const existingLatest = existing.latestRoundAt ? new Date(existing.latestRoundAt).getTime() : 0;
    const incomingLatest = latestRound?.scheduled_start_utc
      ? new Date(latestRound.scheduled_start_utc).getTime()
      : 0;

    if (incomingLatest > existingLatest) {
      existing.applicationId = application.id;
      existing.company = application.company;
      existing.role = application.role;
      existing.applicationStatus = application.application_status;
      existing.currentStage = application.current_stage;
      existing.latestRoundType = latestRound?.round_type ?? null;
      existing.latestRoundStatus = latestRound?.status ?? null;
      existing.latestRoundAt = latestRound?.scheduled_start_utc ?? null;
    }
  }

  const dashboardRows: DashboardApplicationRow[] = [...grouped.values()].sort((left, right) => {
    const leftTimestamp = left.latestRoundAt ? new Date(left.latestRoundAt).getTime() : 0;
    const rightTimestamp = right.latestRoundAt ? new Date(right.latestRoundAt).getTime() : 0;
    return rightTimestamp - leftTimestamp;
  });

  return (
    <main className="shell flex flex-1 justify-center px-6 py-10">
      <section className="w-full max-w-5xl rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 md:p-8">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-[var(--accent)]">
              Dashboard
            </p>
            <h1 className="mt-2 text-2xl font-semibold">Interview tracker overview</h1>
          </div>
          <form action="/api/sync" method="post">
            <button
              className="rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white"
              type="submit"
            >
              Sync now
            </button>
          </form>
        </header>

        <DashboardAddInterviewForm />

        {dashboardRows.length === 0 ? (
          <p className="mt-6 rounded-xl border border-[var(--border)] bg-[var(--surface-alt)] px-4 py-5 text-sm text-black/70">
            No applications yet. Run sync or add an application to get started.
          </p>
        ) : (
          <DashboardApplicationsTable initialRows={dashboardRows} />
        )}
      </section>
    </main>
  );
}
