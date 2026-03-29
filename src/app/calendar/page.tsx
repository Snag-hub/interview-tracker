import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session-user";
import { createSupabaseServerClient } from "@/lib/supabase/server-client";
import Link from "next/link";

type RoundRow = {
  id: string;
  round_type: string;
  status: string;
  scheduled_start_utc: string;
  application_id: string;
  job_applications: {
    company: string;
    role: string;
  };
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
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "Asia/Kolkata",
  }).format(date);
}

function formatTime(isoDate: string) {
  return new Date(isoDate).toLocaleTimeString("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

function StatusBadge({ status }: { status: string }) {
  const s = status.toLowerCase();
  let base = "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ";

  if (s === "scheduled") {
    base += "bg-emerald-50 text-emerald-700 border-emerald-200";
  } else if (s === "completed") {
    base += "bg-blue-50 text-blue-700 border-blue-200";
  } else if (s === "canceled") {
    base += "bg-rose-50 text-rose-700 border-rose-200";
  } else {
    base += "bg-slate-50 text-slate-600 border-slate-200";
  }

  return <span className={base}>{status}</span>;
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
    .select(`
      id, 
      round_type, 
      status, 
      scheduled_start_utc, 
      application_id,
      job_applications (
        company,
        role
      )
    `)
    .gte("scheduled_start_utc", nowIso)
    .order("scheduled_start_utc", { ascending: true })
    .limit(250);

  if (roundsResult.error) {
    throw new Error(roundsResult.error.message);
  }

  const rounds = (roundsResult.data as unknown as RoundRow[] | null) ?? [];
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
      <section className="w-full max-w-4xl">
        <header className="mb-10">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-[var(--accent)]">
            Schedule
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">Your interview agenda</h1>
          <p className="mt-2 text-sm text-black/50">
            Keep track of upcoming rounds across all applications.
          </p>
        </header>

        {entries.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-[2rem] border-2 border-dashed border-[var(--border)] bg-[var(--surface-alt)]/20 px-6 py-16 text-center">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-black/20 shadow-sm">
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <p className="max-w-xs text-sm font-medium text-black/60">
              Your schedule is clear. Run a sync from the dashboard or add an interview manually.
            </p>
            <Link
              href="/dashboard"
              className="mt-6 rounded-full bg-[var(--accent)] px-6 py-2 text-sm font-bold text-white shadow-lg shadow-[var(--accent)]/20 transition-all hover:bg-[var(--accent-strong)]"
            >
              Go to Dashboard
            </Link>
          </div>
        ) : (
          <div className="space-y-12">
            {entries.map(([dateKey, dateRounds]) => (
              <section key={dateKey}>
                <div className="sticky top-[65px] z-10 -mx-6 bg-[var(--background)]/80 px-6 py-3 backdrop-blur-md">
                   <h2 className="flex items-center gap-4">
                     <span className="text-xl font-bold tracking-tight">{formatDateLabel(dateKey)}</span>
                     <span className="h-px flex-1 bg-[var(--border)]/50"></span>
                     <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-black/30">{dateKey}</span>
                   </h2>
                </div>

                <div className="mt-6 grid gap-4">
                  {dateRounds.map((round) => (
                    <Link
                      key={round.id}
                      href={`/applications/${round.application_id}`}
                      className="group relative flex flex-col gap-4 overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 transition-all hover:shadow-md active:scale-[0.99]"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex flex-col">
                          <span className="text-xs font-bold uppercase tracking-widest text-[var(--accent)]">
                            {formatTime(round.scheduled_start_utc)}
                          </span>
                          <h3 className="mt-1 text-lg font-bold leading-tight group-hover:text-[var(--accent)] transition-colors">
                            {round.job_applications.company}
                          </h3>
                          <p className="text-sm font-medium text-black/60">
                            {round.job_applications.role}
                          </p>
                        </div>
                        <StatusBadge status={round.status} />
                      </div>
                      
                      <div className="flex items-center justify-between border-t border-[var(--border)]/40 pt-4">
                        <div className="flex items-center gap-2">
                           <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase border border-slate-200">
                             {round.round_type}
                           </span>
                        </div>
                        <span className="text-xs font-bold text-black/30 group-hover:text-[var(--accent)] transition-colors">
                          View details →
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
