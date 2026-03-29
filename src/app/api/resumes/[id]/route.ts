import { NextRequest, NextResponse } from "next/server";
import { unauthorized, notFound } from "@/lib/api/responses";
import { getSessionUser } from "@/lib/auth/session-user";
import { createSupabaseServerClient } from "@/lib/supabase/server-client";

type Params = { params: Promise<{ id: string }> };

export async function DELETE(_: NextRequest, context: Params) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const { id } = await context.params;
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("resume_versions")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id)
    .select("id")
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return notFound("Resume not found");

  return NextResponse.json({ deleted: true }, { status: 200 });
}
