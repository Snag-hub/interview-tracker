import { z } from "zod";
import { applicationStatuses, roundStatuses, stageTypes } from "@/lib/domain";

export const createApplicationSchema = z.object({
  company: z.string().trim().min(1).max(120),
  role: z.string().trim().min(1).max(120),
  applicationStatus: z.enum(applicationStatuses).optional(),
  currentStage: z.enum(stageTypes).optional(),
  appliedDate: z.string().date().optional(),
  jobPostingUrl: z.string().url().optional(),
  jdUrl: z.string().url().optional(),
  notes: z.string().max(2000).optional(),
});

export const updateApplicationSchema = createApplicationSchema.partial();

export const updateApplicationStatusSchema = z.object({
  applicationStatus: z.enum(applicationStatuses),
  currentStage: z.enum(stageTypes).optional(),
});

export const createRoundSchema = z.object({
  roundType: z.enum(["HR", "L1", "L2", "Managerial", "Final", "Other"]),
  scheduledStartUtc: z.string().datetime(),
  scheduledEndUtc: z.string().datetime().optional(),
  timezone: z.string().max(80).optional(),
  status: z.enum(roundStatuses).optional(),
  meetingLink: z.string().url().optional(),
  organizerEmail: z.string().email().optional(),
  attendeeEmails: z.array(z.string().email()).max(50).optional(),
  notes: z.string().max(2000).optional(),
});

export const updateRoundSchema = createRoundSchema.partial();
