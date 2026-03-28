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

type IcsDateParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

function parseIcsDateParts(rawValue: string): IcsDateParts | null {
  const match = rawValue.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})$/);
  if (!match) return null;

  const [, y, m, d, hh, mm, ss] = match;
  return {
    year: Number(y),
    month: Number(m),
    day: Number(d),
    hour: Number(hh),
    minute: Number(mm),
    second: Number(ss),
  };
}

function getOffsetMinutesForTimeZone(date: Date, timezone: string): number {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  const parts = formatter.formatToParts(date);
  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));

  const year = Number(map.year);
  const month = Number(map.month);
  const day = Number(map.day);
  const hour = Number(map.hour);
  const minute = Number(map.minute);
  const second = Number(map.second);

  if ([year, month, day, hour, minute, second].some((value) => Number.isNaN(value))) {
    return 0;
  }

  const interpretedAsUtc = Date.UTC(year, month - 1, day, hour, minute, second);
  return Math.round((interpretedAsUtc - date.getTime()) / 60_000);
}

function toUtcIsoFromTimezoneParts(parts: IcsDateParts, timezone: string): string {
  const localAsUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);

  const firstOffset = getOffsetMinutesForTimeZone(new Date(localAsUtc), timezone);
  let utcTimestamp = localAsUtc - firstOffset * 60_000;

  const secondOffset = getOffsetMinutesForTimeZone(new Date(utcTimestamp), timezone);
  utcTimestamp = localAsUtc - secondOffset * 60_000;

  return new Date(utcTimestamp).toISOString();
}

function parseIcsDateWithTimezone(rawValue: string | null, timezone: string | null): string | null {
  if (!rawValue) return null;

  const normalizedTimezone = timezone ? timezoneAliasMap[timezone] || timezone : null;
  const value = rawValue.trim();

  if (value.endsWith("Z")) {
    return parseIcsDate(value);
  }

  const parts = parseIcsDateParts(value);
  if (!parts) {
    return parseIcsDate(value);
  }

  if (!normalizedTimezone) {
    return parseIcsDate(value);
  }

  try {
    return toUtcIsoFromTimezoneParts(parts, normalizedTimezone);
  } catch {
    return parseIcsDate(value);
  }
}

function getIcsPropertyLine(lines: string[], key: string): string | null {
  return (
    lines.find(
      (item) => item.toUpperCase().startsWith(`${key}:`) || item.toUpperCase().startsWith(`${key};`),
    ) ?? null
  );
}

function getIcsProperty(lines: string[], key: string): string | null {
  const line = getIcsPropertyLine(lines, key);
  if (!line) return null;
  const [, value] = line.split(/:(.+)/);
  return value?.trim() ?? null;
}

function getIcsTimezone(lines: string[], key: "DTSTART" | "DTEND"): string | null {
  const line = getIcsPropertyLine(lines, key);
  if (!line) return null;

  const tzMatch = line.match(/(?:^|;)TZID=([^:;]+)/i);
  if (tzMatch?.[1]) {
    return tzMatch[1];
  }

  const wrapperTimezone = getIcsProperty(lines, "X-WR-TIMEZONE");
  return wrapperTimezone ?? null;
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
  const timezone = getIcsTimezone(lines, "DTSTART") ?? getIcsTimezone(lines, "DTEND");
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
  const domain = fromHeader.match(/@([A-Z0-9.-]+\.[A-Z]{2,})/i)?.[1]?.toLowerCase();
  if (!domain) return null;

  const segments = domain.split(".").filter(Boolean);
  if (segments.length < 2) return null;

  const tld = segments[segments.length - 1];
  const secondLevel = segments[segments.length - 2];
  const countryCodeTlds = new Set(["in", "uk", "au", "nz", "za", "jp", "sg"]);
  const secondLevelSuffixes = new Set(["co", "com", "org", "net", "gov", "ac"]);

  let brandIndex = segments.length - 2;
  if (countryCodeTlds.has(tld) && secondLevelSuffixes.has(secondLevel) && segments.length >= 3) {
    brandIndex = segments.length - 3;
  }

  const domainRoot = segments[brandIndex]?.replace(/[^a-z0-9-]/gi, "").trim();
  if (!domainRoot) return null;

  return toTitleCase(domainRoot);
}

function companyFromEmailAddress(email: string | null): string | null {
  if (!email) return null;
  const company = fallbackCompanyFromEmail(`<${email}>`);
  if (!company) return null;

  const normalized = company.toLowerCase();
  if (["gmail", "outlook", "hotmail", "yahoo", "google", "microsoft", "calendar", "mail"].includes(normalized)) {
    return null;
  }

  return company;
}

