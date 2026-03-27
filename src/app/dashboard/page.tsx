import type { DashboardRound } from "@/lib/domain";

const rounds: DashboardRound[] = [
  {
    id: "rd_001",
    company: "Acme Labs",
    role: "Backend Engineer",
    roundType: "HR",
    status: "Scheduled",
    scheduledStart: "2026-03-29T10:00:00Z",
    meetingLink: "https://meet.google.com/example-one",
  },
  {
    id: "rd_002",
    company: "Northwind",
    role: "SDE II",
    roundType: "L1",
    status: "Completed",
    scheduledStart: "2026-03-26T14:30:00Z",
  },
];

export default function DashboardPage() {
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

        <div className="mt-6 overflow-hidden rounded-xl border border-[var(--border)]">
          <table className="w-full text-left text-sm">
            <thead className="bg-[var(--surface-alt)] font-mono text-xs uppercase tracking-wider text-black/70">
              <tr>
                <th className="px-4 py-3">Company</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Round</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Date (UTC)</th>
              </tr>
            </thead>
            <tbody>
              {rounds.map((round) => (
                <tr key={round.id} className="border-t border-[var(--border)]">
                  <td className="px-4 py-3">{round.company}</td>
                  <td className="px-4 py-3">{round.role}</td>
                  <td className="px-4 py-3">{round.roundType}</td>
                  <td className="px-4 py-3">{round.status}</td>
                  <td className="px-4 py-3">{new Date(round.scheduledStart).toISOString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
