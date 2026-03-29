"use client";

import { useState } from "react";

function getProgressMessage(elapsedSeconds: number): string {
  if (elapsedSeconds < 3) return "Fetching interview emails...";
  if (elapsedSeconds < 7) return "Parsing invite details...";
  return "Finalizing sync and updating dashboard...";
}

export function DashboardSyncButton() {
  const [isSyncing, setIsSyncing] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [reconnectRequired, setReconnectRequired] = useState(false);

  const onSync = async () => {
    setIsSyncing(true);
    setElapsedSeconds(0);
    setError(null);
    setReconnectRequired(false);

    const timer = setInterval(() => {
      setElapsedSeconds((value) => value + 1);
    }, 1000);

    try {
      const response = await fetch("/api/sync", { method: "POST" });
      const payload = (await response.json().catch(() => null)) as
        | { error?: string; code?: string }
        | null;

      if (!response.ok) {
        if (payload?.code === "GMAIL_RECONNECT_REQUIRED") {
          setReconnectRequired(true);
        }
        throw new Error(payload?.error || "Sync failed");
      }

      window.location.reload();
    } catch (syncError) {
      setError(syncError instanceof Error ? syncError.message : "Sync failed");
      setIsSyncing(false);
    } finally {
      clearInterval(timer);
      setElapsedSeconds(0);
    }
  };

  return (
    <div className="flex flex-col items-end">
      <button
        className="group relative flex items-center gap-2 overflow-hidden rounded-full bg-[var(--accent)] px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-[var(--accent)]/20 transition-all hover:bg-[var(--accent-strong)] hover:shadow-xl active:scale-95 disabled:opacity-60"
        type="button"
        disabled={isSyncing}
        onClick={onSync}
      >
        <span className={`${isSyncing ? "animate-spin" : "group-hover:rotate-180"} transition-transform duration-500`}>
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </span>
        {isSyncing ? "Syncing..." : "Sync Gmail"}
      </button>

      {isSyncing ? (
        <p className="mt-3 flex items-center justify-end gap-2 text-[10px] font-bold uppercase tracking-wider text-black/40">
          <span>
            {getProgressMessage(elapsedSeconds)} ({elapsedSeconds}s)
          </span>
        </p>
      ) : null}

      {error ? <p className="mt-2 text-xs font-bold text-rose-600">{error}</p> : null}
      {reconnectRequired ? (
        <div className="mt-2 rounded-lg bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-700 border border-amber-100">
          Reconnection required. <a className="underline font-bold" href="/api/gmail/connect">Connect Gmail</a>.
        </div>
      ) : null}
    </div>
  );
}
