import { getGeminiEnv } from "@/lib/env";

export type GeminiExtractionInput = {
  subject: string;
  fromHeader: string;
  organizerEmail: string | null;
  icsSummary: string | null;
  icsLocation: string | null;
  icsStatus: string | null;
};

export type GeminiExtractionResult = {
  company: string;
  role: string;
  confidence: number;
  reason: string;
};

function cleanJsonText(raw: string): string {
  return raw
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();
}

function sanitizeText(value: string | null | undefined): string {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

function looksValidCompany(value: string): boolean {
  const company = sanitizeText(value);
  if (!company || company.length < 2 || company.length > 120) return false;
  if (/^(l\d+|hr|technical|online|f2f|round)$/i.test(company)) return false;
  if (/^\d+$/.test(company)) return false;
  return true;
}

function looksValidRole(value: string): boolean {
  const role = sanitizeText(value);
  if (!role || role.length < 2 || role.length > 160) return false;
  if (/^\d+$/.test(role)) return false;
  return true;
}

export async function extractCompanyRoleWithGemini(
  input: GeminiExtractionInput,
): Promise<GeminiExtractionResult | null> {
  const geminiEnv = getGeminiEnv();

  const prompt = [
    "Extract job company and role from interview email metadata.",
    "Return ONLY strict JSON with keys: company, role, confidence, reason.",
    "Rules:",
    "- Prefer explicit company text from subject/summary (e.g. 'DeltaX / ...', 'with Ramboll', '... at LTIMindtree').",
    "- Never return interviewer/person name as company.",
    "- Never return round labels (HR/L1/L2/etc.) as company.",
    "- Use sender/organizer domain only when explicit company is not present.",
    "- Keep role as concise job title.",
    "- confidence is a number between 0 and 1.",
    "",
    `subject: ${sanitizeText(input.subject)}`,
    `from_header: ${sanitizeText(input.fromHeader)}`,
    `organizer_email: ${sanitizeText(input.organizerEmail)}`,
    `ics_summary: ${sanitizeText(input.icsSummary)}`,
    `ics_location: ${sanitizeText(input.icsLocation)}`,
    `ics_status: ${sanitizeText(input.icsStatus)}`,
  ].join("\n");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), geminiEnv.timeoutMs);

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(geminiEnv.model)}:generateContent?key=${encodeURIComponent(geminiEnv.apiKey)}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.1,
            responseMimeType: "application/json",
          },
        }),
        signal: controller.signal,
      },
    );

    if (!response.ok) {
      return null;
    }

    const payload = (await response.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };

    const text = payload.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return null;

    const parsed = JSON.parse(cleanJsonText(text)) as {
      company?: string;
      role?: string;
      confidence?: number;
      reason?: string;
    };

    const company = sanitizeText(parsed.company);
    const role = sanitizeText(parsed.role);
    const confidence = typeof parsed.confidence === "number" ? parsed.confidence : 0;
    const reason = sanitizeText(parsed.reason) || "Gemini extraction";

    if (!looksValidCompany(company) || !looksValidRole(role)) {
      return null;
    }

    return {
      company,
      role,
      confidence: Math.max(0, Math.min(1, confidence)),
      reason,
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
