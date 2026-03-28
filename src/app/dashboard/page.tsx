import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session-user";
import { createSupabaseServerClient } from "@/lib/supabase/server-client";

type ApplicationRow = {
  id: string;
  company: string;
  role: string;
};

type RoundRow = {
  id: string;
  application_id: string;
  round_type: string;
  status: string;
  scheduled_start_utc: string;
  organizer_email: string | null;
  attendee_emails: string[] | null;
};

export default async function DashboardPage() {
  const user = await getSessionUser();
  if (!user) {
    redirect("/auth/sign-in?next=/dashboard");
  }

  const supabase = await createSupabaseServerClient();

  const [{ data: applications, error: applicationError }, roundsResult] = await Promise.all([
    supabase.from("job_applications").select("id, company, role").eq("user_id", user.id),
    supabase
      .from("interview_rounds")
      .select("id, application_id, round_type, status, scheduled_start_utc, organizer_email, attendee_emails")
      .order("scheduled_start_utc", { ascending: true })
      .limit(100),
  ]);

  let rounds = roundsResult.data as RoundRow[] | null;
  let roundsError = roundsResult.error;

  if (roundsError?.message?.includes("organizer_email") || roundsError?.message?.includes("attendee_emails")) {
    const fallbackRounds = await supabase
      .from("interview_rounds")
      .select("id, application_id, round_type, status, scheduled_start_utc")
      .order("scheduled_start_utc", { ascending: true })
      .limit(100);

    rounds = (fallbackRounds.data as RoundRow[] | null) ?? [];
    roundsError = fallbackRounds.error;
  }

  if (applicationError || roundsError) {
    throw new Error(applicationError?.message ?? roundsError?.message ?? "Failed to load dashboard");
  }

  const applicationMap = new Map<string, ApplicationRow>(
    (applications as ApplicationRow[]).map((application) => [application.id, application]),
  );

  const dashboardRows = (rounds ?? []).map((round) => ({
    ...round,
    company: applicationMap.get(round.application_id)?.company ?? "Unknown",
    role: applicationMap.get(round.application_id)?.role ?? "Unknown",
  }));

  return (
    <main className="shell flex flex-1 justify-center px-6 py-10">
      <section className="w-full max-w-5xl rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 md:p-8">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-[var(--accent)]">
              Dashboard
            </p>
            <h1 className="mt-2 text-2xl font-semibold">Upcoming interview rounds</h1>
          </div>
          <button
            className="rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white"
            type="button"
          >
            Sync now
          </button>
        </header>

        {dashboardRows.length === 0 ? (
          <p className="mt-6 rounded-xl border border-[var(--border)] bg-[var(--surface-alt)] px-4 py-5 text-sm text-black/70">
            No interview rounds yet. Create an application and add your first round.
          </p>
        ) : (
          <div className="mt-6 overflow-hidden rounded-xl border border-[var(--border)]">
            <table className="w-full text-left text-sm">
              <thead className="bg-[var(--surface-alt)] font-mono text-xs uppercase tracking-wider text-black/70">
                <tr>
                  <th className="px-4 py-3">Company</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Round</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Organizer</th>
                <th className="px-4 py-3">Attendees</th>
                <th className="px-4 py-3">Date (IST)</th>
              </tr>
            </thead>
            <tbody>
              {dashboardRows.map((round) => (
                  <tr key={round.id} className="border-t border-[var(--border)]">
                    <td className="px-4 py-3">{round.company}</td>
                    <td className="px-4 py-3">{round.role}</td>
                    <td className="px-4 py-3">{round.round_type}</td>
                    <td className="px-4 py-3">{round.status}</td>
                    <td className="px-4 py-3">{round.organizer_email ?? "-"}</td>
                    <td className="px-4 py-3">{round.attendee_emails?.length ?? 0}</td>
                    <td className="px-4 py-3">
                      {new Date(round.scheduled_start_utc).toLocaleString("en-IN", {
                        timeZone: "Asia/Kolkata",
                        year: "numeric",
                        month: "short",
                        day: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                        hour12: true,
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
