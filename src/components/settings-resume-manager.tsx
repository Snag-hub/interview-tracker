"use client";

import { useState } from "react";

type ResumeVersion = {
  id: string;
  version_label: string;
  resume_url: string;
  is_default: boolean;
};

type ResumeManagerProps = {
  initialResumes: ResumeVersion[];
};

export function ResumeManager({ initialResumes }: ResumeManagerProps) {
  const [resumes, setResumes] = useState<ResumeVersion[]>(initialResumes);
  const [label, setLabel] = useState("");
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addResume = async () => {
    if (!label.trim() || !url.trim()) {
      setError("Label and URL are required.");
      return;
    }

    setBusy(true);
    setError(null);

    try {
      const response = await fetch("/api/resumes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ versionLabel: label, resumeUrl: url }),
      });

      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Failed to add resume");

      setResumes([payload.resume, ...resumes]);
      setLabel("");
      setUrl("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add resume");
    } finally {
      setBusy(false);
    }
  };

  const deleteResume = async (id: string) => {
    if (!window.confirm("Delete this resume version?")) return;

    setBusy(true);
    try {
      const response = await fetch(`/api/resumes/${id}`, { method: "DELETE" });
      if (!response.ok) throw new Error("Failed to delete");
      setResumes(resumes.filter((r) => r.id !== id));
    } catch (err) {
      setError("Failed to delete resume");
    } finally {
      setBusy(false);
    }
  };

  return (
    <article className="mt-8 rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-sm">
      <div className="flex items-center gap-3 mb-6">
        <div className="h-10 w-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-[var(--foreground)]">Resume Versions</h2>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 mb-8">
        {resumes.map((resume) => (
          <div key={resume.id} className="group flex flex-col rounded-2xl border border-[var(--border)]/60 bg-[var(--surface-alt)]/20 p-4 transition-all hover:border-[var(--accent)]/50">
            <div className="flex items-center justify-between mb-2">
               <h3 className="font-bold text-sm text-black/80">{resume.version_label}</h3>
               {resume.is_default && (
                 <span className="text-[8px] font-bold uppercase tracking-widest bg-[var(--accent)] text-white px-1.5 py-0.5 rounded-md">Default</span>
               )}
            </div>
            <a 
              className="text-xs text-black/40 truncate hover:text-[var(--accent)] hover:underline mb-4" 
              href={resume.resume_url} 
              target="_blank" 
              rel="noreferrer"
            >
              {resume.resume_url}
            </a>
            <div className="flex gap-2">
               <button 
                onClick={() => deleteResume(resume.id)}
                className="text-[10px] font-bold uppercase tracking-widest text-rose-600 hover:underline disabled:opacity-50"
                disabled={busy}
               >
                 Delete
               </button>
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border-2 border-dashed border-[var(--border)] p-6 bg-[var(--surface-alt)]/10">
        <h3 className="text-sm font-bold text-black/60 mb-4 uppercase tracking-wider">Add New Version</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <input
            className="rounded-xl border border-[var(--border)] bg-white px-4 py-2 text-sm focus:border-[var(--accent)] outline-none"
            placeholder="Label (e.g. Backend Resume)"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
          />
          <input
            className="rounded-xl border border-[var(--border)] bg-white px-4 py-2 text-sm focus:border-[var(--accent)] outline-none"
            placeholder="Shared Link (OneDrive, GDrive, etc.)"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
        </div>
        {error && <p className="mt-2 text-xs text-rose-600 font-bold">{error}</p>}
        <button
          onClick={addResume}
          disabled={busy}
          className="mt-4 rounded-full bg-[var(--accent)] px-6 py-2 text-xs font-bold text-white shadow-lg shadow-[var(--accent)]/10 hover:bg-[var(--accent-strong)] transition-all disabled:opacity-50"
        >
          {busy ? "Saving..." : "Save Resume Version"}
        </button>
      </div>
    </article>
  );
}
