import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { SUBJECT_BACKGROUND_BUCKET } from "@/lib/subjects";
import { getSubjectDirectoryData, getSubjectFormOptions } from "@/lib/subjects-server";
import { supabaseAdmin } from "@/lib/supabase/admin";

type SubjectCreatePayload = {
  existing_subject_id?: number | null;
  school_id?: string | null;
  class_ids?: string[];
  teacher_assignments?: Array<{
    teacher_id: string;
    assignment_role: string;
    is_primary?: boolean;
  }>;
  subject_name?: string | null;
  subject_code?: string | null;
  acronym?: string | null;
  short_name?: string | null;
  strapline?: string | null;
  description?: string | null;
  department?: string | null;
  category?: string | null;
  subject_type?: string | null;
  education_level?: string | null;
  requires_lab?: boolean;
  has_coursework?: boolean;
  has_assessments?: boolean;
  is_elective?: boolean;
  is_active?: boolean;
  default_sequence?: number | null;
  theme_token?: string | null;
  abstract_image_url?: string | null;
};

function asText(value: unknown) {
  const text = String(value ?? "").trim();
  return text || null;
}

function asBool(value: unknown, fallback: boolean) {
  return typeof value === "boolean" ? value : fallback;
}

function asNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

async function ensureSubjectBackgroundBucket() {
  const bucket = await supabaseAdmin.storage.getBucket(SUBJECT_BACKGROUND_BUCKET);
  if (!bucket.error && bucket.data) return;

  const created = await supabaseAdmin.storage.createBucket(SUBJECT_BACKGROUND_BUCKET, {
    public: true,
    fileSizeLimit: 8 * 1024 * 1024,
  });

  if (created.error && !created.error.message.toLowerCase().includes("already exists")) {
    throw new Error(created.error.message);
  }
}

