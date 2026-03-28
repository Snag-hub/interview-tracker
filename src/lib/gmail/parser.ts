export type ParsedInvite = {
  company: string;
  role: string;
  roundType: "HR" | "L1" | "L2" | "Managerial" | "Final" | "Other";
  status: "Scheduled" | "Completed" | "Canceled" | "Rescheduled";
  meetingLink: string | null;
  scheduledAt: string;
  scheduledEndAt: string | null;
};

export type ParsedIcs = {
  summary: string | null;
  location: string | null;
  description: string | null;
  start: string | null;
  end: string | null;
  timezone: string | null;
  organizerEmail: string | null;
  attendeeEmails: string[];
  status: string | null;
};

const meetingLinkRegex = /(https?:\/\/(?:meet\.google\.com|[\w.-]*zoom\.us|teams\.microsoft\.com|webex\.com|whereby\.com|calendar\.google\.com)[^\s"'<>]*)/i;

function unfoldIcsLines(ics: string): string[] {
  const normalized = ics.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const rawLines = normalized.split("\n");
  const lines: string[] = [];

  for (const line of rawLines) {
    if ((line.startsWith(" ") || line.startsWith("\t")) && lines.length > 0) {
      lines[lines.length - 1] += line.slice(1);
      continue;
    }
    lines.push(line);
  }

  return lines;
}

function decodeIcsText(value: string | null): string | null {
  if (!value) return null;
  return value
    .replace(/\\n/gi, " ")
    .replace(/\\,/g, ",")
    .replace(/\\;/g, ";")
    .replace(/\\\\/g, "\\")
    .trim();
}

function parseIcsDate(rawValue: string | null): string | null {
  if (!rawValue) return null;

  const value = rawValue.trim();
  const utcMatch = value.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/);
  if (utcMatch) {
    const [, y, m, d, hh, mm, ss] = utcMatch;
    return new Date(Date.UTC(Number(y), Number(m) - 1, Number(d), Number(hh), Number(mm), Number(ss))).toISOString();
  }

  const localMatch = value.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})$/);
  if (localMatch) {
    const [, y, m, d, hh, mm, ss] = localMatch;
    return new Date(Date.UTC(Number(y), Number(m) - 1, Number(d), Number(hh), Number(mm), Number(ss))).toISOString();
  }

  const dayMatch = value.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (dayMatch) {
    const [, y, m, d] = dayMatch;
    return new Date(Date.UTC(Number(y), Number(m) - 1, Number(d), 0, 0, 0)).toISOString();
  }

  return null;
}

const timezoneAliasMap: Record<string, string> = {
  "India Standard Time": "Asia/Kolkata",
  IST: "Asia/Kolkata",
  UTC: "UTC",
};

const timezoneOffsetMinutesMap: Record<string, number> = {
  "Asia/Kolkata": 330,
  UTC: 0,
};

function parseIcsDateWithTimezone(rawValue: string | null, timezone: string | null): string | null {
  if (!rawValue) return null;

  const normalizedTimezone = timezone ? timezoneAliasMap[timezone] || timezone : null;
  const value = rawValue.trim();

  if (value.endsWith("Z")) {
    return parseIcsDate(value);
  }

  const match = value.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})$/);
  if (!match) {
    return parseIcsDate(value);
  }

  const [, y, m, d, hh, mm, ss] = match;
  const offsetMinutes = normalizedTimezone
    ? timezoneOffsetMinutesMap[normalizedTimezone] ?? 0
    : 0;

  const utcMillis =
    Date.UTC(Number(y), Number(m) - 1, Number(d), Number(hh), Number(mm), Number(ss)) -
    offsetMinutes * 60_000;
  return new Date(utcMillis).toISOString();
}

function getIcsProperty(lines: string[], key: string): string | null {
  const line = lines.find(
    (item) => item.toUpperCase().startsWith(`${key}:`) || item.toUpperCase().startsWith(`${key};`),
  );
  if (!line) return null;
  const [, value] = line.split(/:(.+)/);
  return value?.trim() ?? null;
}

