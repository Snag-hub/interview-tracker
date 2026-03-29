"use client";

import { useState, type FormEvent } from "react";
import { roundStatuses } from "@/lib/domain";

const roundTypes = ["HR", "L1", "L2", "Managerial", "Final", "Other"] as const;

type ApplicationApiRow = {
  id: string;
  company: string;
  role: string;
};

function normalize(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

export function DashboardAddInterviewForm() {
  const [isOpen, setIsOpen] = useState(false);
  const [company, setCompany] = useState("");
  const [role, setRole] = useState("");
  const [roundType, setRoundType] = useState<(typeof roundTypes)[number]>("HR");
  const [status, setStatus] = useState<(typeof roundStatuses)[number]>("Scheduled");
  const [scheduledStartLocal, setScheduledStartLocal] = useState("");
  const [organizerEmail, setOrganizerEmail] = useState("");
  const [attendeesCsv, setAttendeesCsv] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const resetForm = () => {
    setCompany("");
    setRole("");
    setRoundType("HR");
    setStatus("Scheduled");
    setScheduledStartLocal("");
    setOrganizerEmail("");
    setAttendeesCsv("");
    setNotes("");
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setMessage(null);

    if (!company.trim() || !role.trim() || !scheduledStartLocal) {
      setError("Company, role, and interview date/time are required.");
      return;
    }

    setSaving(true);

    try {
      const applicationsResponse = await fetch("/api/applications", { method: "GET" });
      if (!applicationsResponse.ok) {
        throw new Error("Failed to load applications for matching");
      }

      const applicationsPayload = (await applicationsResponse.json()) as {
        applications?: ApplicationApiRow[];
      };

      const normalizedCompany = normalize(company);
      const normalizedRole = normalize(role);

      const matchingApplication = (applicationsPayload.applications ?? []).find(
        (application) =>
          normalize(application.company) === normalizedCompany && normalize(application.role) === normalizedRole,
      );

      let applicationId = matchingApplication?.id;

      if (!applicationId) {
        const createApplicationResponse = await fetch("/api/applications", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            company: company.trim(),
            role: role.trim(),
            applicationStatus: "Interviewing",
            currentStage: roundType === "Other" ? "None" : roundType,
          }),
        });

        const createApplicationPayload = (await createApplicationResponse.json().catch(() => null)) as
          | { application?: { id?: string }; error?: string }
          | null;

        if (!createApplicationResponse.ok || !createApplicationPayload?.application?.id) {
          throw new Error(createApplicationPayload?.error || "Failed to create application");
        }

        applicationId = createApplicationPayload.application.id;
      }

      const attendeeEmails = attendeesCsv
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);

      const createRoundResponse = await fetch(`/api/applications/${applicationId}/rounds`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          roundType,
          status,
          scheduledStartUtc: new Date(scheduledStartLocal).toISOString(),
          timezone: "Asia/Kolkata",
          organizerEmail: organizerEmail.trim() || undefined,
          attendeeEmails,
          notes: notes.trim() || undefined,
        }),
      });

      const createRoundPayload = (await createRoundResponse.json().catch(() => null)) as
        | { round?: { id?: string }; error?: string }
        | null;

      if (!createRoundResponse.ok || !createRoundPayload?.round?.id) {
        throw new Error(createRoundPayload?.error || "Failed to create interview round");
      }

      setMessage("Interview added successfully. Refreshing dashboard...");
      resetForm();

      window.setTimeout(() => {
        window.location.reload();
      }, 700);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Failed to add interview");
    } finally {
      setSaving(false);
    }
  };

  return (
    <article className="mt-8 overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-sm">
      <button
        type="button"
        onClick={() => setIsOpen((value) => !value)}
        className="flex w-full items-center justify-between px-6 py-4 transition-colors hover:bg-[var(--surface-alt)]/20"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--accent)]/10 text-[var(--accent)]">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </div>
          <div className="text-left">
            <h2 className="text-sm font-bold text-[var(--foreground)]">Add interview manually</h2>
            <p className="text-xs text-black/50">Missing an invite? Record the details here.</p>
          </div>
        </div>
        <div className={`transform transition-transform ${isOpen ? "rotate-180" : ""}`}>
          <svg className="h-5 w-5 text-black/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {isOpen ? (
        <form className="border-t border-[var(--border)]/60 bg-[var(--surface-alt)]/10 px-6 py-6" onSubmit={onSubmit}>
          <div className="grid gap-5 md:grid-cols-2">
            <label className="text-xs font-bold uppercase tracking-wider text-black/60">
              <span className="mb-2 block">Company</span>
              <input
                className="w-full rounded-xl border border-[var(--border)] bg-white px-4 py-2.5 text-sm font-medium outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]"
                value={company}
                onChange={(event) => setCompany(event.target.value)}
                placeholder="e.g. DeltaX"
              />
            </label>

            <label className="text-xs font-bold uppercase tracking-wider text-black/60">
              <span className="mb-2 block">Role</span>
              <input
                className="w-full rounded-xl border border-[var(--border)] bg-white px-4 py-2.5 text-sm font-medium outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]"
                value={role}
                onChange={(event) => setRole(event.target.value)}
                placeholder="e.g. Product Engineer"
              />
            </label>

            <label className="text-xs font-bold uppercase tracking-wider text-black/60">
              <span className="mb-2 block">Round Type</span>
              <select
                className="w-full rounded-xl border border-[var(--border)] bg-white px-4 py-2.5 text-sm font-medium outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]"
                value={roundType}
                onChange={(event) => setRoundType(event.target.value as (typeof roundTypes)[number])}
              >
                {roundTypes.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-xs font-bold uppercase tracking-wider text-black/60">
              <span className="mb-2 block">Initial Status</span>
              <select
                className="w-full rounded-xl border border-[var(--border)] bg-white px-4 py-2.5 text-sm font-medium outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]"
                value={status}
                onChange={(event) => setStatus(event.target.value as (typeof roundStatuses)[number])}
              >
                {roundStatuses.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-xs font-bold uppercase tracking-wider text-black/60">
              <span className="mb-2 block">Interview Date & Time</span>
              <input
                className="w-full rounded-xl border border-[var(--border)] bg-white px-4 py-2.5 text-sm font-medium outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]"
                type="datetime-local"
                value={scheduledStartLocal}
                onChange={(event) => setScheduledStartLocal(event.target.value)}
              />
            </label>

            <label className="text-xs font-bold uppercase tracking-wider text-black/60">
              <span className="mb-2 block">Organizer Email</span>
              <input
                className="w-full rounded-xl border border-[var(--border)] bg-white px-4 py-2.5 text-sm font-medium outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]"
                type="email"
                value={organizerEmail}
                onChange={(event) => setOrganizerEmail(event.target.value)}
                placeholder="recruiter@company.com"
              />
            </label>

            <label className="text-xs font-bold uppercase tracking-wider text-black/60 md:col-span-2">
              <span className="mb-2 block">Attendees (Comma separated)</span>
              <input
                className="w-full rounded-xl border border-[var(--border)] bg-white px-4 py-2.5 text-sm font-medium outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]"
                value={attendeesCsv}
                onChange={(event) => setAttendeesCsv(event.target.value)}
                placeholder="interviewer1@company.com, person2@company.com"
              />
            </label>

            <label className="text-xs font-bold uppercase tracking-wider text-black/60 md:col-span-2">
              <span className="mb-2 block">Internal Notes</span>
              <textarea
                className="w-full rounded-xl border border-[var(--border)] bg-white px-4 py-2.5 text-sm font-medium outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]"
                rows={3}
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="What should you prepare for?"
              />
            </label>
          </div>

          <div className="mt-6 flex items-center gap-4">
            <button
              className="rounded-full bg-[var(--accent)] px-6 py-2.5 text-sm font-bold text-white hover:bg-[var(--accent-strong)] disabled:opacity-60 shadow-md shadow-[var(--accent)]/20 transition-all active:scale-95"
              type="submit"
              disabled={saving}
            >
              {saving ? "Creating..." : "Save Interview"}
            </button>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="text-sm font-bold text-black/40 hover:text-black/60"
            >
              Cancel
            </button>
          </div>

          {message ? (
            <div className="mt-4 rounded-lg bg-emerald-50 px-4 py-2 text-xs font-bold text-emerald-700 border border-emerald-100 italic">
              {message}
            </div>
          ) : null}
          {error ? (
            <div className="mt-4 rounded-lg bg-rose-50 px-4 py-2 text-xs font-bold text-rose-700 border border-rose-100 italic">
              {error}
            </div>
          ) : null}
        </form>
      ) : null}
    </article>
  );
}
