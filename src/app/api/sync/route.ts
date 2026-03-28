import { NextResponse } from "next/server";
import { google } from "googleapis";
import { serviceUnavailable, unauthorized } from "@/lib/api/responses";
import { getSessionUser } from "@/lib/auth/session-user";
import { decryptSecret } from "@/lib/crypto/secrets";
import { hasEncryptionConfig, hasGoogleOAuthConfig } from "@/lib/env";
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

const SYNC_QUERY =
  'filename:ics subject:(interview OR meeting OR invitation) -subject:("walk in" OR "walk-in" OR walkin OR drive OR "hiring drive" OR "mega drive" OR "bulk hiring")';

function parseHeaderDate(value: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
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

  const current =
    payload.filename && payload.filename.toLowerCase().endsWith(".ics") && payload.body?.attachmentId
      ? [payload]
      : [];

  return [...current, ...(payload.parts ?? []).flatMap((part) => collectAttachmentParts(part))];
}

function isMissingInterviewerColumns(message?: string | null) {
  if (!message) return false;
  return message.includes("organizer_email") || message.includes("attendee_emails");
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
  let createdCount = 0;
  let updatedCount = 0;
  let failedCount = 0;

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

    let query = SYNC_QUERY;
    if (gmailAccount.last_sync_at && !fullSync) {
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
      const fallbackDate =
        parseHeaderDate(getHeader(payload, "Date")) ||
        (message.internalDate ? new Date(Number(message.internalDate)).toISOString() : null) ||
        new Date().toISOString();
      const body = `${message.snippet ?? ""}\n${collectBody(payload)}`;

      const icsParts = collectAttachmentParts(payload);
      let icsData: ParsedIcs | null = null;

      for (const part of icsParts) {
        const attachmentId = part.body?.attachmentId;
        if (!attachmentId) {
          continue;
        }

        const attachmentResponse = await gmail.users.messages.attachments.get({
          userId: "me",
          messageId: messageRef.id,
          id: attachmentId,
        });

        const encoded = attachmentResponse.data.data;
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

      const scheduledDate = new Date(parsed.scheduledAt);
      const invalidDate = Number.isNaN(scheduledDate.getTime()) || scheduledDate.getUTCFullYear() < 2000;
      if (invalidDate) {
        parsed.scheduledAt = fallbackDate;
      }

      if (parsed.company === "Unknown Company" && parsed.role === "Unknown Role") {
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
        failedCount += 1;
      } else {
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
      parsed_count: fetchedCount,
      created_count: createdCount,
      updated_count: updatedCount,
      failed_count: failedCount,
      ended_at: new Date().toISOString(),
      error_summary: failedCount > 0 ? "One or more messages failed to process." : null,
    });

    const payload = {
      status,
      fetchedCount,
      createdCount,
      updatedCount,
      failedCount,
    };

    const contentType = request.headers.get("content-type") ?? "";
    if (contentType.includes("application/x-www-form-urlencoded")) {
      const redirectUrl = new URL("/settings", request.url);
      redirectUrl.searchParams.set("sync", status);
      return NextResponse.redirect(redirectUrl);
    }

    return NextResponse.json(payload);
  } catch (error) {
    await supabase.from("sync_runs").insert({
      user_id: user.id,
      status: "failed",
      fetched_count: fetchedCount,
      parsed_count: fetchedCount,
      created_count: createdCount,
      updated_count: updatedCount,
      failed_count: failedCount + 1,
      ended_at: new Date().toISOString(),
      error_summary: error instanceof Error ? error.message : "Unknown sync failure",
    });

    const message = error instanceof Error ? error.message : "Sync failed";
    const contentType = request.headers.get("content-type") ?? "";

    if (contentType.includes("application/x-www-form-urlencoded")) {
      const redirectUrl = new URL("/settings", request.url);
      redirectUrl.searchParams.set("sync", "failed");
      return NextResponse.redirect(redirectUrl);
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