function getIcsTimezone(lines: string[]): string | null {
  const line = lines.find((item) => item.toUpperCase().startsWith("DTSTART;TZID="));
  if (!line) return null;
  const tzMatch = line.match(/^DTSTART;TZID=([^:;]+)[;:]?/i);
  return tzMatch?.[1] ?? null;
}

function getIcsEmail(lines: string[], key: string): string | null {
  const line = lines.find((item) => item.toUpperCase().startsWith(`${key};`) || item.toUpperCase().startsWith(`${key}:`));
  if (!line) return null;
  const mail = line.match(/mailto:([^\s]+)/i)?.[1];
  return mail?.trim().toLowerCase() ?? null;
}

function getIcsAttendeeEmails(lines: string[]): string[] {
  const emails = lines
    .filter((line) => line.toUpperCase().startsWith("ATTENDEE"))
    .map((line) => line.match(/mailto:([^\s]+)/i)?.[1]?.trim().toLowerCase())
    .filter((value): value is string => Boolean(value));

  return [...new Set(emails)];
}

function extractMeetingLinkFromIcs(lines: string[], description: string | null): string | null {
  const preferredKeys = [
    "X-MICROSOFT-SKYPETEAMSMEETINGURL",
    "X-GOOGLE-CONFERENCE",
    "URL",
  ];

  for (const key of preferredKeys) {
    const value = decodeIcsText(getIcsProperty(lines, key));
    const link = value?.match(meetingLinkRegex)?.[1];
    if (link) return link;
  }

  const descriptionLink = description?.match(meetingLinkRegex)?.[1];
  return descriptionLink ?? null;
}

function extractVeventLines(allLines: string[]): string[] {
  const start = allLines.findIndex((line) => line.toUpperCase() === "BEGIN:VEVENT");
  const end = allLines.findIndex((line, index) => index > start && line.toUpperCase() === "END:VEVENT");
  if (start === -1 || end === -1 || end <= start) {
    return allLines;
  }
  return allLines.slice(start, end + 1);
}

export function parseIcsContent(rawIcs: string): ParsedIcs | null {
  const lines = extractVeventLines(unfoldIcsLines(rawIcs));
  if (lines.length === 0) return null;

  const summary = decodeIcsText(getIcsProperty(lines, "SUMMARY"));
  const location = decodeIcsText(getIcsProperty(lines, "LOCATION"));
  const description = decodeIcsText(getIcsProperty(lines, "DESCRIPTION"));
  const startRaw = getIcsProperty(lines, "DTSTART");
  const endRaw = getIcsProperty(lines, "DTEND");
  const timezone = getIcsTimezone(lines);
  const organizerEmail = getIcsEmail(lines, "ORGANIZER");
  const attendeeEmails = getIcsAttendeeEmails(lines);
  const status = decodeIcsText(getIcsProperty(lines, "STATUS"));
  const meetingLink = extractMeetingLinkFromIcs(lines, description);

  if (!summary && !startRaw && !location && !organizerEmail) {
    return null;
  }

  return {
    summary,
    location: meetingLink || location,
    description,
    start: parseIcsDateWithTimezone(startRaw, timezone),
    end: parseIcsDateWithTimezone(endRaw, timezone),
    timezone,
    organizerEmail,
    attendeeEmails,
    status,
  };
}

export function decodeBody(data?: string | null): string {
  if (!data) return "";
  const normalized = data.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(normalized, "base64").toString("utf8");
}

export function classifyRoundType(text: string): ParsedInvite["roundType"] {
  const value = text.toLowerCase();
  if (value.includes("hr") || value.includes("human resources")) return "HR";
  if (value.includes("l1") || value.includes("level 1")) return "L1";
  if (value.includes("l2") || value.includes("level 2")) return "L2";
  if (value.includes("manager") || value.includes("managerial")) return "Managerial";
  if (value.includes("final")) return "Final";
  return "Other";
}

export function classifyRoundStatus(text: string): ParsedInvite["status"] {
  const value = text.toLowerCase();
  if (value.includes("reschedule") || value.includes("rescheduled")) return "Rescheduled";
  if (value.includes("cancelled") || value.includes("canceled")) return "Canceled";
  if (
    value.includes("feedback") ||
    value.includes("interview completed") ||
    value.includes("thanks for attending") ||
    value.includes("thank you for interviewing")
  ) {
    return "Completed";
  }
  return "Scheduled";
}

