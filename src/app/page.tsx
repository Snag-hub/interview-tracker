import Link from "next/link";

export default function Home() {
  const features = [
    {
      title: "Gmail Auto-Sync",
      description: "Connect your Gmail and let AI extract interview invites automatically.",
      icon: (
        <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
      ),
    },
    {
      title: "Smart Parsing",
      description: "Extracts company, role, date, and meeting links from any email format.",
      icon: (
        <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
    },
    {
      title: "Interactive Calendar",
      description: "Visualize your interview roadmap with a clean, unified schedule.",
      icon: (
        <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      ),
    },
    {
      title: "Progress Tracking",
      description: "Keep notes and track status for every round of every application.",
      icon: (
        <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      ),
    },
  ];

  return (
    <div className="shell flex min-h-screen flex-col items-center px-6 py-16 md:py-24">
      <header className="max-w-4xl text-center">
        <div className="mx-auto mb-6 inline-flex rounded-full bg-[var(--accent)]/10 px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-[var(--accent)]">
          The Professional Interview Assistant
        </div>
        <h1 className="text-4xl font-extrabold tracking-tight text-[var(--foreground)] md:text-6xl lg:text-7xl">
          Track every interview, <br />
          <span className="text-[var(--accent)]">land your dream job.</span>
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-black/60 md:text-xl">
          Stop digging through emails. Interview Tracker automatically organizes your invites, links, and schedules into a single, beautiful dashboard.
        </p>

        <div className="mt-10 flex flex-wrap justify-center gap-4">
          <Link
            className="rounded-full bg-[var(--accent)] px-8 py-3 text-sm font-bold text-white shadow-lg shadow-[var(--accent)]/20 transition-all hover:bg-[var(--accent-strong)] hover:shadow-xl active:scale-95"
            href="/dashboard"
          >
            Get Started Free
          </Link>
          <Link
            className="rounded-full border border-[var(--border)] bg-white px-8 py-3 text-sm font-bold transition-all hover:bg-slate-50"
            href="/settings"
          >
            How it works
          </Link>
        </div>
      </header>

      <section className="mt-20 w-full max-w-6xl grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {features.map((feature) => (
          <div
            key={feature.title}
            className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-8 shadow-sm transition-all hover:shadow-md"
          >
            <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--accent)]/10 text-[var(--accent)]">
              {feature.icon}
            </div>
            <h3 className="text-lg font-bold text-[var(--foreground)]">{feature.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-black/50">{feature.description}</p>
          </div>
        ))}
      </section>

      <section className="mt-24 w-full max-w-4xl overflow-hidden rounded-[3rem] border border-[var(--border)] bg-[var(--surface-alt)]/30 p-8 md:p-12">
        <div className="flex flex-col items-center text-center">
          <h2 className="text-3xl font-bold tracking-tight">Ready to streamline your search?</h2>
          <p className="mt-4 max-w-md text-black/60">
            Join candidates from top tech companies who use our platform to stay organized and perform better.
          </p>
          <Link
            className="mt-8 rounded-full bg-[var(--foreground)] px-8 py-3 text-sm font-bold text-white transition-all hover:bg-black active:scale-95"
            href="/auth/sign-up"
          >
            Create Your Account
          </Link>
        </div>
      </section>
    </div>
  );
}
