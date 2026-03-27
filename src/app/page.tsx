export default function Home() {
  const roadmap = [
    "Auth + trial/paywall",
    "Gmail read-only connect",
    "Interview sync + parsing",
    "Applications + rounds tracking",
  ];

  return (
    <div className="shell flex flex-1 justify-center px-6 py-12">
      <main className="w-full max-w-5xl rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-8 shadow-sm md:p-12">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-[var(--accent)]">
          Personal Candidate SaaS
        </p>
        <h1 className="mt-4 max-w-3xl text-4xl font-semibold tracking-tight md:text-5xl">
          Interview Tracker for Gmail invites, round statuses, and trial-to-paid access.
        </h1>
        <p className="mt-4 max-w-2xl text-base text-black/70 md:text-lg">
          Project scaffold is ready. This foundation will evolve into your full product
          with parsing, sync, calendar, and subscription controls.
        </p>

        <section className="mt-10 grid gap-5 md:grid-cols-2">
          <article className="rounded-2xl border border-[var(--border)] bg-[var(--surface-alt)] p-6">
            <h2 className="text-lg font-semibold">Build roadmap</h2>
            <ul className="mt-4 space-y-2 text-sm text-black/75">
              {roadmap.map((item) => (
                <li key={item}>- {item}</li>
              ))}
            </ul>
          </article>

          <article className="rounded-2xl border border-[var(--border)] p-6">
            <h2 className="text-lg font-semibold">Starter routes</h2>
            <div className="mt-4 grid gap-2 font-mono text-sm">
              <a className="underline decoration-[var(--accent)]" href="/dashboard">
                /dashboard
              </a>
              <a className="underline decoration-[var(--accent)]" href="/calendar">
                /calendar
              </a>
              <a className="underline decoration-[var(--accent)]" href="/settings">
                /settings
              </a>
              <a className="underline decoration-[var(--accent)]" href="/api/health">
                /api/health
              </a>
            </div>
          </article>
        </section>

        <div className="mt-10 flex flex-wrap gap-3">
          <a
            className="rounded-full bg-[var(--accent)] px-5 py-2 text-sm font-semibold text-white transition hover:bg-[var(--accent-strong)]"
            href="/dashboard"
          >
            Open dashboard
          </a>
          <a
            className="rounded-full border border-[var(--border)] px-5 py-2 text-sm font-semibold"
            href="/settings"
          >
            Configure settings
          </a>
        </div>
      </main>
    </div>
  );
}
