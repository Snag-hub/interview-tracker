"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type ReviewStatus = "pending" | "applied" | "dismissed";

type ReviewItem = {
  id: string;
  created_at: string;
  source_email_id: string | null;
  source_thread_id: string | null;
  signature: string | null;
  application_id: string | null;
  raw_subject: string;
  raw_from: string | null;
  raw_snippet: string | null;
  proposed_company: string;
  proposed_role: string;
  parser_source: string;
  confidence: number;
  reason: string | null;
  review_status: ReviewStatus;
  resolved_company: string | null;
  resolved_role: string | null;
  resolved_at: string | null;
};

type DraftValues = {
  company: string;
  role: string;
};

type ReviewCounts = {
  pending: number;
  applied: number;
  dismissed: number;
};

export function SettingsReviewQueuePanel() {
  const [status, setStatus] = useState<ReviewStatus>("pending");
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [counts, setCounts] = useState<ReviewCounts>({ pending: 0, applied: 0, dismissed: 0 });
  const [drafts, setDrafts] = useState<Record<string, DraftValues>>({});
  const [loading, setLoading] = useState(false);
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/sync/review-items?status=${status}&limit=40`, {
          method: "GET",
        });

        const payload = (await response.json().catch(() => null)) as
          | { items?: ReviewItem[]; counts?: ReviewCounts; error?: string }
          | null;

        if (!response.ok) {
          throw new Error(payload?.error || "Failed to load review items");
        }

        if (cancelled) return;

        const nextItems = payload?.items ?? [];
        setCounts(payload?.counts ?? { pending: 0, applied: 0, dismissed: 0 });
        setItems(nextItems);
        setDrafts(
          Object.fromEntries(
            nextItems.map((item) => [
              item.id,
              {
                company: item.resolved_company ?? item.proposed_company,
                role: item.resolved_role ?? item.proposed_role,
              },
            ]),
          ),
        );
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Failed to load review items");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [status]);

  const applyItem = async (item: ReviewItem) => {
    const draft = drafts[item.id];
    if (!draft?.company.trim() || !draft?.role.trim()) {
      setError("Company and role are required to apply a review item.");
      return;
    }

    setSubmittingId(item.id);
    setError(null);
    setMessage(null);

    const confirmed = window.confirm(
      "Apply correction to matching items by thread + signature + same company? This updates linked applications and marks matching review items as applied.",
    );
    if (!confirmed) {
      setSubmittingId(null);
      return;
    }

    try {
      const response = await fetch(`/api/sync/review-items/${item.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "apply",
          company: draft.company.trim(),
          role: draft.role.trim(),
          scope: "thread+signature+company",
        }),
      });

      const payload = (await response.json().catch(() => null)) as
        | { error?: string; resolvedItems?: number; updatedApplications?: number }
        | null;
      if (!response.ok) {
        throw new Error(payload?.error || "Failed to apply review item");
      }

      setItems((current) => current.filter((currentItem) => currentItem.id !== item.id));
      setCounts((current) => ({
        ...current,
        pending: Math.max(0, current.pending - (payload?.resolvedItems ?? 1)),
        applied: current.applied + (payload?.resolvedItems ?? 1),
      }));
      setMessage(
        `Applied to ${payload?.resolvedItems ?? 1} review item(s) and ${payload?.updatedApplications ?? 0} application(s).`,
      );
    } catch (applyError) {
      setError(applyError instanceof Error ? applyError.message : "Failed to apply review item");
    } finally {
      setSubmittingId(null);
    }
  };

  const dismissItem = async (item: ReviewItem) => {
    setSubmittingId(item.id);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch(`/api/sync/review-items/${item.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action: "dismiss" }),
      });

      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        throw new Error(payload?.error || "Failed to dismiss review item");
      }

      setItems((current) => current.filter((currentItem) => currentItem.id !== item.id));
      setCounts((current) => ({
        ...current,
        pending: Math.max(0, current.pending - 1),
        dismissed: current.dismissed + 1,
      }));
    } catch (dismissError) {
      setError(dismissError instanceof Error ? dismissError.message : "Failed to dismiss review item");
    } finally {
      setSubmittingId(null);
    }
  };

  return (
    <article className="mt-4 rounded-xl border border-[var(--border)] p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">Needs Review</h2>
        <div className="flex items-center gap-2 text-xs">
          {(["pending", "applied", "dismissed"] as const).map((value) => (
            <button
              key={value}
              type="button"
              className={`rounded-full border px-3 py-1 font-semibold ${
                status === value
                  ? "border-[var(--accent)] bg-[var(--accent)] text-white"
                  : "border-[var(--border)] bg-white text-black/75"
              }`}
              onClick={() => setStatus(value)}
            >
              {value === "dismissed" ? "Audit" : value[0].toUpperCase() + value.slice(1)}
              {value === "pending" ? ` (${counts.pending})` : null}
              {value === "applied" ? ` (${counts.applied})` : null}
              {value === "dismissed" ? ` (${counts.dismissed})` : null}
            </button>
          ))}
        </div>
      </div>

      {loading ? <p className="mt-3 text-sm text-black/70">Loading review queue...</p> : null}
      {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}
      {message ? <p className="mt-3 text-sm text-emerald-700">{message}</p> : null}

      {!loading && items.length === 0 ? (
        <p className="mt-3 text-sm text-black/65">No review items in this filter.</p>
      ) : null}

      <ul className="mt-3 space-y-3 text-sm">
        {items.map((item) => {
          const isSubmitting = submittingId === item.id;
          const draft = drafts[item.id] ?? {
            company: item.resolved_company ?? item.proposed_company,
            role: item.resolved_role ?? item.proposed_role,
          };

          return (
            <li key={item.id} className="rounded-lg border border-[var(--border)] bg-[var(--surface-alt)] p-3">
              <p className="font-semibold">{item.raw_subject}</p>
              <p className="mt-1 text-xs text-black/70">From: {item.raw_from ?? "-"}</p>
              <p className="mt-1 text-xs text-black/70">
                Source: {item.parser_source} | Confidence: {Number(item.confidence).toFixed(2)}
                {item.reason ? ` | Reason: ${item.reason}` : ""}
              </p>
              {item.raw_snippet ? <p className="mt-2 text-xs text-black/70">{item.raw_snippet}</p> : null}

              <div className="mt-3 grid gap-2 md:grid-cols-2">
                <label className="text-xs">
                  <span className="mb-1 block text-black/70">Company</span>
                  <input
                    className="w-full rounded-md border border-[var(--border)] bg-white px-2 py-1 text-sm"
                    value={draft.company}
                    disabled={status !== "pending"}
                    onChange={(event) =>
                      setDrafts((current) => ({
                        ...current,
                        [item.id]: {
                          company: event.target.value,
                          role: current[item.id]?.role ?? draft.role,
                        },
                      }))
                    }
                  />
                </label>
                <label className="text-xs">
                  <span className="mb-1 block text-black/70">Role</span>
                  <input
                    className="w-full rounded-md border border-[var(--border)] bg-white px-2 py-1 text-sm"
                    value={draft.role}
                    disabled={status !== "pending"}
                    onChange={(event) =>
                      setDrafts((current) => ({
                        ...current,
                        [item.id]: {
                          company: current[item.id]?.company ?? draft.company,
                          role: event.target.value,
                        },
                      }))
                    }
                  />
                </label>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                {status === "pending" ? (
                  <>
                    <button
                      type="button"
                      className="rounded-full bg-[var(--accent)] px-3 py-1 text-xs font-semibold text-white disabled:opacity-60"
                      disabled={isSubmitting}
                      onClick={() => applyItem(item)}
                    >
                      {isSubmitting ? "Applying..." : "Apply (Thread + Signature)"}
                    </button>
                    <button
                      type="button"
                      className="rounded-full border border-[var(--border)] px-3 py-1 text-xs font-semibold"
                      disabled={isSubmitting}
                      onClick={() => dismissItem(item)}
                    >
                      Dismiss
                    </button>
                  </>
                ) : null}

                {item.application_id ? (
                  <Link
                    href={`/applications/${item.application_id}`}
                    className="rounded-full border border-[var(--border)] px-3 py-1 text-xs font-semibold"
                  >
                    Open Progress
                  </Link>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
    </article>
  );
}