function classifyRoundStatusFromIcs(icsStatus: string | null): ParsedInvite["status"] | null {
  if (!icsStatus) return null;
  const value = icsStatus.toLowerCase();
  if (value.includes("cancel")) return "Canceled";
  if (value.includes("confirmed") || value.includes("tentative")) return "Scheduled";
  return null;
}

function toTitleCase(value: string) {
  return value
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((token) => token.charAt(0).toUpperCase() + token.slice(1).toLowerCase())
    .join(" ");
}

function cleanToken(value: string) {
  return value
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;|&amp;|&lt;|&gt;|&quot;|&#39;/gi, " ")
    .replace(/\b(disclaimer|warning|virus|confidential|recipient|attachments?)\b/gi, " ")
    .replace(/\b(interview|invitation|meeting|scheduled|schedule|feedback|round|position|role)\b/gi, "")
    .replace(/[|()[\]{}]/g, " ")
    .replace(/\\,/g, ",")
    .replace(/\s+/g, " ")
    .trim();
}

function isLikelyGarbage(value: string) {
  const normalized = value.toLowerCase();
  if (!normalized) return true;
  if (normalized.length > 120) return true;

  const blockedPhrases = [
    "information technology act",
    "recipient should check",
    "company accepts no liability",
    "this electronic message",
    "computer viruses",
    "confidential",
    "quoted text",
  ];

  return blockedPhrases.some((phrase) => normalized.includes(phrase));
}

function pickCandidate(value: string | null | undefined): string | null {
  if (!value) return null;
  const cleaned = cleanToken(value);
  if (!cleaned || isLikelyGarbage(cleaned)) return null;
  return cleaned;
}

function pickRoleFromParts(parts: string[]): string | null {
  const roleKeywords = [
    "engineer",
    "developer",
    "architect",
    "analyst",
    "consultant",
    "manager",
    "lead",
    "qa",
    "sdet",
    "dot net",
    ".net",
    "fullstack",
    "backend",
    "frontend",
    "software",
    "technical",
    "screening",
  ];

  for (const part of parts) {
    const candidate = pickCandidate(part);
    if (!candidate) continue;
    const normalized = candidate.toLowerCase();
    if (roleKeywords.some((keyword) => normalized.includes(keyword))) {
      return candidate;
    }
  }

  for (const part of parts) {
    const candidate = pickCandidate(part);
    if (candidate && !/^\d+$/.test(candidate)) {
      return candidate;
    }
  }

  return null;
}

function fallbackCompanyFromEmail(fromHeader: string): string | null {
  const domain = fromHeader.match(/@([A-Z0-9.-]+)\.[A-Z]{2,}/i)?.[1];
  if (!domain) return null;

  const domainRoot = domain
    .split(".")
    .slice(0, -1)
    .filter((segment) => !["mail", "mailer", "noreply", "notifications", "careers"].includes(segment))
    .pop();

  if (!domainRoot) return null;
  return toTitleCase(domainRoot);
}

function companyFromEmailAddress(email: string | null): string | null {
  if (!email) return null;
  const company = fallbackCompanyFromEmail(`<${email}>`);
  if (!company) return null;

  const normalized = company.toLowerCase();
  if (["gmail", "outlook", "hotmail", "yahoo", "google", "microsoft"].includes(normalized)) {
    return null;
  }

  return company;
}

function fallbackCompanyFromSignature(body: string): string | null {
  const lines = body
    .split(/\r?\n/)
    .map((line) => cleanToken(line))
    .filter(Boolean)
    .slice(-40);

  const signatureLine = lines.find((line) =>
    /\b(private limited|pvt\. ltd\.|technologies|technology|solutions|systems|labs|inc\.?|llc|corp\.?|company)\b/i.test(
      line,
    ),
  );

  if (!signatureLine) return null;
  return cleanToken(signatureLine) || null;
}

