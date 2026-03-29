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
  jdUrl?: string | null;
  platform?: string | null;
  resumeVersionId?: string | null;
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
  applicationIds: string[];
  rounds: ProgressRound[];
  resumeVersions: { id: string; version_label: string }[];
};

function formatDate(value: string) {
  return new Date(value).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

function StatusBadge({ status }: { status: string }) {
  const s = status.toLowerCase();
  let base = "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ";

  if (s === "scheduled" || s === "interviewing" || s === "active" || s === "applied") {
    base += "bg-emerald-50 text-emerald-700 border-emerald-200";
  } else if (s === "offer") {
    base += "bg-purple-50 text-purple-700 border-purple-200";
  } else if (s === "rejected" || s === "canceled" || s === "no-show") {
    base += "bg-rose-50 text-rose-700 border-rose-200";
  } else if (s === "onhold" || s === "shortlisted") {
    base += "bg-amber-50 text-amber-700 border-amber-200";
  } else if (s === "completed") {
    base += "bg-blue-50 text-blue-700 border-blue-200";
  } else {
    base += "bg-slate-50 text-slate-600 border-slate-200";
  }

  return <span className={base}>{status}</span>;
}

export function ApplicationProgressPanel({ 
  application, 
  applicationIds, 
  rounds, 
  resumeVersions 
}: ApplicationProgressPanelProps) {
  const [company, setCompany] = useState(application.company);
  const [role, setRole] = useState(application.role);
  const [applicationStatus, setApplicationStatus] = useState(application.applicationStatus);
  const [currentStage, setCurrentStage] = useState(application.currentStage);
  const [applicationNotes, setApplicationNotes] = useState(application.notes ?? "");
  const [jdUrl, setJdUrl] = useState(application.jdUrl ?? "");
  const [platform, setPlatform] = useState(application.platform ?? "");
  const [resumeVersionId, setResumeVersionId] = useState(application.resumeVersionId ?? "");
  
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
          organizerEmail: round.organizerEmail ?? "",
          attendeeEmails: round.attendeeEmails.join(", "),
        },
      ]),
    ) as Record<string, { status: string; notes: string; organizerEmail: string; attendeeEmails: string }>,
  );
  const [savingRoundId, setSavingRoundId] = useState<string | null>(null);
  const [roundMessage, setRoundMessage] = useState<string | null>(null);

  const saveApplication = async () => {
    setSavingApplication(true);
    setApplicationMessage(null);

    try {
      for (const applicationId of applicationIds) {
        const response = await fetch(`/api/applications/${applicationId}`, {
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
            jdUrl: jdUrl.trim() || null,
            platform: platform.trim() || null,
            resumeVersionId: resumeVersionId || null,
          }),
        });

        if (!response.ok) {
          const payload = (await response.json().catch(() => null)) as { error?: string } | null;
          throw new Error(payload?.error || "Failed to update application");
        }
      }

      setApplicationMessage("Changes saved successfully.");
      window.setTimeout(() => setApplicationMessage(null), 3000);
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
          organizerEmail: draft.organizerEmail.trim() || null,
          attendeeEmails: draft.attendeeEmails.split(",").map(e => e.trim()).filter(Boolean),
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
                organizerEmail: draft.organizerEmail.trim() || null,
                attendeeEmails: draft.attendeeEmails.split(",").map(e => e.trim()).filter(Boolean),
              }
            : round,
        ),
      );
      setRoundMessage("Round updated.");
      window.setTimeout(() => setRoundMessage(null), 3000);
    } catch (error) {
      setRoundMessage(error instanceof Error ? error.message : "Failed to update round");
    } finally {
      setSavingRoundId(null);
    }
  };

  return (
    <div className="flex flex-col gap-8">
      {/* Header */}
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
           <Link 
            href="/dashboard" 
            className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface)] text-black/40 hover:text-[var(--accent)] hover:border-[var(--accent)] transition-all shadow-sm"
            title="Back to Dashboard"
           >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </Link>
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--accent)] font-bold">Progress Timeline</p>
            <h1 className="text-3xl font-extrabold tracking-tight">
              {company}
            </h1>
            <p className="text-sm font-medium text-black/50">{role}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
           <StatusBadge status={applicationStatus} />
           <span className="h-4 w-px bg-[var(--border)]"></span>
           <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase border border-slate-200 text-slate-700">
              {currentStage}
           </span>
        </div>
      </header>

      <div className="grid gap-8 lg:grid-cols-3">
        {/* Sidebar: Application Summary */}
        <aside className="lg:col-span-1 space-y-6">
          <article className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-sm overflow-hidden relative">
            <div className="absolute top-0 right-0 p-4 opacity-5">
               <svg className="h-16 w-16" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M19 3h-4.18C14.4 1.84 13.3 1 12 1s-2.4.84-2.82 2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 0c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm2 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"/>
               </svg>
            </div>

            <h2 className="text-lg font-bold mb-6">Application Summary</h2>

            <div className="space-y-4">
              <label className="block">
                <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-black/40">Status</span>
                <select
                  className="w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm font-medium focus:border-[var(--accent)] outline-none"
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

              <label className="block">
                <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-black/40">Current Stage</span>
                <select
                  className="w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm font-medium focus:border-[var(--accent)] outline-none"
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

              <label className="block">
                <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-black/40">Platform</span>
                <input
                  className="w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm font-medium focus:border-[var(--accent)] outline-none"
                  placeholder="e.g. LinkedIn, Indeed"
                  value={platform}
                  onChange={(event) => setPlatform(event.target.value)}
                />
              </label>

              <label className="block">
                <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-black/40">JD Link</span>
                <input
                  className="w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm font-medium focus:border-[var(--accent)] outline-none"
                  type="url"
                  placeholder="Link to job description"
                  value={jdUrl}
                  onChange={(event) => setJdUrl(event.target.value)}
                />
              </label>

              <label className="block">
                <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-black/40">Resume Used</span>
                <select
                  className="w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm font-medium focus:border-[var(--accent)] outline-none"
                  value={resumeVersionId}
                  onChange={(event) => setResumeVersionId(event.target.value)}
                >
                  <option value="">Select a version...</option>
                  {resumeVersions.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.version_label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-black/40">Internal Notes</span>
                <textarea
                  className="w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm font-medium focus:border-[var(--accent)] outline-none min-h-[120px]"
                  placeholder="Paste JD text, salary range, or recruiter names here..."
                  value={applicationNotes}
                  onChange={(event) => setApplicationNotes(event.target.value)}
                />
              </label>

              <div className="pt-2">
                <button
                  className="w-full rounded-full bg-[var(--accent)] px-4 py-2.5 text-sm font-bold text-white hover:bg-[var(--accent-strong)] disabled:opacity-60 shadow-lg shadow-[var(--accent)]/10 transition-all active:scale-95"
                  type="button"
                  disabled={savingApplication}
                  onClick={saveApplication}
                >
                  {savingApplication ? "Saving..." : "Save Changes"}
                </button>
                {applicationMessage && (
                  <p className="mt-3 text-center text-[10px] font-bold text-emerald-600 uppercase tracking-tight italic">
                    {applicationMessage}
                  </p>
                )}
              </div>
            </div>
          </article>
        </aside>

        {/* Main Content: Interview Timeline */}
        <div className="lg:col-span-2">
          <section className="flex flex-col gap-6">
            <h2 className="text-xl font-bold px-1 flex items-center gap-2">
              <svg className="h-5 w-5 text-black/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Interview Timeline
            </h2>

            {roundList.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-3xl border-2 border-dashed border-[var(--border)] bg-[var(--surface-alt)]/20 px-6 py-16 text-center">
                <p className="max-w-xs text-sm font-medium text-black/40 italic">
                  No interview rounds have been tracked for this application yet.
                </p>
              </div>
            ) : (
              <div className="relative space-y-8 before:absolute before:left-[21px] before:top-4 before:h-[calc(100%-32px)] before:w-px before:bg-[var(--border)]/40">
                {roundList.map((round) => (
                  <div key={round.id} className="relative pl-12">
                    {/* Timeline dot */}
                    <div className="absolute left-0 top-1.5 flex h-11 w-11 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface)] text-[var(--accent)] shadow-sm group">
                       <div className="h-3 w-3 rounded-full bg-[var(--accent)] group-hover:scale-125 transition-transform"></div>
                    </div>

                    <article className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-sm transition-all hover:shadow-md">
                      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--border)]/30 pb-4 mb-4">
                        <div>
                          <h3 className="text-lg font-bold text-[var(--foreground)]">{round.roundType} Round</h3>
                          <p className="text-xs font-mono font-bold text-black/30 mt-0.5 uppercase tracking-widest">
                            {formatDate(round.scheduledStartUtc)}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                           <StatusBadge status={roundDrafts[round.id]?.status ?? round.status} />
                           <select
                            className="rounded-lg border border-[var(--border)] bg-[var(--surface-alt)]/20 px-2 py-1 text-[10px] font-bold uppercase tracking-wider outline-none focus:border-[var(--accent)]"
                            value={roundDrafts[round.id]?.status ?? round.status}
                            onChange={(event) =>
                              setRoundDrafts((current) => ({
                                ...current,
                                [round.id]: {
                                  ...current[round.id],
                                  status: event.target.value,
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
                        </div>
                      </header>

                      <div className="grid gap-4 sm:grid-cols-2 text-sm">
                        <div className="space-y-3">
                           <label className="block">
                              <span className="mb-1.5 block text-[9px] font-bold uppercase tracking-wider text-black/40">Organizer Email</span>
                              <input
                                className="w-full rounded-xl border border-[var(--border)]/60 bg-[var(--surface-alt)]/10 px-3 py-2 text-xs font-bold outline-none focus:border-[var(--accent)]"
                                value={roundDrafts[round.id]?.organizerEmail ?? ""}
                                onChange={(event) =>
                                  setRoundDrafts((current) => ({
                                    ...current,
                                    [round.id]: {
                                      ...current[round.id],
                                      organizerEmail: event.target.value,
                                    },
                                  }))
                                }
                              />
                           </label>
                           <label className="block">
                              <span className="mb-1.5 block text-[9px] font-bold uppercase tracking-wider text-black/40">Attendee Emails (comma separated)</span>
                              <input
                                className="w-full rounded-xl border border-[var(--border)]/60 bg-[var(--surface-alt)]/10 px-3 py-2 text-xs font-bold outline-none focus:border-[var(--accent)]"
                                value={roundDrafts[round.id]?.attendeeEmails ?? ""}
                                onChange={(event) =>
                                  setRoundDrafts((current) => ({
                                    ...current,
                                    [round.id]: {
                                      ...current[round.id],
                                      attendeeEmails: event.target.value,
                                    },
                                  }))
                                }
                              />
                           </label>
                        </div>
                        <div className="space-y-3">
                           <div>
                              <p className="text-[10px] font-bold uppercase tracking-wider text-black/30">Meeting Link</p>
                              {round.meetingLink ? (
                                <a 
                                  className="inline-flex items-center gap-1.5 font-bold text-[var(--accent)] hover:underline" 
                                  href={round.meetingLink} 
                                  target="_blank" 
                                  rel="noreferrer"
                                >
                                  Join Interview
                                  <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                  </svg>
                                </a>
                              ) : (
                                <p className="font-medium text-black/30">No link found</p>
                              )}
                           </div>
                           <div>
                              <p className="text-[10px] font-bold uppercase tracking-wider text-black/30">Timezone</p>
                              <p className="font-medium text-black/70">{round.timezone ?? "Asia/Kolkata"}</p>
                           </div>
                        </div>
                      </div>

                      <div className="mt-6 border-t border-[var(--border)]/30 pt-4">
                        <label className="block">
                          <span className="mb-2 block text-[10px] font-bold uppercase tracking-wider text-black/40">Round Notes & Feedback</span>
                          <textarea
                            className="w-full rounded-2xl border border-[var(--border)]/60 bg-[var(--surface-alt)]/10 px-4 py-3 text-sm font-medium focus:border-[var(--accent)] outline-none min-h-[100px]"
                            placeholder="How did it go? Any tricky questions asked?"
                            value={roundDrafts[round.id]?.notes ?? round.notes ?? ""}
                            onChange={(event) =>
                              setRoundDrafts((current) => ({
                                ...current,
                                [round.id]: {
                                  ...current[round.id],
                                  notes: event.target.value,
                                },
                              }))
                            }
                          />
                        </label>

                        <div className="mt-4 flex items-center justify-between">
                           {roundMessage && savingRoundId === round.id && (
                             <p className="text-[10px] font-bold text-emerald-600 uppercase italic">{roundMessage}</p>
                           )}
                           <div className="flex-1"></div>
                           <button
                            className="rounded-full bg-slate-900 px-6 py-2 text-xs font-bold text-white hover:bg-black transition-all active:scale-95 disabled:opacity-60 shadow-lg shadow-black/10"
                            type="button"
                            disabled={savingRoundId === round.id}
                            onClick={() => saveRound(round.id)}
                          >
                            {savingRoundId === round.id ? "Saving..." : "Update Round"}
                          </button>
                        </div>
                      </div>
                    </article>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