function normalizeCompanyCandidate(value: string | null | undefined): string | null {
  const cleaned = pickCandidate(value);
  if (!cleaned) return null;

  let normalized = cleaned.replace(/^\b(with|for|at)\b\s+/i, "").trim();

  if (normalized.includes("/")) {
    normalized = normalized
      .split("/")
      .map((part) => part.trim())
      .find(Boolean) ?? normalized;
  }

  normalized = normalized.split(/\s+with\s+/i)[0]?.trim() ?? normalized;
  normalized = normalized.replace(/[.,;:]+$/g, "").trim();

  return normalized || null;
}

function isLikelyRoleText(value: string | null): boolean {
  if (!value) return false;
  const lowered = value.toLowerCase();
  const roleTokens = [
    "engineer",
    "developer",
    "architect",
    "analyst",
    "consultant",
    "manager",
    "lead",
    "qa",
    "sdet",
    "full stack",
    "fullstack",
    "backend",
    "frontend",
    "technical",
    "screening",
    "dot net",
    ".net",
    "react",
    "mvc",
  ];

  return roleTokens.some((token) => lowered.includes(token));
}

function isLikelyCompanyName(value: string | null): boolean {
  if (!value) return false;
  const candidate = value.trim();
  if (!candidate || candidate.length < 2 || candidate.length > 80) return false;
  if (/^[^a-z0-9]+/i.test(candidate)) return false;
  if (/^\d+$/.test(candidate)) return false;
  if (/^(l\d+|hr|technical|online|f2f|round|interview)$/i.test(candidate)) return false;
  if (/^\.[a-z]+$/i.test(candidate)) return false;
  if (candidate.includes("@") || /https?:\/\//i.test(candidate)) return false;

  const lowered = candidate.toLowerCase();
  const blockedTerms = [
    "with ",
    "discussion",
    "interview",
    "calendar",
    "confirmation",
    "rescheduled",
    "scheduled",
    "online",
    "technical",
    "f2f",
    "connectwise software engineer",
    "information technology act",
  ];

  if (blockedTerms.some((term) => lowered.includes(term))) return false;
  if (/(\bmon\b|\btue\b|\bwed\b|\bthu\b|\bfri\b|\bsat\b|\bsun\b|\bgmt\b|\bam\b|\bpm\b)/i.test(lowered)) {
    return false;
  }

  const words = candidate.split(/\s+/).filter(Boolean);
  const hasCompanyKeyword = /(technologies|technology|solutions|systems|labs|software|tech|ltd|limited|llc|inc|corp|group|services|consulting)/i.test(
    lowered,
  );

  if (isLikelyRoleText(candidate) && !hasCompanyKeyword) return false;
  if (words.length > 5 && !hasCompanyKeyword) return false;

  return true;
}

function resolveCompanyFallback(organizerEmail: string | null, fromHeader: string): string | null {
  return companyFromEmailAddress(organizerEmail) || fallbackCompanyFromEmail(fromHeader);
}

function isLikelyPersonName(value: string | null): boolean {
  if (!value) return false;
  const candidate = value.trim();
  if (!candidate) return false;

  if (/(technologies|technology|solutions|systems|labs|software|tech|ltd|limited|llc|inc|corp|group|services|consulting)/i.test(candidate)) {
    return false;
  }

  const words = candidate.split(/\s+/).filter(Boolean);
  if (words.length < 2 || words.length > 4) return false;
  return words.every((word) => /^[A-Za-z]+$/.test(word));
}

function isGenericRecruitingCompany(value: string | null): boolean {
  if (!value) return false;
  const normalized = value.toLowerCase();
  return [
    "smartrecruiters",
    "greenhouse",
    "lever",
    "workday",
    "myworkdayjobs",
    "flocareer",
    "wellfound",
    "linkedin",
    "indeed",
    "naukri",
    "foundit",
  ].includes(normalized);
}

function extractCompanyFromWithMarker(text: string): string | null {
  const match = text.match(/\bwith\s+([a-z0-9&.' -]{2,80}?)(?=\s*(?:@|\bon\b|,|\(|$))/i);
  if (!match?.[1]) return null;

  const candidate = normalizeCompanyCandidate(match[1]);
  if (!isLikelyCompanyName(candidate) || isLikelyPersonName(candidate)) {
    return null;
  }

  return candidate;
}

function extractCompanyFromAtMarker(text: string): string | null {
  const patterns = [
    /\bfor\s+.+?\s+at\s+([a-z0-9&.' -]{2,80}?)(?=\s*(?:\.|,|\bwith\b|\bon\b|\(|$))/i,
    /\bat\s+([a-z0-9&.' -]{2,80}?)(?=\s*(?:\.|,|\bwith\b|\bon\b|\(|$))/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (!match?.[1]) continue;
    const candidate = normalizeCompanyCandidate(match[1]);
    if (!candidate) continue;
    if (isLikelyCompanyName(candidate) && !isLikelyPersonName(candidate)) {
      return candidate;
    }
  }

  return null;
}

function extractCompanyFromSlashPrefix(text: string): string | null {
  if (!text.includes("/")) return null;
  const prefix = normalizeCompanyCandidate(text.split("/")[0]);
  if (!prefix) return null;
  if (!isLikelyCompanyName(prefix) || isLikelyPersonName(prefix)) return null;
  return prefix;
}

function extractCompanyFromDashSuffix(text: string): string | null {
  if (!text.includes("-")) return null;

  const parts = text
    .split("-")
    .map((part) => normalizeCompanyCandidate(part))
    .filter((part): part is string => Boolean(part));

  if (parts.length === 0) return null;

  for (let index = parts.length - 1; index >= 0; index -= 1) {
    const candidate = parts[index];
    if (isLikelyCompanyName(candidate) && !isLikelyPersonName(candidate) && !isLikelyRoleText(candidate)) {
      return candidate;
    }
  }

  return null;
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
  const fallbackFromEmail = resolveCompanyFallback(organizerEmail, fromHeader);
  const organizerCompany = companyFromEmailAddress(organizerEmail);

  const finalizeCompany = (candidate: string | null): string => {
    const normalized = normalizeCompanyCandidate(candidate);
    if (isLikelyCompanyName(normalized)) {
      return normalized as string;
    }
    return fallbackFromEmail || "Unknown Company";
  };

  const trimmed = (icsSummary || subject).trim();
  const summaryParts = trimmed
    .split("||")
    .map((part) => pickCandidate(part))
    .filter((part): part is string => Boolean(part));

  const roleFromSummary = pickRoleFromParts(summaryParts);
  const roleFromSubject = pickCandidate(subject);

  const companyFromSlash = extractCompanyFromSlashPrefix(trimmed);
  if (companyFromSlash) {
    return {
      company: finalizeCompany(companyFromSlash),
      role: roleFromSummary || roleFromSubject || "Unknown Role",
    };
  }

  const companyFromAt = extractCompanyFromAtMarker(trimmed);
  if (companyFromAt) {
    return {
      company: finalizeCompany(companyFromAt),
      role: roleFromSummary || roleFromSubject || "Unknown Role",
    };
  }

  const companyFromDashSuffix = extractCompanyFromDashSuffix(trimmed);
  if (companyFromDashSuffix) {
    return {
      company: finalizeCompany(companyFromDashSuffix),
      role: roleFromSummary || roleFromSubject || "Unknown Role",
    };
  }

  const withMarkerCompany = extractCompanyFromWithMarker(trimmed);
  if (withMarkerCompany) {
    return {
      company: finalizeCompany(withMarkerCompany),
      role: roleFromSummary || roleFromSubject || "Unknown Role",
    };
  }

  if (organizerCompany) {
    if (isGenericRecruitingCompany(organizerCompany) && summaryParts.length > 0) {
      const companyFromParts = summaryParts.find(
        (part) => isLikelyCompanyName(part) && !isLikelyPersonName(part) && !isLikelyRoleText(part),
      );
      if (companyFromParts) {
        return {
          company: finalizeCompany(companyFromParts),
          role: roleFromSummary || roleFromSubject || "Unknown Role",
        };
      }
    }

    return {
      company: finalizeCompany(organizerCompany),
      role: roleFromSummary || roleFromSubject || "Unknown Role",
    };
  }

  if (summaryParts.length >= 2) {
    const companyCandidate = summaryParts.find(
      (part) => isLikelyCompanyName(part) && !isLikelyPersonName(part) && !isLikelyRoleText(part),
    );
    const roleCandidate = roleFromSummary;

    if (companyCandidate) {
      return {
        company: finalizeCompany(companyCandidate),
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
        company: finalizeCompany(companyCandidate),
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
        company: finalizeCompany(companyCandidate),
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
      company: finalizeCompany(companyFromEmail),
      role: roleCandidate || "Unknown Role",
    };
  }

  const fromByMatch = trimmed.match(/from\s+(.+?)\b/i);
  if (fromByMatch) {
    const companyCandidate = pickCandidate(fromByMatch[1]);
    if (companyCandidate) {
      return {
        company: finalizeCompany(companyCandidate),
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
      company: finalizeCompany(dashMatch[0] || null),
      role: pickRoleFromParts(dashMatch as string[]) || "Unknown Role",
    };
  }

  const companyFromSignature = fallbackCompanyFromSignature(body);

  if (companyFromSignature) {
    return {
      company: finalizeCompany(companyFromSignature),
      role: cleanToken(subject) || "Unknown Role",
    };
  }

  return {
    company: finalizeCompany(null),
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