function extractCompanyAndRole(
  subject: string,
  body: string,
  fromHeader: string,
  organizerEmail: string | null,
  icsSummary: string | null,
): { company: string; role: string } {
  const trimmed = (icsSummary || subject).trim();
  const summaryParts = trimmed
    .split("||")
    .map((part) => pickCandidate(part))
    .filter((part): part is string => Boolean(part));

  const companyFromOrganizer = companyFromEmailAddress(organizerEmail);
  if (companyFromOrganizer) {
    const roleFromSummary = pickRoleFromParts(summaryParts);
    const roleFromSubject = pickCandidate(subject);
    return {
      company: companyFromOrganizer,
      role: roleFromSummary || roleFromSubject || "Unknown Role",
    };
  }

  if (summaryParts.length >= 2) {
    const companyCandidate = pickCandidate(summaryParts[summaryParts.length - 1]);
    const roleCandidate = pickRoleFromParts(summaryParts);

    if (companyCandidate) {
      return {
        company: companyCandidate,
        role: roleCandidate || "Unknown Role",
      };
    }
  }

  const atMatch = trimmed.match(/interview\s+for\s+(.+?)\s+at\s+(.+)/i);
  if (atMatch) {
    const roleCandidate = pickCandidate(atMatch[1]);
    const companyCandidate = pickCandidate(atMatch[2]);

    if (companyCandidate || roleCandidate) {
      return {
        role: roleCandidate || "Unknown Role",
        company: companyCandidate || "Unknown Company",
      };
    }
  }

  const roleAtCompanyMatch = trimmed.match(/(.+?)\s+at\s+(.+)/i);
  if (roleAtCompanyMatch) {
    const roleCandidate = pickCandidate(roleAtCompanyMatch[1]);
    const companyCandidate = pickCandidate(roleAtCompanyMatch[2]);

    if (companyCandidate || roleCandidate) {
      return {
        role: roleCandidate || "Unknown Role",
        company: companyCandidate || "Unknown Company",
      };
    }
  }

  const companyFromEmail = fallbackCompanyFromEmail(fromHeader);
  if (companyFromEmail) {
    const roleCandidate = pickRoleFromParts([
      pickCandidate(icsSummary) || "",
      pickCandidate(subject) || "",
      pickCandidate(trimmed) || "",
    ]);
    return {
      company: companyFromEmail,
      role: roleCandidate || "Unknown Role",
    };
  }

  const fromByMatch = trimmed.match(/from\s+(.+?)\b/i);
  if (fromByMatch) {
    const companyCandidate = pickCandidate(fromByMatch[1]);
    if (companyCandidate) {
      return {
        company: companyCandidate,
        role: "Unknown Role",
      };
    }
  }

  const dashMatch = trimmed
    .split("-")
    .map((part) => pickCandidate(part))
    .filter(Boolean);

  if (dashMatch.length >= 2) {
    return {
      company: dashMatch[0] || "Unknown Company",
      role: pickRoleFromParts(dashMatch as string[]) || "Unknown Role",
    };
  }

  const companyFromSignature = fallbackCompanyFromSignature(body);

  if (companyFromSignature) {
    return {
      company: companyFromSignature,
      role: cleanToken(subject) || "Unknown Role",
    };
  }

  return {
    company: "Unknown Company",
    role: "Unknown Role",
  };
}

export function parseInvite(
  subject: string,
  body: string,
  fromHeader: string,
  fallbackDateIso: string,
  icsData: ParsedIcs | null,
): ParsedInvite {
  const combined = `${subject}\n${body}\n${icsData?.summary ?? ""}\n${icsData?.location ?? ""}\n${icsData?.description ?? ""}`;
  const meetingLink =
    icsData?.location?.match(meetingLinkRegex)?.[1] ?? combined.match(meetingLinkRegex)?.[1] ?? null;
  const { company, role } = extractCompanyAndRole(
    subject,
    body,
    fromHeader,
    icsData?.organizerEmail ?? null,
    icsData?.summary ?? null,
  );
  const statusFromIcs = classifyRoundStatusFromIcs(icsData?.status ?? null);

  return {
    company,
    role,
    roundType: classifyRoundType(combined),
    status: statusFromIcs ?? classifyRoundStatus(combined),
    meetingLink,
    scheduledAt: icsData?.start ?? fallbackDateIso,
    scheduledEndAt: icsData?.end ?? null,
  };
}
