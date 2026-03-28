"use client";

import { useState } from "react";

type SyncResult = {
  status: "success" | "partial" | "failed";
  fetchedCount: number;
  parsedCount: number;
  createdCount: number;
  updatedCount: number;
  failedCount: number;
  aiCallsUsed: number;
};

type SettingsSyncControlsProps = {
  hasGmailAccount: boolean;
};

function getProgressMessage(elapsedSeconds: number): string {
  if (elapsedSeconds < 3) return "Fetching interview emails...";
  if (elapsedSeconds < 7) return "Parsing invites and extracting details...";
  return "AI is verifying company and role names...";
}

export function SettingsSyncControls({ hasGmailAccount }: SettingsSyncControlsProps) {
  const storageKey = "sync.fromDate";
  const [isSyncing, setIsSyncing] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);
  const [fromDate, setFromDate] = useState(() => {
    if (typeof window === "undefined") return "";
    return window.localStorage.getItem(storageKey) ?? "";
  });

  const progressMessage = isSyncing ? getProgressMessage(elapsedSeconds) : null;

  const runSync = async (fullSync: boolean) => {
    setIsSyncing(true);
    setElapsedSeconds(0);
    setSyncError(null);
    setSyncResult(null);

    const timer = setInterval(() => {
      setElapsedSeconds((value) => value + 1);
    }, 1000);

    try {
      const params = new URLSearchParams();
      if (fullSync) params.set("full", "1");
      if (fromDate) {
        const localMidnightIso = new Date(`${fromDate}T00:00:00`).toISOString();
        params.set("from", localMidnightIso);
      }
      const endpoint = `/api/sync${params.toString() ? `?${params.toString()}` : ""}`;

      const response = await fetch(endpoint, {
        method: "POST",
      });

      const payload = (await response.json().catch(() => null)) as
        | {
            status?: "success" | "partial" | "failed";
            fetchedCount?: number;
            parsedCount?: number;
            createdCount?: number;
            updatedCount?: number;
            failedCount?: number;
            aiCallsUsed?: number;
            error?: string;
          }
        | null;

      if (!response.ok) {
        throw new Error(payload?.error || "Sync failed");
      }

      setSyncResult({
        status: payload?.status ?? "success",
        fetchedCount: payload?.fetchedCount ?? 0,
        parsedCount: payload?.parsedCount ?? 0,
        createdCount: payload?.createdCount ?? 0,
        updatedCount: payload?.updatedCount ?? 0,
        failedCount: payload?.failedCount ?? 0,
        aiCallsUsed: payload?.aiCallsUsed ?? 0,
      });
    } catch (error) {
      setSyncError(error instanceof Error ? error.message : "Sync failed");
    } finally {
      clearInterval(timer);
      setIsSyncing(false);
      setElapsedSeconds(0);
    }
  };

  return (
    <div className="mt-4">
      <label className="mb-3 block text-sm">
        <span className="mb-1 block text-black/70">Fetch emails from date</span>
        <input
          className="w-full max-w-xs rounded-md border border-[var(--border)] bg-white px-3 py-2"
          type="date"
          value={fromDate}
          onChange={(event) => {
            const nextValue = event.target.value;
            setFromDate(nextValue);
            if (typeof window !== "undefined") {
              if (nextValue) {
                window.localStorage.setItem(storageKey, nextValue);
              } else {
                window.localStorage.removeItem(storageKey);
              }
            }
          }}
        />
        <span className="mt-1 block text-xs text-black/60">
          Saved locally. Sync fetches emails from this date onward.
        </span>
      </label>

      <div className="flex flex-wrap gap-2">
        <button
          className="rounded-full border border-[var(--border)] px-4 py-2 text-sm font-semibold disabled:opacity-60"
          type="button"
          disabled={isSyncing || !hasGmailAccount}
          onClick={() => runSync(false)}
        >
          Sync now
        </button>
        <button
          className="rounded-full border border-[var(--border)] px-4 py-2 text-sm font-semibold disabled:opacity-60"
          type="button"
          disabled={isSyncing || !hasGmailAccount}
          onClick={() => runSync(true)}
        >
          Full sync
        </button>
      </div>

      {isSyncing ? (
        <div className="mt-3 flex items-center gap-2 text-sm text-black/75">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-black/30 border-t-[var(--accent)]" />
          <span>
            {progressMessage} ({elapsedSeconds}s)
          </span>
        </div>
      ) : null}

      {syncResult ? (
        <p className="mt-3 text-sm text-black/75">
          Sync {syncResult.status}. Fetched {syncResult.fetchedCount} | Parsed {syncResult.parsedCount} | Created {syncResult.createdCount} | Updated {syncResult.updatedCount} | Failed {syncResult.failedCount} | AI calls {syncResult.aiCallsUsed}
        </p>
      ) : null}

      {syncError ? <p className="mt-3 text-sm text-red-700">{syncError}</p> : null}
    </div>
  );
}
