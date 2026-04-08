import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  buildTeacherPhotoUrl,
  formatClassLabel,
  TEACHERS_PROFILE_BUCKET,
} from "@/lib/teachers";

type TeacherRow = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  admission_number: string;
  subject_id: number | null;
  school_id: string;
  profile_photo: string | null;
  status: string;
  created_at: string | null;
  days_present: number | null;
  total_school_days: number | null;
  attendance_percentage: number | string | null;
  class_teacher: boolean | null;
};

type SchoolRow = {
  id: string;
  name: string;
};

type SubjectRow = {
  id: number;
  subject_name: string;
};

type ClassRow = {
  id: string;
  class_name: string;
  stream: string | null;
  class_teacher_id: string | null;
};

type TeacherTimetableRow = {
  teacher_id: string;
  class_id: string | null;
};

function asText(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  return text || null;
}

function asNumberValue(value: FormDataEntryValue | null) {
  const parsed = Number(asText(value));
  return Number.isFinite(parsed) ? parsed : null;
}

async function ensureTeacherProfileBucket() {
  const { data, error } = await supabaseAdmin.storage.getBucket(
    TEACHERS_PROFILE_BUCKET,
  );

  if (!error && data) return;

  const { error: createError } = await supabaseAdmin.storage.createBucket(
    TEACHERS_PROFILE_BUCKET,
    {
      public: false,
      fileSizeLimit: 5 * 1024 * 1024,
    },
  );

  if (
    createError &&
    !createError.message.toLowerCase().includes("already exists")
  ) {
    throw new Error(createError.message);
  }
}

async function removeUploadedTeacherPhoto(filePath: string | null) {
  if (!filePath) return;

  await supabaseAdmin.storage.from(TEACHERS_PROFILE_BUCKET).remove([filePath]);
}

async function rollbackTeacherCreate({
  teacherId,
  classId,
  filePath,
}: {
  teacherId: string;
  classId: string | null;
  filePath: string | null;
}) {
  await supabaseAdmin.from("teacher_subjects").delete().eq("teacher_id", teacherId);

  if (classId) {
    await supabaseAdmin
      .from("classes")
      .update({ class_teacher_id: null })
      .eq("id", classId)
      .eq("class_teacher_id", teacherId);
  }

  await supabaseAdmin.from("teachers").delete().eq("id", teacherId);
  await removeUploadedTeacherPhoto(filePath);
}

