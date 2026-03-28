"use client";

import Link from "next/link";
import { useState } from "react";
import { applicationStatuses, roundStatuses, stageTypes } from "@/lib/domain";

export type ApplicationProgress = {
  id: string;
  company: string;
  role: string;
  applicationStatus: string;
  currentStage: string;
  notes: string | null;
};

export type ProgressRound = {
  id: string;
  roundType: string;
  status: string;
  scheduledStartUtc: string;
  scheduledEndUtc: string | null;
  timezone: string | null;
  meetingLink: string | null;
  organizerEmail: string | null;
  attendeeEmails: string[];
  notes: string | null;
};

type ApplicationProgressPanelProps = {
  application: ApplicationProgress;
  rounds: ProgressRound[];
};

function formatDate(value: string) {
  return new Date(value).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

export function ApplicationProgressPanel({ application, rounds }: ApplicationProgressPanelProps) {
  const [company, setCompany] = useState(application.company);
  const [role, setRole] = useState(application.role);
  const [applicationStatus, setApplicationStatus] = useState(application.applicationStatus);
  const [currentStage, setCurrentStage] = useState(application.currentStage);
  const [applicationNotes, setApplicationNotes] = useState(application.notes ?? "");
  const [savingApplication, setSavingApplication] = useState(false);
  const [applicationMessage, setApplicationMessage] = useState<string | null>(null);

  const [roundList, setRoundList] = useState(rounds);
  const [roundDrafts, setRoundDrafts] = useState(
    Object.fromEntries(
      rounds.map((round) => [
        round.id,
        {
          status: round.status,
          notes: round.notes ?? "",
        },
      ]),
    ) as Record<string, { status: string; notes: string }>,
  );
  const [savingRoundId, setSavingRoundId] = useState<string | null>(null);
  const [roundMessage, setRoundMessage] = useState<string | null>(null);

  const saveApplication = async () => {
    setSavingApplication(true);
    setApplicationMessage(null);

    try {
      const response = await fetch(`/api/applications/${application.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          company: company.trim(),
          role: role.trim(),
          applicationStatus,
          currentStage,
          notes: applicationNotes.trim() || null,
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error || "Failed to update application");
      }

      setApplicationMessage("Application updated.");
    } catch (error) {
      setApplicationMessage(error instanceof Error ? error.message : "Failed to update application");
    } finally {
      setSavingApplication(false);
    }
  };

  const saveRound = async (roundId: string) => {
    const draft = roundDrafts[roundId];
    if (!draft) return;

    setSavingRoundId(roundId);
    setRoundMessage(null);

    try {
      const response = await fetch(`/api/rounds/${roundId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          status: draft.status,
          notes: draft.notes.trim() || null,
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error || "Failed to update round");
      }

      setRoundList((current) =>
        current.map((round) =>
          round.id === roundId
            ? {
                ...round,
                status: draft.status,
                notes: draft.notes.trim() || null,
              }
            : round,
        ),
      );
      setRoundMessage("Round updated.");
    } catch (error) {
      setRoundMessage(error instanceof Error ? error.message : "Failed to update round");
    } finally {
      setSavingRoundId(null);
    }
  };

  return (
    <main className="shell flex flex-1 justify-center px-6 py-10">
      <section className="w-full max-w-6xl rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 md:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-[var(--accent)]">Application Progress</p>
            <h1 className="mt-2 text-2xl font-semibold">
              {company} - {role}
            </h1>
          </div>
          <Link href="/dashboard" className="rounded-full border border-[var(--border)] px-4 py-2 text-sm font-semibold">
            Back to Dashboard
          </Link>
        </div>

        <article className="mt-6 rounded-xl border border-[var(--border)] p-4">
          <h2 className="text-lg font-semibold">Application Summary</h2>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <label className="text-sm">
              <span className="mb-1 block text-black/70">Company</span>
              <input
                className="w-full rounded-md border border-[var(--border)] bg-white px-3 py-2"
                value={company}
                onChange={(event) => setCompany(event.target.value)}
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-black/70">Role</span>
              <input
                className="w-full rounded-md border border-[var(--border)] bg-white px-3 py-2"
                value={role}
                onChange={(event) => setRole(event.target.value)}
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-black/70">Application Status</span>
              <select
                className="w-full rounded-md border border-[var(--border)] bg-white px-3 py-2"
                value={applicationStatus}
                onChange={(event) => setApplicationStatus(event.target.value)}
              >
                {applicationStatuses.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-black/70">Current Stage</span>
              <select
                className="w-full rounded-md border border-[var(--border)] bg-white px-3 py-2"
                value={currentStage}
                onChange={(event) => setCurrentStage(event.target.value)}
              >
                {stageTypes.map((stage) => (
                  <option key={stage} value={stage}>
                    {stage}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="mt-3 block text-sm">
            <span className="mb-1 block text-black/70">Application Notes</span>
            <textarea
              className="w-full rounded-md border border-[var(--border)] bg-white px-3 py-2"
              rows={4}
              value={applicationNotes}
              onChange={(event) => setApplicationNotes(event.target.value)}
            />
          </label>

          <div className="mt-3 flex items-center gap-3">
            <button
              className="rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--accent-strong)] disabled:opacity-60"
              type="button"
              disabled={savingApplication}
              onClick={saveApplication}
            >
              {savingApplication ? "Saving..." : "Save Application"}
            </button>
            {applicationMessage ? <p className="text-sm text-black/75">{applicationMessage}</p> : null}
          </div>
        </article>

        <article className="mt-6 rounded-xl border border-[var(--border)] p-4">
          <h2 className="text-lg font-semibold">Interview Timeline</h2>
          {roundList.length === 0 ? (
            <p className="mt-2 text-sm text-black/70">No rounds found for this application yet.</p>
          ) : (
            <div className="mt-3 space-y-3">
              {roundList.map((round) => (
                <div key={round.id} className="rounded-lg border border-[var(--border)] bg-[var(--surface-alt)] p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="font-semibold">
                      {round.roundType} - {formatDate(round.scheduledStartUtc)}
                    </p>
                    <label className="text-sm">
                      <span className="mr-2 text-black/70">Status</span>
                      <select
                        className="rounded-md border border-[var(--border)] bg-white px-2 py-1"
                        value={roundDrafts[round.id]?.status ?? round.status}
                        onChange={(event) =>
                          setRoundDrafts((current) => ({
                            ...current,
                            [round.id]: {
                              status: event.target.value,
                              notes: current[round.id]?.notes ?? round.notes ?? "",
                            },
                          }))
                        }
                      >
                        {roundStatuses.map((status) => (
                          <option key={status} value={status}>
                            {status}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <div className="mt-2 grid gap-2 text-sm text-black/75 md:grid-cols-2">
                    <p>
                      Organizer: <span className="font-medium">{round.organizerEmail ?? "-"}</span>
                    </p>
                    <p>
                      Attendees: <span className="font-medium">{round.attendeeEmails.length > 0 ? round.attendeeEmails.join(", ") : "-"}</span>
                    </p>
                    <p>
                      Timezone: <span className="font-medium">{round.timezone ?? "-"}</span>
                    </p>
                    <p>
                      Meeting Link:{" "}
                      {round.meetingLink ? (
                        <a className="underline" href={round.meetingLink} target="_blank" rel="noreferrer">
                          Open
                        </a>
                      ) : (
                        <span className="font-medium">-</span>
                      )}
                    </p>
                  </div>

                  <label className="mt-3 block text-sm">
                    <span className="mb-1 block text-black/70">Round Notes</span>
                    <textarea
                      className="w-full rounded-md border border-[var(--border)] bg-white px-3 py-2"
                      rows={3}
                      value={roundDrafts[round.id]?.notes ?? round.notes ?? ""}
                      onChange={(event) =>
                        setRoundDrafts((current) => ({
                          ...current,
                          [round.id]: {
                            status: current[round.id]?.status ?? round.status,
                            notes: event.target.value,
                          },
                        }))
                      }
                    />
                  </label>

                  <div className="mt-3">
                    <button
                      className="rounded-full border border-[var(--border)] bg-white px-4 py-2 text-sm font-semibold"
                      type="button"
                      disabled={savingRoundId === round.id}
                      onClick={() => saveRound(round.id)}
                    >
                      {savingRoundId === round.id ? "Saving..." : "Save Round"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
          {roundMessage ? <p className="mt-3 text-sm text-black/75">{roundMessage}</p> : null}
        </article>
      </section>
    </main>
  );
}
