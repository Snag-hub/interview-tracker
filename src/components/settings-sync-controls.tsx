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
  if (elapsedSeconds < 3) return "Scanning Gmail inbox...";
  if (elapsedSeconds < 7) return "Extracting invite metadata...";
  return "Gemini AI is normalizing details...";
}

export function SettingsSyncControls({ hasGmailAccount }: SettingsSyncControlsProps) {
  const storageKey = "sync.fromDate";
  const [isSyncing, setIsSyncing] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [reconnectRequired, setReconnectRequired] = useState(false);
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
    setReconnectRequired(false);
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
            code?: string;
            error?: string;
          }
        | null;

      if (!response.ok) {
        if (payload?.code === "GMAIL_RECONNECT_REQUIRED") {
          setReconnectRequired(true);
        }
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
    <div className="mt-8 space-y-6">
      <div className="flex flex-col gap-1.5">
         <span className="text-[10px] font-bold uppercase tracking-wider text-black/40">Sync History Threshold</span>
         <div className="flex flex-wrap items-center gap-4">
            <input
              className="rounded-xl border border-[var(--border)] bg-white px-4 py-2 text-sm font-bold outline-none focus:border-[var(--accent)]"
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
            <p className="text-[11px] text-black/50 leading-relaxed max-w-xs font-medium">
               Sync will only scan emails received after this date. 
               <span className="block italic opacity-70 mt-0.5">Note: Manual overrides take precedence.</span>
            </p>
         </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          className="group flex items-center gap-2 rounded-full bg-[var(--accent)] px-6 py-2.5 text-[11px] font-bold uppercase tracking-widest text-white shadow-lg shadow-[var(--accent)]/10 transition-all hover:bg-[var(--accent-strong)] disabled:opacity-60 active:scale-95"
          type="button"
          disabled={isSyncing || !hasGmailAccount}
          onClick={() => runSync(false)}
        >
          <svg className={`h-3.5 w-3.5 ${isSyncing ? "animate-spin" : "group-hover:rotate-180 transition-transform duration-500"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
             <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          {isSyncing ? "Running..." : "Run Incremental Sync"}
        </button>
        <button
          className="rounded-full border border-[var(--border)] bg-white px-6 py-2.5 text-[11px] font-bold uppercase tracking-widest text-black/50 transition-all hover:bg-slate-50 disabled:opacity-60 active:scale-95"
          type="button"
          disabled={isSyncing || !hasGmailAccount}
          onClick={() => runSync(true)}
        >
          Full historical sync
        </button>
      </div>

      {isSyncing && (
        <div className="flex items-center gap-3 rounded-2xl bg-[var(--surface-alt)]/20 border border-[var(--border)]/30 px-4 py-3">
          <span className="flex h-5 w-5 animate-spin rounded-full border-2 border-black/10 border-t-[var(--accent)]" />
          <div className="flex flex-col">
            <span className="text-[11px] font-bold text-black/80">{progressMessage}</span>
            <span className="text-[9px] font-bold text-black/30 uppercase tracking-widest mt-0.5">Elapsed: {elapsedSeconds}s</span>
          </div>
        </div>
      )}

      {syncResult && (
        <div className="rounded-2xl border border-emerald-100 bg-emerald-50/50 p-4">
           <p className="text-[11px] font-bold text-emerald-800 uppercase tracking-widest mb-3 flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Sync {syncResult.status}
           </p>
           <div className="grid grid-cols-2 sm:grid-cols-4 gap-y-4 gap-x-6">
              {[
                { label: "Fetched", value: syncResult.fetchedCount },
                { label: "Created", value: syncResult.createdCount },
                { label: "Updated", value: syncResult.updatedCount },
                { label: "Failed", value: syncResult.failedCount },
              ].map((stat) => (
                <div key={stat.label}>
                  <p className="text-[9px] font-bold uppercase tracking-widest text-black/30 mb-0.5">{stat.label}</p>
                  <p className="text-sm font-bold text-black/70">{stat.value}</p>
                </div>
              ))}
           </div>
           <p className="mt-4 pt-3 border-t border-emerald-100 text-[10px] font-bold text-emerald-700/60 uppercase tracking-wider">
              Gemini AI processed {syncResult.parsedCount} invites using {syncResult.aiCallsUsed} requests.
           </p>
        </div>
      )}

      {syncError && (
        <div className="rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3">
          <p className="text-xs font-bold text-rose-700 italic flex items-center gap-2">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Error: {syncError}
          </p>
        </div>
      )}

      {reconnectRequired && (
        <div className="rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3">
           <p className="text-xs font-bold text-amber-800 flex items-center gap-2">
            Gmail needs reconnection. <a className="underline hover:text-amber-950" href="/api/gmail/connect">Re-authorize here</a>.
          </p>
        </div>
      )}
    </div>
  );
}
