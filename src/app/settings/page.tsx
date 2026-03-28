import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session-user";
import { createSupabaseServerClient } from "@/lib/supabase/server-client";

const resumeLinks = [
  {
    label: "Resume v3 - Backend",
    url: "https://drive.google.com/file/d/example-backend-resume",
  },
  {
    label: "Resume v2 - Fullstack",
    url: "https://drive.google.com/file/d/example-fullstack-resume",
  },
];

type SettingsPageProps = {
  searchParams: Promise<{ sync?: string; gmail?: string }>;
};

export default async function SettingsPage({ searchParams }: SettingsPageProps) {
  const params = await searchParams;
  const user = await getSessionUser();
  if (!user) {
    redirect("/auth/sign-in?next=/settings");
  }

  const supabase = await createSupabaseServerClient();
  const [{ data: gmailAccount }, { data: subscription }] = await Promise.all([
    supabase.from("gmail_accounts").select("google_email, last_sync_at").eq("user_id", user.id).maybeSingle(),
    supabase
      .from("subscriptions")
      .select("status, trial_ends_at, current_period_end")
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);

  return (
    <main className="shell flex flex-1 justify-center px-6 py-10">
      <section className="w-full max-w-5xl rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 md:p-8">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-[var(--accent)]">
          Settings
        </p>
        <h1 className="mt-2 text-2xl font-semibold">Gmail and billing setup</h1>
        {params.gmail === "connected" ? (
          <p className="mt-2 rounded-lg bg-emerald-100 px-3 py-2 text-sm text-emerald-800">
            Gmail connected successfully.
          </p>
        ) : null}
        {params.sync ? (
          <p className="mt-2 rounded-lg bg-[var(--surface-alt)] px-3 py-2 text-sm text-black/75">
            Last sync result: {params.sync}
          </p>
        ) : null}

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <article className="rounded-xl border border-[var(--border)] p-4">
            <h2 className="text-lg font-semibold">Gmail integration</h2>
            <p className="mt-1 text-sm text-black/70">
              Status: {gmailAccount ? `Connected (${gmailAccount.google_email})` : "Not connected"}
            </p>
            <p className="mt-1 text-xs text-black/60">
              Last sync: {gmailAccount?.last_sync_at ? new Date(gmailAccount.last_sync_at).toLocaleString() : "Never"}
            </p>
            <div className="mt-4 flex gap-2">
              <a
                className="rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white"
                href="/api/gmail/connect"
              >
                {gmailAccount ? "Reconnect Gmail" : "Connect Gmail"}
              </a>
              <form action="/api/sync" method="post">
                <button
                  className="rounded-full border border-[var(--border)] px-4 py-2 text-sm font-semibold"
                  type="submit"
                >
                  Sync now
                </button>
              </form>
              <form action="/api/sync?full=1" method="post">
                <button
                  className="rounded-full border border-[var(--border)] px-4 py-2 text-sm font-semibold"
                  type="submit"
                >
                  Full sync
                </button>
              </form>
            </div>
          </article>

          <article className="rounded-xl border border-[var(--border)] p-4">
            <h2 className="text-lg font-semibold">Subscription</h2>
            <p className="mt-1 text-sm text-black/70">
              Plan status: {subscription?.status ?? "Not initialized"}
            </p>
            <p className="mt-1 text-xs text-black/60">
              Trial ends: {subscription?.trial_ends_at ? new Date(subscription.trial_ends_at).toLocaleDateString() : "-"}
            </p>
            <button
              className="mt-4 rounded-full border border-[var(--border)] px-4 py-2 text-sm font-semibold"
              type="button"
            >
              Upgrade to Pro
            </button>
          </article>
        </div>

        <article className="mt-4 rounded-xl border border-[var(--border)] p-4">
          <h2 className="text-lg font-semibold">Resume versions (links)</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {resumeLinks.map((resume) => (
              <li key={resume.label} className="rounded-lg bg-[var(--surface-alt)] px-3 py-2">
                <span className="font-semibold">{resume.label}</span>
                <span className="mx-2 text-black/50">-</span>
                <a className="underline" href={resume.url} target="_blank" rel="noreferrer">
                  {resume.url}
                </a>
              </li>
            ))}
          </ul>
        </article>
      </section>
    </main>
  );
}
