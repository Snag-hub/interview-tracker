import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { badRequest, unauthorized } from "@/lib/api/responses";
import { getSessionUser } from "@/lib/auth/session-user";
import { createSupabaseServerClient } from "@/lib/supabase/server-client";

const resumeSchema = z.object({
  versionLabel: z.string().trim().min(1).max(100),
  resumeUrl: z.string().trim().url(),
  isDefault: z.boolean().optional().default(false),
});

export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  try {
    const payload = resumeSchema.parse(await request.json());
    const supabase = await createSupabaseServerClient();

    const { data, error } = await supabase
      .from("resume_versions")
      .insert({
        user_id: user.id,
        version_label: payload.versionLabel,
        resume_url: payload.resumeUrl,
        is_default: payload.isDefault,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ resume: data }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) return badRequest(error.issues[0].message);
    return NextResponse.json({ error: "Failed to create resume" }, { status: 500 });
  }
}
