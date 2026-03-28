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
    <article className="mt-6 rounded-xl border border-[var(--border)] p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Add interview manually</h2>
          <p className="mt-1 text-sm text-black/70">
            Add company, role, and round details directly when an interview is missing from sync.
          </p>
        </div>
        <button
          className="rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--accent-strong)]"
          type="button"
          onClick={() => setIsOpen((value) => !value)}
        >
          {isOpen ? "Hide form" : "Add interview"}
        </button>
      </div>

      {isOpen ? (
        <form className="mt-3 grid gap-3 md:grid-cols-2" onSubmit={onSubmit}>
        <label className="text-sm">
          <span className="mb-1 block text-black/70">Company</span>
          <input
            className="w-full rounded-md border border-[var(--border)] bg-white px-3 py-2"
            value={company}
            onChange={(event) => setCompany(event.target.value)}
            placeholder="e.g. DeltaX"
          />
        </label>

        <label className="text-sm">
          <span className="mb-1 block text-black/70">Role</span>
          <input
            className="w-full rounded-md border border-[var(--border)] bg-white px-3 py-2"
            value={role}
            onChange={(event) => setRole(event.target.value)}
            placeholder="e.g. Product Engineer - .NET"
          />
        </label>

        <label className="text-sm">
          <span className="mb-1 block text-black/70">Round</span>
          <select
            className="w-full rounded-md border border-[var(--border)] bg-white px-3 py-2"
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

        <label className="text-sm">
          <span className="mb-1 block text-black/70">Round status</span>
          <select
            className="w-full rounded-md border border-[var(--border)] bg-white px-3 py-2"
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

        <label className="text-sm">
          <span className="mb-1 block text-black/70">Interview date/time</span>
          <input
            className="w-full rounded-md border border-[var(--border)] bg-white px-3 py-2"
            type="datetime-local"
            value={scheduledStartLocal}
            onChange={(event) => setScheduledStartLocal(event.target.value)}
          />
        </label>

        <label className="text-sm">
          <span className="mb-1 block text-black/70">Organizer email</span>
          <input
            className="w-full rounded-md border border-[var(--border)] bg-white px-3 py-2"
            type="email"
            value={organizerEmail}
            onChange={(event) => setOrganizerEmail(event.target.value)}
            placeholder="name@company.com"
          />
        </label>

        <label className="text-sm md:col-span-2">
          <span className="mb-1 block text-black/70">Attendee emails (comma separated)</span>
          <input
            className="w-full rounded-md border border-[var(--border)] bg-white px-3 py-2"
            value={attendeesCsv}
            onChange={(event) => setAttendeesCsv(event.target.value)}
            placeholder="a@company.com, b@company.com"
          />
        </label>

        <label className="text-sm md:col-span-2">
          <span className="mb-1 block text-black/70">Notes</span>
          <textarea
            className="w-full rounded-md border border-[var(--border)] bg-white px-3 py-2"
            rows={3}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Any notes about this interview"
          />
        </label>

        <div className="md:col-span-2">
          <button
            className="rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--accent-strong)] disabled:opacity-60"
            type="submit"
            disabled={saving}
          >
            {saving ? "Saving..." : "Add interview"}
          </button>
        </div>
        </form>
      ) : null}

      {message ? <p className="mt-3 text-sm text-emerald-700">{message}</p> : null}
      {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}
    </article>
  );
}
