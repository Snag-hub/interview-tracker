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

export default function SettingsPage() {
  return (
    <main className="shell flex flex-1 justify-center px-6 py-10">
      <section className="w-full max-w-5xl rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 md:p-8">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-[var(--accent)]">
          Settings
        </p>
        <h1 className="mt-2 text-2xl font-semibold">Gmail and billing setup</h1>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <article className="rounded-xl border border-[var(--border)] p-4">
            <h2 className="text-lg font-semibold">Gmail integration</h2>
            <p className="mt-1 text-sm text-black/70">Status: Not connected</p>
            <button
              className="mt-4 rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white"
              type="button"
            >
              Connect Gmail
            </button>
          </article>

          <article className="rounded-xl border border-[var(--border)] p-4">
            <h2 className="text-lg font-semibold">Subscription</h2>
            <p className="mt-1 text-sm text-black/70">Plan status: Trial (11 days left)</p>
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
