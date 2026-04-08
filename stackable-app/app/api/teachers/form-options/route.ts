import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function GET() {
  try {
    const [schoolsRes, classesRes, subjectsRes] = await Promise.all([
      supabaseAdmin
        .from("schools")
        .select("id, name")
        .order("name", { ascending: true }),
      supabaseAdmin
        .from("classes")
        .select("id, school_id, class_name, stream, class_teacher_id")
        .order("class_name", { ascending: true }),
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
