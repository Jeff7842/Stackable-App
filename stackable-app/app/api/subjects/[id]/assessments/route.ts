import { NextRequest, NextResponse } from "next/server";
import { getSubjectAssessmentsData, getSchoolSubjectOrThrow } from "@/lib/subjects-server";
import { supabaseAdmin } from "@/lib/supabase/admin";

type Context = {
  params: Promise<{ id: string }>;
};

type AssessmentCreatePayload = {
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

function asText(value: unknown) {
  const text = String(value ?? "").trim();
  return text || null;
}

function asNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function GET(_: NextRequest, context: Context) {
  try {
    const { id } = await context.params;
    const data = await getSubjectAssessmentsData(id);
    return NextResponse.json({ ok: true, data });
  } catch (error) {
    console.error("subject assessments route error", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unexpected server error." },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest, context: Context) {
  try {
    const { id } = await context.params;
    const offering = await getSchoolSubjectOrThrow(id);
    const body = (await request.json()) as AssessmentCreatePayload;
    const title = asText(body.title);
    const type = asText(body.type);
    const targetClassIds = Array.isArray(body.target_class_ids)
      ? body.target_class_ids.filter(Boolean)
      : [];

    if (!title || !type || targetClassIds.length === 0) {
      return NextResponse.json(
        { error: "Assessment title, type, and target classes are required." },
        { status: 400 },
      );
    }

    const assessmentInsert = await supabaseAdmin
      .from("assessments")
      .insert({
        school_id: offering.school_id,
        school_subject_id: id,
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
        {
          error:
            assessmentInsert.error?.message ?? "Failed to create subject assessment.",
        },
        { status: 500 },
      );
    }

    const schoolSubjectClasses = await supabaseAdmin
      .from("school_subject_classes")
      .select("id, class_id")
      .eq("school_subject_id", id)
      .in("class_id", targetClassIds);

    if (schoolSubjectClasses.error) {
      return NextResponse.json(
        { error: schoolSubjectClasses.error.message },
        { status: 500 },
      );
    }

    const targetsInsert = await supabaseAdmin.from("assessment_targets").insert(
      (schoolSubjectClasses.data ?? []).map((item) => ({
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

    const data = await getSubjectAssessmentsData(id);
    return NextResponse.json({ ok: true, data }, { status: 201 });
  } catch (error) {
    console.error("create subject assessment route error", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unexpected server error." },
      { status: 500 },
    );
  }
}