export async function GET() {
  try {
    const data = await getSubjectDirectoryData();
    return NextResponse.json({ ok: true, data });
  } catch (error) {
    console.error("subjects directory route error", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unexpected server error." },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    let body: SubjectCreatePayload = {};
    let backgroundImage: File | null = null;
    const contentType = request.headers.get("content-type") ?? "";

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const payload = asText(formData.get("payload"));
      body = payload ? (JSON.parse(payload) as SubjectCreatePayload) : {};
      const uploaded = formData.get("background_image");
      backgroundImage = uploaded instanceof File && uploaded.size > 0 ? uploaded : null;
    } else {
      body = (await request.json()) as SubjectCreatePayload;
    }

    const schoolId = asText(body.school_id);
    const classIds = Array.isArray(body.class_ids) ? body.class_ids.filter(Boolean) : [];
    const teacherAssignments = Array.isArray(body.teacher_assignments)
      ? body.teacher_assignments.filter((item) => item?.teacher_id)
      : [];

    if (!schoolId) {
      return NextResponse.json({ error: "School is required." }, { status: 400 });
    }

    let subjectId = asNumber(body.existing_subject_id);
    let backgroundImageUrl = asText(body.abstract_image_url);

    if (backgroundImage) {
      if (!backgroundImage.type.startsWith("image/")) {
        return NextResponse.json(
          { error: "Subject background must be an image file." },
          { status: 400 },
        );
      }

      if (backgroundImage.size > 8 * 1024 * 1024) {
        return NextResponse.json(
          { error: "Subject background must be 8MB or smaller." },
          { status: 400 },
        );
      }

      await ensureSubjectBackgroundBucket();
      const safeExtension =
        backgroundImage.name.split(".").pop()?.replace(/[^a-zA-Z0-9]/g, "").toLowerCase() ||
        "jpg";
      const uploadedBackgroundPath = `subjects/${subjectId ?? "draft"}/${Date.now()}-${crypto.randomUUID()}.${safeExtension}`;

      const uploaded = await supabaseAdmin.storage
        .from(SUBJECT_BACKGROUND_BUCKET)
        .upload(uploadedBackgroundPath, await backgroundImage.arrayBuffer(), {
          contentType: backgroundImage.type || "application/octet-stream",
          upsert: false,
        });

      if (uploaded.error) {
        return NextResponse.json({ error: uploaded.error.message }, { status: 500 });
      }

      const {
        data: { publicUrl },
      } = supabaseAdmin.storage
        .from(SUBJECT_BACKGROUND_BUCKET)
        .getPublicUrl(uploadedBackgroundPath);
      backgroundImageUrl = publicUrl;
    }

    if (!subjectId) {
      const subjectName = asText(body.subject_name);
      if (!subjectName) {
        return NextResponse.json(
          { error: "Either an existing subject or a subject name is required." },
          { status: 400 },
        );
      }

      const subjectInsert = await supabaseAdmin
        .from("subjects")
        .insert({
          subject_name: subjectName,
          subject_code: asText(body.subject_code),
          acronym: asText(body.acronym),
          short_name: asText(body.short_name),
          strapline: asText(body.strapline),
          description: asText(body.description),
          department: asText(body.department),
          category: asText(body.category) ?? "core",
          subject_type: asText(body.subject_type) ?? "general",
          education_level: asText(body.education_level) ?? "secondary",
          requires_lab: asBool(body.requires_lab, false),
          has_coursework: asBool(body.has_coursework, true),
          has_assessments: asBool(body.has_assessments, true),
          is_elective: asBool(body.is_elective, false),
          is_active: asBool(body.is_active, true),
          default_sequence: asNumber(body.default_sequence),
          theme_token: asText(body.theme_token),
          abstract_image_url: backgroundImageUrl,
        })
        .select("id")
        .single();

      if (subjectInsert.error || !subjectInsert.data) {
        return NextResponse.json(
          { error: subjectInsert.error?.message ?? "Failed to create subject." },
          { status: 500 },
        );
      }

      subjectId = Number(subjectInsert.data.id);
    } else if (backgroundImageUrl != null) {
      const subjectUpdate = await supabaseAdmin
        .from("subjects")
        .update({ abstract_image_url: backgroundImageUrl })
        .eq("id", subjectId);

      if (subjectUpdate.error) {
        return NextResponse.json({ error: subjectUpdate.error.message }, { status: 500 });
      }
    }

    const schoolSubjectLookup = await supabaseAdmin
      .from("school_subjects")
      .select("id, school_id, subject_id")
      .eq("school_id", schoolId)
      .eq("subject_id", subjectId)
      .maybeSingle();

    if (schoolSubjectLookup.error) {
      return NextResponse.json({ error: schoolSubjectLookup.error.message }, { status: 500 });
    }

    let schoolSubjectId = schoolSubjectLookup.data?.id as string | undefined;

    if (!schoolSubjectId) {
      const schoolSubjectInsert = await supabaseAdmin
        .from("school_subjects")
        .insert({ school_id: schoolId, subject_id: subjectId })
        .select("id")
        .single();

      if (schoolSubjectInsert.error || !schoolSubjectInsert.data) {
        return NextResponse.json(
          {
            error:
              schoolSubjectInsert.error?.message ??
              "Failed to create school subject offering.",
          },
          { status: 500 },
        );
      }

      schoolSubjectId = schoolSubjectInsert.data.id as string;
    }

    if (classIds.length > 0) {
      const classesCheck = await supabaseAdmin
        .from("classes")
        .select("id, school_id")
        .in("id", classIds);

      if (classesCheck.error) {
        return NextResponse.json({ error: classesCheck.error.message }, { status: 500 });
      }

      const validClassIds = (classesCheck.data ?? [])
        .filter((item) => item.school_id === schoolId)
        .map((item) => item.id);

      if (validClassIds.length > 0) {
        const classUpsert = await supabaseAdmin.from("school_subject_classes").upsert(
          validClassIds.map((classId, index) => ({
            school_subject_id: schoolSubjectId,
            class_id: classId,
            display_order: index,
          })),
          { onConflict: "school_subject_id,class_id" },
        );

        if (classUpsert.error) {
          return NextResponse.json({ error: classUpsert.error.message }, { status: 500 });
        }
      }
    }

    if (teacherAssignments.length > 0) {
      const teacherIds = teacherAssignments.map((item) => item.teacher_id);
      const teachersCheck = await supabaseAdmin
        .from("teachers")
        .select("id, school_id")
        .in("id", teacherIds);

      if (teachersCheck.error) {
        return NextResponse.json({ error: teachersCheck.error.message }, { status: 500 });
      }

      const validTeachers = new Set(
        (teachersCheck.data ?? [])
          .filter((item) => item.school_id === schoolId)
          .map((item) => item.id),
      );

      const teacherUpsert = await supabaseAdmin.from("teacher_subjects").upsert(
        teacherAssignments
          .filter((item) => validTeachers.has(item.teacher_id))
          .map((item) => ({
            teacher_id: item.teacher_id,
            subject_id: subjectId,
            school_id: schoolId,
            school_subject_id: schoolSubjectId,
            assignment_role: item.assignment_role || "teacher",
            is_primary: Boolean(item.is_primary),
          })),
        { onConflict: "teacher_id,subject_id,school_id" },
      );

      if (teacherUpsert.error) {
        return NextResponse.json({ error: teacherUpsert.error.message }, { status: 500 });
      }
    }

    const options = await getSubjectFormOptions();

    return NextResponse.json(
      {
        ok: true,
        data: {
          id: schoolSubjectId,
          subject_id: subjectId,
          school_id: schoolId,
          options,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("create subject route error", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unexpected server error." },
      { status: 500 },
    );
  }
}
