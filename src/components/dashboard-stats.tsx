"use client";

import { useMemo } from "react";

type DashboardStatsProps = {
  totalApplications: number;
  upcomingInterviews: number;
  interviewsThisWeek: number;
  offersCount: number;
};

export function DashboardStats({
  totalApplications,
  upcomingInterviews,
  interviewsThisWeek,
  offersCount,
}: DashboardStatsProps) {
  const stats = useMemo(
    () => [
      {
        label: "Total Applications",
        value: totalApplications,
        description: "Active & tracked applications",
        color: "text-blue-700",
        bg: "bg-blue-50",
      },
      {
        label: "Upcoming Interviews",
        value: upcomingInterviews,
        description: "Scheduled for the future",
        color: "text-emerald-700",
        bg: "bg-emerald-50",
      },
      {
        label: "Interviews this Week",
        value: interviewsThisWeek,
        description: "Your current focus",
        color: "text-amber-700",
        bg: "bg-amber-50",
      },
      {
        label: "Offers Received",
        value: offersCount,
        description: "Goals achieved",
        color: "text-purple-700",
        bg: "bg-purple-50",
      },
    ],
    [totalApplications, upcomingInterviews, interviewsThisWeek, offersCount],
  );

  return (
    <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {stats.map((stat) => (
        <div
          key={stat.label}
          className="flex flex-col justify-between rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm transition-all hover:shadow-md"
        >
          <div>
            <p className="font-mono text-[10px] uppercase tracking-wider text-black/50">
              {stat.label}
            </p>
            <h3 className={`mt-1 text-3xl font-bold tracking-tight ${stat.color}`}>
              {stat.value}
            </h3>
          </div>
          <p className="mt-4 text-xs text-black/60">{stat.description}</p>
        </div>
      ))}
    </div>
  );
}
