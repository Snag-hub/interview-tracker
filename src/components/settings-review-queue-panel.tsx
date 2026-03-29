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
      "Apply correction to matching items? This updates linked applications and marks matching review items as applied.",
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
        `Applied to ${payload?.resolvedItems ?? 1} item(s).`,
      );
      window.setTimeout(() => setMessage(null), 3000);
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
    <article className="mt-8 rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-sm">
      <header className="flex flex-wrap items-center justify-between gap-4 mb-8">
        <div>
           <h2 className="text-xl font-bold text-[var(--foreground)]">Review Queue</h2>
           <p className="text-xs text-black/50">Verify AI extraction for ambiguous invites.</p>
        </div>
        <div className="flex items-center gap-1.5 p-1 rounded-full bg-[var(--surface-alt)]/30 border border-[var(--border)]/40">
          {(["pending", "applied", "dismissed"] as const).map((value) => (
            <button
              key={value}
              type="button"
              className={`rounded-full px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest transition-all ${
                status === value
                  ? "bg-[var(--accent)] text-white shadow-md shadow-[var(--accent)]/20"
                  : "text-black/40 hover:text-black/60"
              }`}
              onClick={() => setStatus(value)}
            >
              {value === "dismissed" ? "History" : value}
              <span className="ml-1 opacity-50">{counts[value]}</span>
            </button>
          ))}
        </div>
      </header>

      {loading && (
        <div className="flex items-center justify-center py-12">
           <span className="h-5 w-5 animate-spin rounded-full border-2 border-black/10 border-t-[var(--accent)]" />
        </div>
      )}
      
      {error && <div className="mb-4 rounded-xl bg-rose-50 border border-rose-100 px-4 py-2 text-xs font-bold text-rose-700 italic">{error}</div>}
      {message && <div className="mb-4 rounded-xl bg-emerald-50 border border-emerald-100 px-4 py-2 text-xs font-bold text-emerald-700 italic">{message}</div>}

      {!loading && items.length === 0 ? (
        <div className="py-12 flex flex-col items-center justify-center text-center">
           <div className="h-12 w-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-4 opacity-40">
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
           </div>
           <p className="text-sm font-medium text-black/30">Review queue is empty.</p>
        </div>
      ) : null}

      <div className="space-y-4">
        {items.map((item) => {
          const isSubmitting = submittingId === item.id;
          const draft = drafts[item.id] ?? {
            company: item.resolved_company ?? item.proposed_company,
            role: item.resolved_role ?? item.proposed_role,
          };

          const confidence = Number(item.confidence);
          const confidenceColor = confidence > 0.8 ? "text-emerald-600" : confidence > 0.5 ? "text-amber-600" : "text-rose-600";

          return (
            <article key={item.id} className="group rounded-2xl border border-[var(--border)]/60 bg-[var(--surface-alt)]/10 p-5 transition-all hover:bg-[var(--surface-alt)]/20">
              <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[var(--border)]/30 pb-4 mb-4">
                 <div className="flex-1">
                    <h3 className="text-sm font-bold text-black/80 line-clamp-1">{item.raw_subject}</h3>
                    <p className="text-[10px] font-medium text-black/40 mt-1 truncate">From: {item.raw_from}</p>
                 </div>
                 <div className="text-right">
                    <p className={`text-[10px] font-bold uppercase tracking-widest ${confidenceColor}`}>
                      {Math.round(confidence * 100)}% Confidence
                    </p>
                    <p className="text-[9px] font-bold text-black/30 mt-0.5 uppercase tracking-wider">{item.parser_source} engine</p>
                 </div>
              </div>

              {item.raw_snippet && (
                <div className="mb-6">
                   <p className="text-[11px] leading-relaxed text-black/60 italic line-clamp-2">
                     "{item.raw_snippet}"
                   </p>
                </div>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1.5 block text-[9px] font-bold uppercase tracking-wider text-black/40">Resolved Company</span>
                  <input
                    className="w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-xs font-bold outline-none focus:border-[var(--accent)]"
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
                <label className="block">
                  <span className="mb-1.5 block text-[9px] font-bold uppercase tracking-wider text-black/40">Resolved Role</span>
                  <input
                    className="w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-xs font-bold outline-none focus:border-[var(--accent)]"
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

              <div className="mt-6 flex flex-wrap items-center gap-3">
                {status === "pending" ? (
                  <>
                    <button
                      type="button"
                      className="rounded-full bg-[var(--accent)] px-5 py-2 text-[10px] font-bold uppercase tracking-widest text-white transition-all hover:bg-[var(--accent-strong)] disabled:opacity-60 shadow-lg shadow-[var(--accent)]/10"
                      disabled={isSubmitting}
                      onClick={() => applyItem(item)}
                    >
                      {isSubmitting ? "Applying..." : "Confirm Correction"}
                    </button>
                    <button
                      type="button"
                      className="rounded-full border border-[var(--border)] bg-white px-5 py-2 text-[10px] font-bold uppercase tracking-widest text-black/40 transition-all hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200"
                      disabled={isSubmitting}
                      onClick={() => dismissItem(item)}
                    >
                      Dismiss
                    </button>
                  </>
                ) : null}

                {item.application_id && (
                  <Link
                    href={`/applications/${item.application_id}`}
                    className="ml-auto flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-black/30 hover:text-[var(--accent)] transition-all"
                  >
                    View Timeline
                    <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                    </svg>
                  </Link>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </article>
  );
}
