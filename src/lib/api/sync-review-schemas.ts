import { z } from "zod";

export const syncReviewStatusSchema = z.enum(["pending", "applied", "dismissed"]);
export const syncReviewScopeSchema = z.enum([
  "single",
  "thread",
  "signature",
  "thread+signature",
  "thread+signature+company",
]);

export const updateSyncReviewItemSchema = z
  .object({
    action: z.enum(["apply", "dismiss"]),
    company: z.string().trim().min(1).max(120).optional(),
    role: z.string().trim().min(1).max(160).optional(),
    scope: syncReviewScopeSchema.optional(),
  })
  .superRefine((value, context) => {
    if (value.action === "apply") {
      if (!value.company) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["company"],
          message: "Company is required when applying a review item.",
        });
      }

      if (!value.role) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["role"],
          message: "Role is required when applying a review item.",
        });
      }
    }
  });
