import { NextResponse } from "next/server";
import { google } from "googleapis";
import { serviceUnavailable, unauthorized } from "@/lib/api/responses";
import { extractCompanyRoleWithGemini } from "@/lib/ai/gemini";
import { getSessionUser } from "@/lib/auth/session-user";
import { decryptSecret } from "@/lib/crypto/secrets";
import { getGeminiEnv, hasEncryptionConfig, hasGeminiConfig, hasGoogleOAuthConfig } from "@/lib/env";
import { decodeBody, parseIcsContent, parseInvite, type ParsedIcs } from "@/lib/gmail/parser";
import { createGoogleOAuthClient } from "@/lib/gmail/oauth";
import { createSupabaseServerClient } from "@/lib/supabase/server-client";

type GmailPayload = {
  filename?: string;
  mimeType?: string;
  partId?: string;
  body?: { data?: string; attachmentId?: string };
  headers?: Array<{ name?: string; value?: string }>;
  parts?: Array<GmailPayload>;
};

type CachedResolution = {
  company: string;
  role: string;
  confidence: number;
};

const SYNC_QUERY =
  '(filename:ics OR "Microsoft Teams" OR "Join with Google Meet" OR "Web Conference") -subject:("walk in" OR "walk-in" OR walkin OR drive OR "hiring drive" OR "mega drive" OR "bulk hiring")';
const PARSER_RESOLUTIONS_TABLE = "parser_resolutions";
const SYNC_REVIEW_ITEMS_TABLE = "sync_review_items";
const conferenceLinkRegex = /(https?:\/\/[\w./?=&%-]*(teams\.microsoft\.com|meet\.google\.com)[\w./?=&%-]*)/i;

