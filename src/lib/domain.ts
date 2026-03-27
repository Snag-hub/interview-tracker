export const applicationStatuses = [
  "Applied",
  "Shortlisted",
  "Interviewing",
  "Offer",
  "Rejected",
  "OnHold",
] as const;

export const stageTypes = [
  "None",
  "HR",
  "L1",
  "L2",
  "Managerial",
  "Final",
] as const;

export const roundStatuses = [
  "Scheduled",
  "Completed",
  "Canceled",
  "Rescheduled",
  "NoShow",
] as const;

export type ApplicationStatus = (typeof applicationStatuses)[number];
export type StageType = (typeof stageTypes)[number];
export type RoundStatus = (typeof roundStatuses)[number];

export type DashboardRound = {
  id: string;
  company: string;
  role: string;
  roundType: Exclude<StageType, "None">;
  status: RoundStatus;
  scheduledStart: string;
  meetingLink?: string;
};
