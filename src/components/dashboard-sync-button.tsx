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

  const onSync = async () => {
    setIsSyncing(true);
    setElapsedSeconds(0);
    setError(null);

    const timer = setInterval(() => {
      setElapsedSeconds((value) => value + 1);
    }, 1000);

    try {
      const response = await fetch("/api/sync", { method: "POST" });
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;

      if (!response.ok) {
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
    <div className="text-right">
      <button
        className="rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
        type="button"
        disabled={isSyncing}
        onClick={onSync}
      >
        {isSyncing ? "Syncing..." : "Sync now"}
      </button>

      {isSyncing ? (
        <p className="mt-2 flex items-center justify-end gap-2 text-xs text-black/70">
          <span className="h-3 w-3 animate-spin rounded-full border-2 border-black/25 border-t-[var(--accent)]" />
          <span>
            {getProgressMessage(elapsedSeconds)} ({elapsedSeconds}s)
          </span>
        </p>
      ) : null}

      {error ? <p className="mt-2 text-xs text-red-700">{error}</p> : null}
    </div>
  );
}
