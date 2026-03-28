import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session-user";
import { createSupabaseServerClient } from "@/lib/supabase/server-client";

type RoundRow = {
  id: string;
  round_type: string;
  status: string;
  scheduled_start_utc: string;
};

function formatDateKey(isoDate: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(isoDate));
}

function formatDateLabel(dateKey: string) {
  const date = new Date(`${dateKey}T00:00:00+05:30`);
  return new Intl.DateTimeFormat("en-IN", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  }).format(date);
}

export default async function CalendarPage() {
  const user = await getSessionUser();
  if (!user) {
    redirect("/auth/sign-in?next=/calendar");
  }

  const supabase = await createSupabaseServerClient();
  const nowIso = new Date().toISOString();

  const roundsResult = await supabase
    .from("interview_rounds")
    .select("id, round_type, status, scheduled_start_utc")
    .gte("scheduled_start_utc", nowIso)
    .order("scheduled_start_utc", { ascending: true })
    .limit(250);

  if (roundsResult.error) {
    throw new Error(roundsResult.error.message);
  }

  const rounds = (roundsResult.data as RoundRow[] | null) ?? [];
  const grouped = new Map<string, RoundRow[]>();

  for (const round of rounds) {
    const dateKey = formatDateKey(round.scheduled_start_utc);
    const items = grouped.get(dateKey) ?? [];
    items.push(round);
    grouped.set(dateKey, items);
  }

  const entries = [...grouped.entries()].sort((a, b) => a[0].localeCompare(b[0]));

  return (
    <main className="shell flex flex-1 justify-center px-6 py-10">
      <section className="w-full max-w-5xl rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 md:p-8">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-[var(--accent)]">
          Calendar
        </p>
        <h1 className="mt-2 text-2xl font-semibold">Interview schedule overview</h1>
        <p className="mt-2 text-sm text-black/70">
          Upcoming rounds grouped by day in Asia/Kolkata.
        </p>

        {entries.length === 0 ? (
          <p className="mt-6 rounded-xl border border-[var(--border)] bg-[var(--surface-alt)] px-4 py-5 text-sm text-black/70">
            No upcoming rounds yet. Run a sync from Settings or add rounds manually.
          </p>
        ) : (
          <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {entries.map(([dateKey, dateRounds]) => (
              <article
                key={dateKey}
                className="rounded-xl border border-[var(--border)] bg-[var(--surface-alt)] p-3"
              >
                <p className="font-mono text-xs text-black/65">{dateKey}</p>
                <p className="mt-1 text-sm font-semibold">{formatDateLabel(dateKey)}</p>
                <p className="mt-2 text-sm text-black/80">
                  {dateRounds.length} {dateRounds.length === 1 ? "interview" : "interviews"}
                </p>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
