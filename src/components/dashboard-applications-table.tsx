"use client";

import Link from "next/link";
import { useState, useMemo } from "react";

export type DashboardApplicationRow = {
  applicationId: string;
  relatedApplicationIds: string[];
  company: string;
  role: string;
  applicationStatus: string;
  currentStage: string;
  platform?: string | null;
  latestRoundType: string | null;
  latestRoundStatus: string | null;
  latestRoundAt: string | null;
  totalRounds: number;
};

type DashboardApplicationsTableProps = {
  initialRows: DashboardApplicationRow[];
};

function formatIstDate(value: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

function StatusBadge({ status }: { status: string | null }) {
  if (!status) return <span>-</span>;

  const s = status.toLowerCase();
  let base = "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ";

  if (s === "scheduled" || s === "interviewing" || s === "active") {
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

export function DashboardApplicationsTable({ initialRows }: DashboardApplicationsTableProps) {
  const [rows, setRows] = useState(initialRows);
  const [search, setSearch] = useState("");
  const [editingApplicationId, setEditingApplicationId] = useState<string | null>(null);
  const [companyInput, setCompanyInput] = useState("");
  const [roleInput, setRoleInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [deletingApplicationId, setDeletingApplicationId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const filteredRows = useMemo(() => {
    const query = search.toLowerCase().trim();
    if (!query) return rows;
    return rows.filter(
      (row) => row.company.toLowerCase().includes(query) || row.role.toLowerCase().includes(query),
    );
  }, [rows, search]);

  const startEdit = (applicationId: string, company: string, role: string) => {
    setEditingApplicationId(applicationId);
    setCompanyInput(company);
    setRoleInput(role);
    setErrorMessage(null);
  };

  const cancelEdit = () => {
    setEditingApplicationId(null);
    setCompanyInput("");
    setRoleInput("");
    setErrorMessage(null);
  };

  const saveEdit = async () => {
    if (!editingApplicationId) return;

    const company = companyInput.trim();
    const role = roleInput.trim();

    if (!company || !role) {
      setErrorMessage("Company and role are required.");
      return;
    }

    setSaving(true);
    setErrorMessage(null);

    try {
      const targetIds =
        rows.find((row) => row.applicationId === editingApplicationId)?.relatedApplicationIds ?? [editingApplicationId];

      for (const applicationId of targetIds) {
        const response = await fetch(`/api/applications/${applicationId}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ company, role }),
        });

        if (!response.ok) {
          const payload = (await response.json().catch(() => null)) as { error?: string } | null;
          throw new Error(payload?.error || "Failed to update application");
        }
      }

      setRows((currentRows) =>
        currentRows.map((row) =>
          row.applicationId === editingApplicationId ? { ...row, company, role } : row,
        ),
      );
      cancelEdit();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to update application");
    } finally {
      setSaving(false);
    }
  };

  const deleteApplicationGroup = async (applicationId: string) => {
    const targetRow = rows.find((row) => row.applicationId === applicationId);
    if (!targetRow) return;

    const confirmed = window.confirm(
      `Delete ${targetRow.company} - ${targetRow.role}? This will remove all linked interview rounds for this item.`,
    );
    if (!confirmed) return;

    setDeletingApplicationId(applicationId);
    setErrorMessage(null);

    try {
      for (const id of targetRow.relatedApplicationIds) {
        const response = await fetch(`/api/applications/${id}`, {
          method: "DELETE",
        });

        if (!response.ok) {
          const payload = (await response.json().catch(() => null)) as { error?: string } | null;
          throw new Error(payload?.error || "Failed to delete application");
        }
      }

      setRows((currentRows) => currentRows.filter((row) => row.applicationId !== applicationId));
      if (editingApplicationId === applicationId) {
        cancelEdit();
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to delete application");
    } finally {
      setDeletingApplicationId(null);
    }
  };

  return (
    <div className="mt-6 flex flex-col gap-4">
      <div className="relative max-w-sm">
        <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-black/40">
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </span>
        <input
          type="text"
          placeholder="Filter by company or role..."
          className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] py-2 pl-10 pr-4 text-sm focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>

      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1280px] text-left text-sm whitespace-nowrap">
            <thead>
              <tr className="border-b border-[var(--border)] bg-[var(--surface-alt)]/30 font-mono text-[10px] uppercase tracking-wider text-black/50">
                <th className="px-6 py-4 font-semibold">Company & Role</th>
                <th className="px-6 py-4 font-semibold text-center">App Status</th>
                <th className="px-6 py-4 font-semibold text-center">Platform</th>
                <th className="px-6 py-4 font-semibold text-center">Stage</th>
                <th className="px-6 py-4 font-semibold">Latest Round</th>
                <th className="px-6 py-4 font-semibold text-center">Round Status</th>
                <th className="px-6 py-4 font-semibold">Latest Interview (IST)</th>
                <th className="px-6 py-4 font-semibold text-center">Rounds</th>
                <th className="sticky right-0 bg-[var(--surface-alt)]/30 px-6 py-4 font-semibold text-center backdrop-blur">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]/60">
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-black/40 italic">
                    {search ? `No results found for "${search}"` : "No applications tracked yet."}
                  </td>
                </tr>
              ) : (
                filteredRows.map((row) => {
                  const isEditing = editingApplicationId === row.applicationId;

                  return (
                    <tr key={row.applicationId} className="group hover:bg-[var(--surface-alt)]/20 transition-colors">
                      <td className="px-6 py-4">
                        {isEditing ? (
                          <div className="flex flex-col gap-2">
                            <input
                              className="w-56 rounded-md border border-[var(--border)] bg-white px-2 py-1 text-sm focus:border-[var(--accent)] outline-none"
                              value={companyInput}
                              onChange={(event) => setCompanyInput(event.target.value)}
                              placeholder="Company"
                            />
                            <input
                              className="w-72 rounded-md border border-[var(--border)] bg-white px-2 py-1 text-sm focus:border-[var(--accent)] outline-none"
                              value={roleInput}
                              onChange={(event) => setRoleInput(event.target.value)}
                              placeholder="Role"
                            />
                          </div>
                        ) : (
                          <div className="flex flex-col">
                            <span className="text-base font-bold text-[var(--foreground)]">{row.company}</span>
                            <span className="text-xs text-black/60 font-medium tracking-tight">{row.role}</span>
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <StatusBadge status={row.applicationStatus} />
                      </td>
                      <td className="px-6 py-4 text-center">
                        {row.platform ? (
                          <span className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 text-[10px] font-bold uppercase border border-blue-100">
                            {row.platform}
                          </span>
                        ) : (
                          <span className="text-black/20">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[10px] font-bold uppercase border border-slate-200">
                          {row.currentStage}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-medium text-black/80">{row.latestRoundType ?? "-"}</td>
                      <td className="px-6 py-4 text-center">
                        <StatusBadge status={row.latestRoundStatus} />
                      </td>
                      <td className="px-6 py-4 font-mono text-xs text-black/60">{formatIstDate(row.latestRoundAt)}</td>
                      <td className="px-6 py-4 text-center">
                        <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-[var(--surface-alt)] text-[10px] font-bold border border-[var(--border)]">
                          {row.totalRounds}
                        </span>
                      </td>
                      <td className="sticky right-0 bg-[var(--surface)] group-hover:bg-[#fdfbf6] px-6 py-4 transition-colors">
                        {isEditing ? (
                          <div className="flex items-center justify-center gap-2">
                            <button
                              className="rounded-full bg-[var(--accent)] px-3 py-1 text-xs font-semibold text-white hover:bg-[var(--accent-strong)] disabled:opacity-60 shadow-sm"
                              type="button"
                              disabled={saving}
                              onClick={saveEdit}
                            >
                              {saving ? "Saving..." : "Save"}
                            </button>
                            <button
                              className="rounded-full border border-[var(--border)] bg-white px-3 py-1 text-xs font-semibold hover:bg-slate-50 disabled:opacity-60"
                              type="button"
                              disabled={saving}
                              onClick={cancelEdit}
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-center gap-2">
                            <button
                              className="rounded-full bg-[var(--accent)]/10 text-[var(--accent)] px-3 py-1 text-xs font-bold hover:bg-[var(--accent)] hover:text-white transition-all"
                              type="button"
                              disabled={deletingApplicationId === row.applicationId}
                              onClick={() => startEdit(row.applicationId, row.company, row.role)}
                            >
                              Edit
                            </button>
                            <Link
                              href={`/applications/${row.applicationId}?related=${encodeURIComponent(row.relatedApplicationIds.join(","))}`}
                              className="rounded-full bg-slate-100 text-slate-700 px-3 py-1 text-xs font-bold hover:bg-slate-200 transition-all border border-slate-200"
                            >
                              Details
                            </Link>
                            <button
                              className="rounded-full text-rose-600 p-1.5 hover:bg-rose-50 transition-all opacity-0 group-hover:opacity-100"
                              title="Delete group"
                              type="button"
                              disabled={deletingApplicationId === row.applicationId}
                              onClick={() => deleteApplicationGroup(row.applicationId)}
                            >
                              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        {errorMessage ? (
          <div className="px-6 py-3 border-t border-red-100 bg-red-50 text-xs text-red-700 font-medium">
            {errorMessage}
          </div>
        ) : null}
      </div>
    </div>
  );
}
