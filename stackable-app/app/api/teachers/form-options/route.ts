import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireAuth } from "@/lib/api/guard";
import { toErrorResponse } from "@/lib/api/errors";

export async function GET(request: NextRequest) {
  let auth;
  try {
    auth = await requireAuth(request, { rateLimit: "read" });
  } catch (err) { return toErrorResponse(err); }

  try {
    const [schoolsRes, classesRes, subjectsRes] = await Promise.all([
      // Only return the school the caller belongs to — never all schools.
      supabaseAdmin
        .from("schools")
        .select("id, name")
        .eq("id", auth.schoolId)
        .order("name", { ascending: true }),
      // Classes scoped to the caller's school to prevent cross-tenant enumeration.
      supabaseAdmin
        .from("classes")
        .select("id, school_id, class_name, stream, class_teacher_id")
        .eq("school_id", auth.schoolId)
        .order("class_name", { ascending: true }),
      // Subjects are a global catalog — no school scope needed.
      supabaseAdmin
        .from("subjects")
        .select("id, subject_name")
        .order("subject_name", { ascending: true }),
    ]);

    const firstError = schoolsRes.error ?? classesRes.error ?? subjectsRes.error;

    if (firstError) {
      return NextResponse.json({ error: firstError.message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      data: {
        schools: schoolsRes.data ?? [],
        classes: classesRes.data ?? [],
        subjects: subjectsRes.data ?? [],
      },
    });
  } catch (error) {
    console.error("teacher form options route error", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unexpected server error." },
      { status: 500 },
    );
  }
}
