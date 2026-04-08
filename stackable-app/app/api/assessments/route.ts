import { NextRequest, NextResponse } from "next/server";
import { getSchoolSubjectOrThrow, getSubjectAssessmentsData } from "@/lib/subjects-server";
import { supabaseAdmin } from "@/lib/supabase/admin";

function asText(value: unknown) {
  const text = String(value ?? "").trim();
  return text || null;
}

function asNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function GET(request: NextRequest) {
  try {
    const schoolSubjectId = request.nextUrl.searchParams.get("school_subject_id");
    if (!schoolSubjectId) {
      return NextResponse.json({ error: "school_subject_id is required." }, { status: 400 });
    }

    const data = await getSubjectAssessmentsData(schoolSubjectId);
    return NextResponse.json({ ok: true, data });
  } catch (error) {
    console.error("shared assessments route error", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unexpected server error." },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      school_subject_id?: string | null;
      type?: string | null;
      title?: string | null;
      description?: string | null;
      term?: string | null;
      total_marks_raw?: number | null;
      duration_minutes?: number | null;
      scheduled_start_at?: string | null;
      scheduled_end_at?: string | null;
      target_class_ids?: string[];
      teacher_id?: string | null;
      created_by?: string | null;
    };

    const schoolSubjectId = asText(body.school_subject_id);
    const title = asText(body.title);
    const type = asText(body.type);
    const targetClassIds = Array.isArray(body.target_class_ids) ? body.target_class_ids : [];

    if (!schoolSubjectId || !title || !type || targetClassIds.length === 0) {
      return NextResponse.json(
        { error: "school_subject_id, title, type, and target classes are required." },
        { status: 400 },
      );
    }

    const offering = await getSchoolSubjectOrThrow(schoolSubjectId);

    const assessmentInsert = await supabaseAdmin
      .from("assessments")
      .insert({
        school_id: offering.school_id,
        school_subject_id: schoolSubjectId,
        type,
        title,
        description: asText(body.description),
        term: asText(body.term),
        total_marks_raw: asNumber(body.total_marks_raw),
        duration_minutes: asNumber(body.duration_minutes),
        scheduled_start_at: asText(body.scheduled_start_at),
        scheduled_end_at: asText(body.scheduled_end_at),
        status: "scheduled",
        created_by: asText(body.created_by),
      })
      .select("id")
      .single();

    if (assessmentInsert.error || !assessmentInsert.data) {
      return NextResponse.json(
        { error: assessmentInsert.error?.message ?? "Failed to create assessment." },
        { status: 500 },
      );
    }

    const classLinks = await supabaseAdmin
      .from("school_subject_classes")
      .select("id, class_id")
      .eq("school_subject_id", schoolSubjectId)
      .in("class_id", targetClassIds);

    if (classLinks.error) {
      return NextResponse.json({ error: classLinks.error.message }, { status: 500 });
    }

    const targetsInsert = await supabaseAdmin.from("assessment_targets").insert(
      (classLinks.data ?? []).map((item) => ({
        assessment_id: assessmentInsert.data.id,
        school_subject_class_id: item.id,
        class_id: item.class_id,
        teacher_id: asText(body.teacher_id),
        status: "scheduled",
      })),
    );

    if (targetsInsert.error) {
      return NextResponse.json({ error: targetsInsert.error.message }, { status: 500 });
    }

    const data = await getSubjectAssessmentsData(schoolSubjectId);
    return NextResponse.json({ ok: true, data }, { status: 201 });
  } catch (error) {
    console.error("shared assessments create route error", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unexpected server error." },
      { status: 500 },
    );
  }
}
