const upcomingDates = [
  "2026-03-29",
  "2026-03-31",
  "2026-04-03",
  "2026-04-07",
  "2026-04-09",
  "2026-04-12",
  "2026-04-14",
];

export default function CalendarPage() {
  return (
    <main className="shell flex flex-1 justify-center px-6 py-10">
      <section className="w-full max-w-5xl rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 md:p-8">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-[var(--accent)]">
          Calendar
        </p>
        <h1 className="mt-2 text-2xl font-semibold">Interview schedule overview</h1>
        <p className="mt-2 text-sm text-black/70">
          This placeholder grid will be replaced by month/week calendar components.
        </p>

        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7">
          {upcomingDates.map((date) => (
            <article
              key={date}
              className="rounded-xl border border-[var(--border)] bg-[var(--surface-alt)] p-3"
            >
              <p className="font-mono text-xs text-black/65">{date}</p>
              <p className="mt-2 text-sm font-semibold">1 interview</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
