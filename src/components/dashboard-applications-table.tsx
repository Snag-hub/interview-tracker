"use client";

import Link from "next/link";
import { useState } from "react";

export type DashboardApplicationRow = {
  applicationId: string;
  relatedApplicationIds: string[];
  company: string;
  role: string;
  applicationStatus: string;
  currentStage: string;
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
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

export function DashboardApplicationsTable({ initialRows }: DashboardApplicationsTableProps) {
  const [rows, setRows] = useState(initialRows);
  const [editingApplicationId, setEditingApplicationId] = useState<string | null>(null);
  const [companyInput, setCompanyInput] = useState("");
  const [roleInput, setRoleInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [deletingApplicationId, setDeletingApplicationId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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
    <div className="mt-6 rounded-xl border border-[var(--border)] bg-[var(--surface)]">
      <div className="border-b border-[var(--border)] bg-[var(--surface-alt)] px-4 py-3 text-xs text-black/70">
        One row per application. Newest latest interview appears first.
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1280px] text-left text-sm whitespace-nowrap">
          <thead className="bg-[var(--surface-alt)] font-mono text-xs uppercase tracking-wider text-black/70">
            <tr>
              <th className="px-4 py-3">Company</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">App Status</th>
              <th className="px-4 py-3">Stage</th>
              <th className="px-4 py-3">Latest Round</th>
              <th className="px-4 py-3">Round Status</th>
              <th className="px-4 py-3">Latest Interview (IST)</th>
              <th className="px-4 py-3">Rounds</th>
              <th className="sticky right-0 bg-[var(--surface-alt)] px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const isEditing = editingApplicationId === row.applicationId;

              return (
                <tr key={row.applicationId} className="border-t border-[var(--border)] even:bg-[var(--surface-alt)]/45">
                  <td className="px-4 py-3">
                    {isEditing ? (
                      <input
                        className="w-56 rounded-md border border-[var(--border)] bg-white px-2 py-1 text-sm"
                        value={companyInput}
                        onChange={(event) => setCompanyInput(event.target.value)}
                      />
                    ) : (
                      row.company
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {isEditing ? (
                      <input
                        className="w-72 rounded-md border border-[var(--border)] bg-white px-2 py-1 text-sm"
                        value={roleInput}
                        onChange={(event) => setRoleInput(event.target.value)}
                      />
                    ) : (
                      row.role
                    )}
                  </td>
                  <td className="px-4 py-3">{row.applicationStatus}</td>
                  <td className="px-4 py-3">{row.currentStage}</td>
                  <td className="px-4 py-3">{row.latestRoundType ?? "-"}</td>
                  <td className="px-4 py-3">{row.latestRoundStatus ?? "-"}</td>
                  <td className="px-4 py-3">{formatIstDate(row.latestRoundAt)}</td>
                  <td className="px-4 py-3">{row.totalRounds}</td>
                  <td className="sticky right-0 bg-[var(--surface)] px-4 py-3 even:bg-[var(--surface-alt)]/45">
                    {isEditing ? (
                      <div className="flex items-center gap-2">
                        <button
                          className="rounded-full bg-[var(--accent)] px-3 py-1 text-xs font-semibold text-white hover:bg-[var(--accent-strong)] disabled:opacity-60"
                          type="button"
                          disabled={saving}
                          onClick={saveEdit}
                        >
                          {saving ? "Saving..." : "Save"}
                        </button>
                        <button
                          className="rounded-full border border-[var(--border)] px-3 py-1 text-xs font-semibold"
                          type="button"
                          disabled={saving}
                          onClick={cancelEdit}
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <button
                          className="rounded-full bg-[var(--accent)] px-3 py-1 text-xs font-semibold text-white hover:bg-[var(--accent-strong)]"
                          type="button"
                          disabled={deletingApplicationId === row.applicationId}
                          onClick={() => startEdit(row.applicationId, row.company, row.role)}
                        >
                          Edit
                        </button>
                        <button
                          className="rounded-full border border-red-300 px-3 py-1 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-60"
                          type="button"
                          disabled={deletingApplicationId === row.applicationId}
                          onClick={() => deleteApplicationGroup(row.applicationId)}
                        >
                          {deletingApplicationId === row.applicationId ? "Deleting..." : "Delete"}
                        </button>
                        <Link
                          href={`/applications/${row.applicationId}?related=${encodeURIComponent(row.relatedApplicationIds.join(","))}`}
                          className="rounded-full border border-[var(--border)] px-3 py-1 text-xs font-semibold"
                        >
                          View Progress
                        </Link>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {errorMessage ? <p className="px-4 py-3 text-sm text-red-700">{errorMessage}</p> : null}
    </div>
  );
}
