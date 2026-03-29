import { redirect } from "next/navigation";
import { SettingsReviewQueuePanel } from "@/components/settings-review-queue-panel";
import { SettingsSyncControls } from "@/components/settings-sync-controls";
import { ResumeManager } from "@/components/settings-resume-manager";
import { getSessionUser } from "@/lib/auth/session-user";
import { createSupabaseServerClient } from "@/lib/supabase/server-client";

type SettingsPageProps = {
  searchParams: Promise<{
    sync?: string;
    gmail?: string;
    fetched?: string;
    created?: string;
    updated?: string;
    failed?: string;
  }>;
};

function toCount(value: string | undefined): number | null {
  if (!value) return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? null : parsed;
}

function SyncStatusBadge({ status }: { status: string }) {
  const s = status.toLowerCase();
  let base = "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ";

  if (s === "success") {
    base += "bg-emerald-50 text-emerald-700 border-emerald-200";
  } else if (s === "partial") {
    base += "bg-amber-50 text-amber-700 border-amber-200";
  } else {
    base += "bg-rose-50 text-rose-700 border-rose-200";
  }

  return <span className={base}>{status}</span>;
}

export default async function SettingsPage({ searchParams }: SettingsPageProps) {
  const params = await searchParams;
  const user = await getSessionUser();
  if (!user) {
    redirect("/auth/sign-in?next=/settings");
  }

  const supabase = await createSupabaseServerClient();
  const [{ data: gmailAccount }, { data: subscription }, { data: syncRuns }, { data: resumeVersions }] = await Promise.all([
    supabase.from("gmail_accounts").select("google_email, last_sync_at").eq("user_id", user.id).maybeSingle(),
    supabase
      .from("subscriptions")
      .select("status, trial_ends_at, current_period_end")
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("sync_runs")
      .select("id, started_at, ended_at, status, fetched_count, created_count, updated_count, failed_count")
      .eq("user_id", user.id)
      .order("started_at", { ascending: false })
      .limit(5),
    supabase
      .from("resume_versions")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
  ]);

  const syncFetched = toCount(params.fetched);
  const syncCreated = toCount(params.created);
  const syncUpdated = toCount(params.updated);
  const syncFailed = toCount(params.failed);

  return (
    <main className="shell flex flex-1 justify-center px-6 py-10">
      <section className="w-full max-w-5xl">
        <header className="mb-10">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-[var(--accent)]">
            Account
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">Settings & Integrations</h1>
          <p className="mt-2 text-sm text-black/50">
            Manage your Gmail connection, resume versions, and subscription.
          </p>
        </header>

        {params.gmail === "connected" && (
          <div className="mb-6 rounded-2xl bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm font-bold text-emerald-800 flex items-center gap-3">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            Gmail connected successfully.
          </div>
        )}

        <div className="grid gap-6 md:grid-cols-2">
          {/* Gmail Card */}
          <article className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <div className="h-12 w-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center">
                <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/>
                </svg>
              </div>
              <div className="flex flex-col items-end">
                <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full border ${gmailAccount ? "bg-emerald-50 text-emerald-700 border-emerald-100" : "bg-slate-50 text-slate-500 border-slate-100"}`}>
                  {gmailAccount ? "Active" : "Disconnected"}
                </span>
              </div>
            </div>

            <h2 className="text-xl font-bold text-[var(--foreground)]">Gmail Integration</h2>
            <p className="mt-1 text-sm text-black/50 leading-relaxed">
              Required to automatically sync interview invites and calendar attachments.
            </p>

            <div className="mt-6 space-y-3">
              <div className="rounded-xl bg-[var(--surface-alt)]/30 p-3 border border-[var(--border)]/30">
                <p className="text-[10px] font-bold uppercase tracking-wider text-black/40 mb-1">Connected Email</p>
                <p className="text-sm font-bold text-black/80">{gmailAccount?.google_email ?? "Not linked"}</p>
              </div>
              <div className="rounded-xl bg-[var(--surface-alt)]/30 p-3 border border-[var(--border)]/30">
                <p className="text-[10px] font-bold uppercase tracking-wider text-black/40 mb-1">Last Sync</p>
                <p className="text-sm font-bold text-black/80">
                  {gmailAccount?.last_sync_at ? new Date(gmailAccount.last_sync_at).toLocaleString() : "Never"}
                </p>
              </div>
            </div>

            <div className="mt-8 flex flex-wrap gap-3">
              <a
                className="rounded-full bg-[var(--accent)] px-6 py-2.5 text-sm font-bold text-white shadow-md shadow-[var(--accent)]/20 transition-all hover:bg-[var(--accent-strong)]"
                href="/api/gmail/connect"
              >
                {gmailAccount ? "Update Connection" : "Link Gmail Account"}
              </a>
              {gmailAccount && (
                <form action="/api/gmail/disconnect" method="post">
                  <button
                    className="rounded-full border border-rose-200 bg-white px-6 py-2.5 text-sm font-bold text-rose-600 transition-all hover:bg-rose-50"
                    type="submit"
                  >
                    Disconnect
                  </button>
                </form>
              )}
            </div>
            
            <div className="mt-6 border-t border-[var(--border)]/30 pt-6">
               <SettingsSyncControls hasGmailAccount={Boolean(gmailAccount)} />
            </div>
          </article>

          {/* Subscription Card */}
          <article className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-sm flex flex-col">
            <div className="flex items-center justify-between mb-6">
              <div className="h-12 w-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center">
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m.599-2.001C14.002 14.903 15 13.847 15 12.5s-1.002-2.503-2.401-2.999z" />
                </svg>
              </div>
              <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-100">
                {subscription?.status ?? "Trial"}
              </span>
            </div>

            <h2 className="text-xl font-bold text-[var(--foreground)]">Subscription Plan</h2>
            <p className="mt-1 text-sm text-black/50 leading-relaxed">
              Unlock unlimited syncs, AI-powered parsing, and personalized insights.
            </p>

            <div className="mt-6 space-y-4 flex-1">
               <div className="flex items-center justify-between py-2 border-b border-[var(--border)]/30">
                  <span className="text-sm text-black/60 font-medium">Trial End Date</span>
                  <span className="text-sm font-bold text-black/80">
                    {subscription?.trial_ends_at ? new Date(subscription.trial_ends_at).toLocaleDateString() : "-"}
                  </span>
               </div>
               <div className="flex items-center justify-between py-2 border-b border-[var(--border)]/30">
                  <span className="text-sm text-black/60 font-medium">Monthly Cost</span>
                  <span className="text-sm font-bold text-black/80">$12.00</span>
               </div>
            </div>

            <button
              className="mt-8 w-full rounded-2xl bg-[var(--foreground)] py-3 text-sm font-bold text-white transition-all hover:bg-black active:scale-95 shadow-lg shadow-black/10"
              type="button"
            >
              Upgrade to Professional
            </button>
          </article>
        </div>

        <ResumeManager initialResumes={resumeVersions ?? []} />

        {/* History & Queue */}
        <div className="mt-8 grid gap-8 lg:grid-cols-3">
           <article className="lg:col-span-1 rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-sm">
             <h2 className="text-lg font-bold mb-6 flex items-center gap-2">
               <svg className="h-5 w-5 text-black/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
               </svg>
               Sync History
             </h2>
             {syncRuns && syncRuns.length > 0 ? (
               <div className="space-y-4">
                 {syncRuns.map((run) => (
                   <div key={run.id} className="rounded-2xl border border-[var(--border)]/40 bg-[var(--surface-alt)]/20 p-4">
                     <div className="flex items-center justify-between mb-2">
                        <SyncStatusBadge status={run.status} />
                        <span className="text-[10px] font-bold text-black/30">
                          {run.ended_at ? new Date(run.ended_at).toLocaleDateString() : new Date(run.started_at).toLocaleDateString()}
                        </span>
                     </div>
                     <p className="text-[10px] font-mono font-bold text-black/50 leading-relaxed">
                       Fetched: {run.fetched_count} | +{run.created_count} | -{run.failed_count}
                     </p>
                   </div>
                 ))}
               </div>
             ) : (
               <div className="py-12 text-center text-black/30 italic text-sm">No sync history yet.</div>
             )}
           </article>

           <div className="lg:col-span-2">
             <SettingsReviewQueuePanel />
           </div>
        </div>
      </section>
    </main>
  );
}