export async function GET() {
  try {
    const [teachersRes, schoolsRes, subjectsRes, classesRes, timetableRes] =
      await Promise.all([
        supabaseAdmin
          .from("teachers")
          .select(
            `
              id,
              name,
              email,
              phone,
              admission_number,
              subject_id,
              school_id,
              profile_photo,
              status,
              created_at,
              days_present,
              total_school_days,
              attendance_percentage,
              class_teacher
            `,
          )
          .order("created_at", { ascending: false }),
        supabaseAdmin.from("schools").select("id, name"),
        supabaseAdmin.from("subjects").select("id, subject_name"),
        supabaseAdmin
          .from("classes")
          .select("id, class_name, stream, class_teacher_id"),
        supabaseAdmin
          .from("teacher_timetables")
          .select("teacher_id, class_id"),
      ]);

    const firstError =
      teachersRes.error ??
      schoolsRes.error ??
      subjectsRes.error ??
      classesRes.error ??
      timetableRes.error;

    if (firstError) {
      return NextResponse.json({ error: firstError.message }, { status: 500 });
    }

    const teachers = (teachersRes.data as TeacherRow[]) ?? [];
    const schools = (schoolsRes.data as SchoolRow[]) ?? [];
    const subjects = (subjectsRes.data as SubjectRow[]) ?? [];
    const classes = (classesRes.data as ClassRow[]) ?? [];
    const timetableRows = (timetableRes.data as TeacherTimetableRow[]) ?? [];

    const schoolMap = new Map(schools.map((school) => [school.id, school.name]));
    const subjectMap = new Map(
      subjects.map((subject) => [String(subject.id), subject.subject_name]),
    );
    const classMap = new Map(classes.map((classItem) => [classItem.id, classItem]));
    const teacherClassIds = new Map<string, Set<string>>();

    for (const classItem of classes) {
      if (!classItem.class_teacher_id) continue;
      const classIds = teacherClassIds.get(classItem.class_teacher_id) ?? new Set<string>();
      classIds.add(classItem.id);
      teacherClassIds.set(classItem.class_teacher_id, classIds);
    }

    for (const row of timetableRows) {
      if (!row.class_id) continue;
      const classIds = teacherClassIds.get(row.teacher_id) ?? new Set<string>();
      classIds.add(row.class_id);
      teacherClassIds.set(row.teacher_id, classIds);
    }

    return NextResponse.json({
      ok: true,
      data: teachers.map((teacher) => {
        const classLabels = Array.from(teacherClassIds.get(teacher.id) ?? []).map(
          (classId) => formatClassLabel(classMap.get(classId)),
        );

        return {
          ...teacher,
          school_name: schoolMap.get(teacher.school_id) ?? null,
          subject_name: teacher.subject_id
            ? subjectMap.get(String(teacher.subject_id)) ?? null
            : null,
          class_labels: classLabels,
        };
      }),
    });
  } catch (error) {
    console.error("teachers list route error", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unexpected server error." },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  let uploadedFilePath: string | null = null;
  let createdTeacherId: string | null = null;
  let assignedClassId: string | null = null;

  try {
    const formData = await request.formData();

    const name = asText(formData.get("name"));
    const email = asText(formData.get("email"));
    const phone = asText(formData.get("phone"));
    const admissionNumber = asText(formData.get("admission_number"));
    const schoolId = asText(formData.get("school_id"));
    const classId = asText(formData.get("class_id"));
    const subjectId = asNumberValue(formData.get("subject_id"));
    const photo = formData.get("photo");

    if (
      !name ||
      !email ||
      !phone ||
      !admissionNumber ||
      !schoolId ||
      !classId ||
      !subjectId
    ) {
      return NextResponse.json(
        {
          error:
            "Name, email, phone number, teacher ID, school, class, and subject are required.",
        },
        { status: 400 },
      );
    }

    if (!(photo instanceof File) || photo.size === 0) {
      return NextResponse.json(
        { error: "Teacher photo is required." },
        { status: 400 },
      );
    }

    if (!photo.type.startsWith("image/")) {
      return NextResponse.json(
        { error: "Teacher photo must be an image file." },
        { status: 400 },
      );
    }

    if (photo.size > 5 * 1024 * 1024) {
      return NextResponse.json(
        { error: "Teacher photo must be 5MB or smaller." },
        { status: 400 },
      );
    }

    const [schoolRes, classRes, subjectRes, duplicateTeacherRes] =
      await Promise.all([
        supabaseAdmin
          .from("schools")
          .select("id, name")
          .eq("id", schoolId)
          .maybeSingle(),
        supabaseAdmin
          .from("classes")
          .select("id, school_id, class_name, stream, class_teacher_id")
          .eq("id", classId)
          .maybeSingle(),
        supabaseAdmin
          .from("subjects")
          .select("id, subject_name")
          .eq("id", subjectId)
          .maybeSingle(),
        supabaseAdmin
          .from("teachers")
          .select("id")
          .eq("admission_number", admissionNumber)
          .maybeSingle(),
      ]);

    const lookupError =
      schoolRes.error ??
      classRes.error ??
      subjectRes.error ??
      duplicateTeacherRes.error;

    if (lookupError) {
      return NextResponse.json({ error: lookupError.message }, { status: 500 });
    }

    if (!schoolRes.data) {
      return NextResponse.json({ error: "School not found." }, { status: 404 });
    }

    if (!classRes.data || classRes.data.school_id !== schoolId) {
      return NextResponse.json(
        { error: "Selected class does not belong to the chosen school." },
        { status: 400 },
      );
    }

    if (!subjectRes.data) {
      return NextResponse.json({ error: "Subject not found." }, { status: 404 });
    }

    if (duplicateTeacherRes.data) {
      return NextResponse.json(
        { error: "A teacher with that ID already exists." },
        { status: 409 },
      );
    }

    if (classRes.data.class_teacher_id) {
      return NextResponse.json(
        { error: "That class is already assigned to another teacher." },
        { status: 409 },
      );
    }

    await ensureTeacherProfileBucket();

    const safeExtension =
      photo.name.split(".").pop()?.replace(/[^a-zA-Z0-9]/g, "").toLowerCase() ||
      "jpg";

    createdTeacherId = crypto.randomUUID();
    assignedClassId = classId;
    uploadedFilePath = `teachers/${createdTeacherId}/${Date.now()}-${crypto.randomUUID()}.${safeExtension}`;

    const arrayBuffer = await photo.arrayBuffer();

    const { error: uploadError } = await supabaseAdmin.storage
      .from(TEACHERS_PROFILE_BUCKET)
      .upload(uploadedFilePath, arrayBuffer, {
        contentType: photo.type || "application/octet-stream",
        upsert: false,
      });

    if (uploadError) {
      return NextResponse.json({ error: uploadError.message }, { status: 500 });
    }

    const profilePhotoUrl = buildTeacherPhotoUrl(uploadedFilePath);

    const { error: insertTeacherError } = await supabaseAdmin.from("teachers").insert({
      id: createdTeacherId,
      name,
      email,
      phone,
      admission_number: admissionNumber,
      school_id: schoolId,
      profile_photo: profilePhotoUrl,
      status: "active",
      class_teacher: true,
      subject_id: subjectId,
    });

    if (insertTeacherError) {
      await removeUploadedTeacherPhoto(uploadedFilePath);
      return NextResponse.json(
        { error: insertTeacherError.message },
        { status: 500 },
      );
    }

    const { error: classAssignError } = await supabaseAdmin
      .from("classes")
      .update({ class_teacher_id: createdTeacherId })
      .eq("id", classId)
      .is("class_teacher_id", null);

    if (classAssignError) {
      await rollbackTeacherCreate({
        teacherId: createdTeacherId,
        classId,
        filePath: uploadedFilePath,
      });
      return NextResponse.json(
        { error: classAssignError.message },
        { status: 500 },
      );
    }

    const { error: teacherSubjectError } = await supabaseAdmin
      .from("teacher_subjects")
      .insert({
        teacher_id: createdTeacherId,
        subject_id: subjectId,
      });

    if (teacherSubjectError) {
      await rollbackTeacherCreate({
        teacherId: createdTeacherId,
        classId,
        filePath: uploadedFilePath,
      });
      return NextResponse.json(
        { error: teacherSubjectError.message },
        { status: 500 },
      );
    }

    return NextResponse.json(
      {
        ok: true,
        data: {
          id: createdTeacherId,
          teacher: {
            id: createdTeacherId,
            name,
            email,
            phone,
            admission_number: admissionNumber,
            school_id: schoolId,
            school_name: schoolRes.data.name,
            subject_id: subjectId,
            subject_name: subjectRes.data.subject_name,
            profile_photo: profilePhotoUrl,
            class_teacher: true,
            class_labels: [formatClassLabel(classRes.data)],
            status: "active",
          },
        },
      },
      { status: 201 },
    );
  } catch (error) {
    if (createdTeacherId) {
      await rollbackTeacherCreate({
        teacherId: createdTeacherId,
        classId: assignedClassId,
        filePath: uploadedFilePath,
      });
    } else {
      await removeUploadedTeacherPhoto(uploadedFilePath);
    }

    console.error("create teacher route error", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unexpected server error." },
      { status: 500 },
    );
  }
}