function parseHeaderDate(value: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function parseFromDate(value: string | null): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function getHeader(payload: GmailPayload | undefined, name: string) {
  const header = payload?.headers?.find((item) => item.name?.toLowerCase() === name.toLowerCase());
  return header?.value ?? "";
}

function collectBody(payload?: GmailPayload): string {
  if (!payload) return "";
  const inline = decodeBody(payload.body?.data);
  const partText = (payload.parts ?? []).map((part) => collectBody(part)).join("\n");
  return [inline, partText].filter(Boolean).join("\n");
}

function collectAttachmentParts(payload?: GmailPayload): GmailPayload[] {
  if (!payload) return [];

  const isCalendarPart =
    payload.mimeType?.toLowerCase() === "text/calendar" ||
    payload.filename?.toLowerCase().endsWith(".ics");

  const hasIcsData = Boolean(payload.body?.data || payload.body?.attachmentId);
  const current = isCalendarPart && hasIcsData ? [payload] : [];

  return [...current, ...(payload.parts ?? []).flatMap((part) => collectAttachmentParts(part))];
}

function hasConferenceSignal(subject: string, body: string, hasIcs: boolean): boolean {
  if (hasIcs) return true;

  const combined = `${subject}\n${body}`.toLowerCase();
  const hasConferenceKeyword =
    combined.includes("microsoft teams") ||
    combined.includes("join with google meet") ||
    combined.includes("web conference");

  if (!hasConferenceKeyword) return false;
  return conferenceLinkRegex.test(`${subject}\n${body}`);
}

function isReplyMessage(payload: GmailPayload | undefined, subject: string): boolean {
  const inReplyTo = getHeader(payload, "In-Reply-To");
  const references = getHeader(payload, "References");

  if (inReplyTo || references) return true;
  return /^\s*(re|fwd|fw)\s*:/i.test(subject);
}

function isMissingInterviewerColumns(message?: string | null) {
  if (!message) return false;
  return message.includes("organizer_email") || message.includes("attendee_emails");
}

function normalizeExtractionValue(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function isClearlyInvalidCompany(value: string): boolean {
  const company = normalizeExtractionValue(value);
  if (!company) return true;
  if (company === "unknown company") return true;
  if (/^(l\d+|hr|technical|online|f2f|round|interview)$/.test(company)) return true;
  if (/^\d+$/.test(company)) return true;
  if (/\b(am|pm|gmt|jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)\b/.test(company)) return true;
  if (/^\d{1,2}[./-]\d{1,2}[./-]\d{2,4}$/.test(company)) return true;
  return false;
}

function isClearlyInvalidRole(value: string): boolean {
  const role = normalizeExtractionValue(value);
  if (!role) return true;
  if (role === "unknown role") return true;
  if (/^\d+$/.test(role)) return true;
  if (/\b(am|pm|gmt)\b/.test(role)) return true;
  return false;
}

function shouldUseAiResult(
  parserCompany: string,
  parserRole: string,
  aiCompany: string,
  aiRole: string,
  aiConfidence: number,
): boolean {
  const parserCompanyInvalid = isClearlyInvalidCompany(parserCompany);
  const parserRoleInvalid = isClearlyInvalidRole(parserRole);
  const aiCompanyInvalid = isClearlyInvalidCompany(aiCompany);
  const aiRoleInvalid = isClearlyInvalidRole(aiRole);

  if (aiCompanyInvalid || aiRoleInvalid) return false;
  if ((parserCompanyInvalid || parserRoleInvalid) && !(aiCompanyInvalid || aiRoleInvalid)) {
    return true;
  }

  const sameCompany = normalizeExtractionValue(parserCompany) === normalizeExtractionValue(aiCompany);
  const sameRole = normalizeExtractionValue(parserRole) === normalizeExtractionValue(aiRole);

  if (sameCompany && sameRole) return false;
  return aiConfidence >= 0.75;
}

function isMissingParserResolutionsTable(message?: string | null): boolean {
  if (!message) return false;
  const normalized = message.toLowerCase();
  return normalized.includes(PARSER_RESOLUTIONS_TABLE) || normalized.includes("does not exist");
}

function isMissingSyncReviewItemsTable(message?: string | null): boolean {
  if (!message) return false;
  const normalized = message.toLowerCase();
  return normalized.includes(SYNC_REVIEW_ITEMS_TABLE) || normalized.includes("does not exist");
}

function getSyncErrorDetails(error: unknown): {
  message: string;
  statusCode: number;
  code?: string;
  reconnectRequired: boolean;
} {
  if (error instanceof Error) {
    const details = JSON.stringify(error);
    const combined = `${error.message} ${details}`.toLowerCase();
    const reconnectRequired =
      combined.includes("invalid_grant") ||
      combined.includes("token has been expired") ||
      combined.includes("invalid credentials") ||
      combined.includes("unauthorized_client") ||
      combined.includes("insufficient authentication scopes");

    if (reconnectRequired) {
      return {
        message: "Gmail authorization expired or revoked. Please reconnect Gmail from Settings and retry sync.",
        statusCode: 401,
        code: "GMAIL_RECONNECT_REQUIRED",
        reconnectRequired: true,
      };
    }

    return {
      message: error.message,
      statusCode: 500,
      reconnectRequired: false,
    };
  }

  return {
    message: "Sync failed",
    statusCode: 500,
    reconnectRequired: false,
  };
}

function getDomainFromHeader(fromHeader: string): string {
  return fromHeader.match(/@([a-z0-9.-]+\.[a-z]{2,})/i)?.[1]?.toLowerCase() ?? "";
}

function normalizeForSignature(value: string | null | undefined): string {
  if (!value) return "";
  return value
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/g, " ")
    .replace(/\d{1,2}[./-]\d{1,2}[./-]\d{2,4}/g, " #date ")
    .replace(/\b\d+\b/g, " # ")
    .replace(/[^a-z0-9# ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildResolutionSignature(
  subject: string,
  fromHeader: string,
  organizerEmail: string | null,
  icsSummary: string | null,
): string {
  const parts = [
    normalizeForSignature(subject),
    normalizeForSignature(icsSummary),
    normalizeForSignature(organizerEmail),
    normalizeForSignature(getDomainFromHeader(fromHeader)),
  ].filter(Boolean);

  return parts.join("|").slice(0, 400);
}

export async function POST(request: Request) {
  if (!hasGoogleOAuthConfig()) {
    return serviceUnavailable("Google OAuth is not configured.");
  }

  if (!hasEncryptionConfig()) {
    return serviceUnavailable("Encryption key is missing. Configure APP_ENCRYPTION_KEY.");
  }

  const user = await getSessionUser();
  if (!user) {
    return unauthorized();
  }

  const supabase = await createSupabaseServerClient();
  const { data: gmailAccount, error: gmailAccountError } = await supabase
    .from("gmail_accounts")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  if (gmailAccountError) {
    return NextResponse.json({ error: gmailAccountError.message }, { status: 500 });
  }

  if (!gmailAccount) {
    return NextResponse.json({ error: "Connect Gmail before syncing." }, { status: 400 });
  }

  let fetchedCount = 0;
  let parsedCount = 0;
  let createdCount = 0;
  let updatedCount = 0;
  let failedCount = 0;
  const geminiEnabled = hasGeminiConfig();
  const geminiEnv = geminiEnabled ? getGeminiEnv() : null;
  let geminiCallsUsed = 0;
  let parserResolutionTableAvailable = true;
  let syncReviewItemsTableAvailable = true;
  const resolutionCache = new Map<string, CachedResolution | null>();

  try {
    const oauthClient = createGoogleOAuthClient();
    oauthClient.setCredentials({
      refresh_token: decryptSecret(gmailAccount.refresh_token_encrypted),
      access_token: decryptSecret(gmailAccount.access_token_encrypted),
      expiry_date: gmailAccount.token_expiry ? Date.parse(gmailAccount.token_expiry) : undefined,
    });

    const gmail = google.gmail({ version: "v1", auth: oauthClient });

    const url = new URL(request.url);
    const fullSync = url.searchParams.get("full") === "1";
    const fromDate = parseFromDate(url.searchParams.get("from"));

    let query = SYNC_QUERY;
    if (fromDate) {
      const afterEpoch = Math.floor(fromDate.getTime() / 1000);
      query = `${query} after:${afterEpoch}`;
    } else if (gmailAccount.last_sync_at && !fullSync) {
      const afterEpoch = Math.floor(Date.parse(gmailAccount.last_sync_at) / 1000);
      query = `${query} after:${afterEpoch}`;
    }

    const messageIds: Array<{ id?: string | null }> = [];
    let pageToken: string | undefined;

    while (messageIds.length < 300) {
      const listResponse = await gmail.users.messages.list({
        userId: "me",
        maxResults: 50,
        q: query,
        pageToken,
      });

      messageIds.push(...(listResponse.data.messages ?? []));
      pageToken = listResponse.data.nextPageToken ?? undefined;

      if (!pageToken) {
        break;
      }
    }

    for (const messageRef of messageIds) {
      if (!messageRef.id) {
        continue;
      }

      // Check if this email is in the exclusions list
      const { data: isExcluded } = await supabase
        .from("sync_exclusions")
        .select("id")
        .eq("user_id", user.id)
        .eq("source_email_id", messageRef.id)
        .maybeSingle();

      if (isExcluded) {
        continue;
      }

      fetchedCount += 1;

      const messageResponse = await gmail.users.messages.get({
        userId: "me",
        id: messageRef.id,
        format: "full",
      });

      const message = messageResponse.data;
      const payload = message.payload as GmailPayload | undefined;
      const subject = getHeader(payload, "Subject") || "Interview Update";
      const fromHeader = getHeader(payload, "From");
      if (isReplyMessage(payload, subject)) {
        continue;
      }

      const fallbackDate =
        parseHeaderDate(getHeader(payload, "Date")) ||
        (message.internalDate ? new Date(Number(message.internalDate)).toISOString() : null) ||
        new Date().toISOString();
      const body = `${message.snippet ?? ""}\n${collectBody(payload)}`;

      const icsParts = collectAttachmentParts(payload);
      let icsData: ParsedIcs | null = null;

      for (const part of icsParts) {
        let encoded = part.body?.data;

        if (!encoded && part.body?.attachmentId) {
          const attachmentResponse = await gmail.users.messages.attachments.get({
            userId: "me",
            messageId: messageRef.id,
            id: part.body.attachmentId,
          });

          encoded = attachmentResponse.data.data ?? undefined;
        }

        if (!encoded) {
          continue;
        }

        const rawIcs = decodeBody(encoded);
        const parsedIcs = parseIcsContent(rawIcs);
        if (parsedIcs) {
          icsData = parsedIcs;
          break;
        }
      }

      const parsed = parseInvite(subject, body, fromHeader, fallbackDate, icsData);
      parsedCount += 1;
      const signature = buildResolutionSignature(
        subject,
        fromHeader,
        icsData?.organizerEmail ?? null,
        icsData?.summary ?? null,
      );

      const parserCompanyBeforeAi = parsed.company;
      const parserRoleBeforeAi = parsed.role;
      const parserInvalidBeforeAi =
        isClearlyInvalidCompany(parserCompanyBeforeAi) || isClearlyInvalidRole(parserRoleBeforeAi);
      let aiUsed = false;
      let aiChosen = false;
      let aiConfidence = 0;
      let disagreement = false;
      let parserSource: "rule" | "gemini" | "fallback" = "rule";
      const reviewReasons: string[] = [];

      const conferenceSignal = hasConferenceSignal(subject, body, Boolean(icsData));
      if (!conferenceSignal) {
        continue;
      }

      if (geminiEnabled) {
        let aiResult: CachedResolution | null | undefined = resolutionCache.get(signature);

        if (aiResult === undefined) {
          aiResult = null;

          if (parserResolutionTableAvailable) {
            const storedResolutionResult = await supabase
              .from(PARSER_RESOLUTIONS_TABLE)
              .select("company, role, confidence")
              .eq("user_id", user.id)
              .eq("signature", signature)
              .maybeSingle();

            if (storedResolutionResult.error) {
              if (isMissingParserResolutionsTable(storedResolutionResult.error.message)) {
                parserResolutionTableAvailable = false;
              }
            } else if (storedResolutionResult.data) {
              aiResult = {
                company: storedResolutionResult.data.company,
                role: storedResolutionResult.data.role,
                confidence: Number(storedResolutionResult.data.confidence ?? 0),
              };
            }
          }

          const maxCalls = geminiEnv?.maxCallsPerSync ?? 5;
          if (!aiResult && geminiCallsUsed < maxCalls) {
            geminiCallsUsed += 1;

            const extracted = await extractCompanyRoleWithGemini({
              subject,
              bodySnippet: body.slice(0, 700),
              fromHeader,
              organizerEmail: icsData?.organizerEmail ?? null,
              icsSummary: icsData?.summary ?? null,
              icsLocation: icsData?.location ?? null,
              icsStatus: icsData?.status ?? null,
            });

            if (extracted) {
              aiResult = {
                company: extracted.company,
                role: extracted.role,
                confidence: extracted.confidence,
              };

              if (parserResolutionTableAvailable) {
                const upsertResolutionResult = await supabase.from(PARSER_RESOLUTIONS_TABLE).upsert(
                  {
                    user_id: user.id,
                    signature,
                    company: extracted.company,
                    role: extracted.role,
                    confidence: extracted.confidence,
                    source: "gemini",
                    last_used_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                  },
                  { onConflict: "user_id,signature" },
                );

                if (upsertResolutionResult.error && isMissingParserResolutionsTable(upsertResolutionResult.error.message)) {
                  parserResolutionTableAvailable = false;
                }
              }
            }
          }

          resolutionCache.set(signature, aiResult);
        }

        if (aiResult) {
          aiUsed = true;
          aiConfidence = aiResult.confidence;
          disagreement =
            normalizeExtractionValue(parserCompanyBeforeAi) !== normalizeExtractionValue(aiResult.company) ||
            normalizeExtractionValue(parserRoleBeforeAi) !== normalizeExtractionValue(aiResult.role);
        }

        if (
          aiResult &&
          shouldUseAiResult(parsed.company, parsed.role, aiResult.company, aiResult.role, aiResult.confidence)
        ) {
          parsed.company = aiResult.company;
          parsed.role = aiResult.role;
          aiChosen = true;
          parserSource = "gemini";
        }
      }

      if (parserInvalidBeforeAi && !aiChosen) {
        parserSource = "fallback";
      }

      if (parserInvalidBeforeAi) {
        reviewReasons.push("parser_invalid");
      }
      if (disagreement) {
        reviewReasons.push("parser_ai_disagreement");
      }

      const scheduledDate = new Date(parsed.scheduledAt);
      const invalidDate = Number.isNaN(scheduledDate.getTime()) || scheduledDate.getUTCFullYear() < 2000;
      if (invalidDate) {
        parsed.scheduledAt = fallbackDate;
      }

      if (parsed.company === "Unknown Company" && parsed.role === "Unknown Role") {
        if (syncReviewItemsTableAvailable) {
          const reviewInsert = await supabase.from(SYNC_REVIEW_ITEMS_TABLE).insert({
            user_id: user.id,
            source_email_id: message.id,
            source_thread_id: message.threadId,
            signature,
            raw_subject: subject,
            raw_from: fromHeader,
            raw_snippet: body.slice(0, 500),
            proposed_company: parsed.company,
            proposed_role: parsed.role,
            proposed_round_type: parsed.roundType,
            proposed_status: parsed.status,
            parser_source: parserSource,
            confidence: aiChosen ? aiConfidence : parserInvalidBeforeAi ? 0.45 : 0.8,
            reason: [...reviewReasons, "unknown_values"].join(", "),
            ai_used: aiUsed,
            review_status: "pending",
          });

          if (reviewInsert.error && isMissingSyncReviewItemsTable(reviewInsert.error.message)) {
            syncReviewItemsTableAvailable = false;
          }
        }

        failedCount += 1;
        continue;
      }

      const { data: existingByEmail, error: existingByEmailError } = await supabase
        .from("interview_rounds")
        .select("id, source_thread_id, scheduled_start_utc")
        .eq("source_email_id", message.id)
        .maybeSingle();

      if (existingByEmailError) {
        failedCount += 1;
        continue;
      }

      if (existingByEmail) {
        updatedCount += 1;
        continue;
      }

      const { data: existingByThreadTime } = await supabase
        .from("interview_rounds")
        .select("id")
        .eq("source_thread_id", message.threadId)
        .eq("scheduled_start_utc", parsed.scheduledAt)
        .maybeSingle();

      if (existingByThreadTime) {
        updatedCount += 1;
        continue;
      }

      const { data: existingApplication } = await supabase
        .from("job_applications")
        .select("id")
        .eq("user_id", user.id)
        .eq("company", parsed.company)
        .eq("role", parsed.role)
        .maybeSingle();

      let applicationId = existingApplication?.id;

      if (!applicationId) {
        const { data: newApplication, error: newApplicationError } = await supabase
          .from("job_applications")
          .insert({
            user_id: user.id,
            company: parsed.company,
            role: parsed.role,
            application_status: "Interviewing",
            current_stage: parsed.roundType === "Other" ? "None" : parsed.roundType,
          })
          .select("id")
          .single();

        if (newApplicationError || !newApplication) {
          failedCount += 1;
          continue;
        }

        applicationId = newApplication.id;
        createdCount += 1;
      }

      const finalConfidence = aiChosen ? aiConfidence : parserInvalidBeforeAi ? 0.45 : 0.82;
      if (finalConfidence < 0.75) {
        reviewReasons.push("low_confidence");
      }

      const roundBasePayload = {
        application_id: applicationId,
        round_type: parsed.roundType,
        status: parsed.status,
        scheduled_start_utc: parsed.scheduledAt,
        scheduled_end_utc: parsed.scheduledEndAt,
        timezone: icsData?.timezone ?? "Asia/Kolkata",
        meeting_link: parsed.meetingLink,
        source_email_id: message.id,
        source_thread_id: message.threadId,
      };

      let roundInsertError: { message?: string } | null = null;

      const insertWithInterviewerMetadata = await supabase.from("interview_rounds").insert({
        ...roundBasePayload,
        organizer_email: icsData?.organizerEmail ?? null,
        attendee_emails: icsData?.attendeeEmails ?? [],
      });

      if (insertWithInterviewerMetadata.error && isMissingInterviewerColumns(insertWithInterviewerMetadata.error.message)) {
        const fallbackInsert = await supabase.from("interview_rounds").insert(roundBasePayload);
        roundInsertError = fallbackInsert.error;
      } else {
        roundInsertError = insertWithInterviewerMetadata.error;
      }

      if (roundInsertError) {
        if (syncReviewItemsTableAvailable) {
          const reviewInsert = await supabase.from(SYNC_REVIEW_ITEMS_TABLE).insert({
            user_id: user.id,
            source_email_id: message.id,
            source_thread_id: message.threadId,
            signature,
            application_id: applicationId,
            raw_subject: subject,
            raw_from: fromHeader,
            raw_snippet: body.slice(0, 500),
            proposed_company: parsed.company,
            proposed_role: parsed.role,
            proposed_round_type: parsed.roundType,
            proposed_status: parsed.status,
            parser_source: parserSource,
            confidence: finalConfidence,
            reason: [...reviewReasons, "round_insert_failed"].join(", "),
            ai_used: aiUsed,
            review_status: "pending",
          });

          if (reviewInsert.error && isMissingSyncReviewItemsTable(reviewInsert.error.message)) {
            syncReviewItemsTableAvailable = false;
          }
        }

        failedCount += 1;
      } else {
        if (syncReviewItemsTableAvailable && reviewReasons.length > 0) {
          const reviewInsert = await supabase.from(SYNC_REVIEW_ITEMS_TABLE).insert({
            user_id: user.id,
            source_email_id: message.id,
            source_thread_id: message.threadId,
            signature,
            application_id: applicationId,
            raw_subject: subject,
            raw_from: fromHeader,
            raw_snippet: body.slice(0, 500),
            proposed_company: parsed.company,
            proposed_role: parsed.role,
            proposed_round_type: parsed.roundType,
            proposed_status: parsed.status,
            parser_source: parserSource,
            confidence: finalConfidence,
            reason: reviewReasons.join(", "),
            ai_used: aiUsed,
            review_status: "pending",
          });

          if (reviewInsert.error && isMissingSyncReviewItemsTable(reviewInsert.error.message)) {
            syncReviewItemsTableAvailable = false;
          }
        }

        createdCount += 1;
      }
    }

    await supabase
      .from("gmail_accounts")
      .update({ last_sync_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("user_id", user.id);

    const status = failedCount > 0 ? "partial" : "success";

    await supabase.from("sync_runs").insert({
      user_id: user.id,
      status,
      fetched_count: fetchedCount,
      parsed_count: parsedCount,
      created_count: createdCount,
      updated_count: updatedCount,
      failed_count: failedCount,
      ended_at: new Date().toISOString(),
      error_summary: failedCount > 0 ? "One or more messages failed to process." : null,
    });

    const payload = {
      status,
      fetchedCount,
      parsedCount,
      createdCount,
      updatedCount,
      failedCount,
      aiCallsUsed: geminiCallsUsed,
    };

    const contentType = request.headers.get("content-type") ?? "";
    if (contentType.includes("application/x-www-form-urlencoded")) {
      const redirectUrl = new URL("/settings", request.url);
      redirectUrl.searchParams.set("sync", status);
      redirectUrl.searchParams.set("fetched", String(fetchedCount));
      redirectUrl.searchParams.set("created", String(createdCount));
      redirectUrl.searchParams.set("updated", String(updatedCount));
      redirectUrl.searchParams.set("failed", String(failedCount));
      return NextResponse.redirect(redirectUrl);
    }

    return NextResponse.json(payload);
  } catch (error) {
    const errorDetails = getSyncErrorDetails(error);

    await supabase.from("sync_runs").insert({
      user_id: user.id,
      status: "failed",
      fetched_count: fetchedCount,
      parsed_count: parsedCount,
      created_count: createdCount,
      updated_count: updatedCount,
      failed_count: failedCount + 1,
      ended_at: new Date().toISOString(),
      error_summary: errorDetails.message,
    });
    const contentType = request.headers.get("content-type") ?? "";

    if (contentType.includes("application/x-www-form-urlencoded")) {
      const redirectUrl = new URL("/settings", request.url);
      redirectUrl.searchParams.set("sync", "failed");
      redirectUrl.searchParams.set("failed", String(failedCount + 1));
      if (errorDetails.reconnectRequired) {
        redirectUrl.searchParams.set("gmail", "reconnect_required");
      }
      return NextResponse.redirect(redirectUrl);
    }

    return NextResponse.json(
      {
        error: errorDetails.message,
        code: errorDetails.code,
      },
      { status: errorDetails.statusCode },
    );
  }
}
