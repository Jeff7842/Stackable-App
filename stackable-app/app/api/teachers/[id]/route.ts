import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { formatClassLabel, numericScore, scoreToGrade } from "@/lib/teachers";

type Context = {
  params: Promise<{ id: string }>;
};

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

type TeacherSubjectBridgeRow = {
  subject_id: number;
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
  class_id: string | null;
};

type SchoolRow = {
  id: string;
  name: string;
};

type StudentRow = {
  id: string;
  admission_no: string;
  class_id: string | null;
  phone: string | null;
  phone2: string | null;
  status: string;
  first_name: string | null;
  last_name: string | null;
  profile_picture: string | null;
};

type StudentAverageGradeRow = {
  student_id: string;
  avg_score: number | string | null;
};

function getStudentName(student: StudentRow) {
  const fullName = `${student.first_name ?? ""} ${student.last_name ?? ""}`.trim();
  return fullName || "Unnamed student";
}

export async function GET(_: NextRequest, context: Context) {
  try {
    const { id } = await context.params;

    const teacherRes = await supabaseAdmin
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
      .eq("id", id)
      .maybeSingle();

    if (teacherRes.error) {
      return NextResponse.json({ error: teacherRes.error.message }, { status: 500 });
    }

    if (!teacherRes.data) {
      return NextResponse.json({ error: "Teacher not found." }, { status: 404 });
    }

    const teacher = teacherRes.data as TeacherRow;

    const [schoolRes, bridgeRes, ownedClassesRes, timetableRes] =
      await Promise.all([
        supabaseAdmin
          .from("schools")
          .select("id, name")
          .eq("id", teacher.school_id)
          .maybeSingle(),
        supabaseAdmin
          .from("teacher_subjects")
          .select("subject_id")
          .eq("teacher_id", id),
        supabaseAdmin
          .from("classes")
          .select("id, class_name, stream, class_teacher_id")
          .eq("class_teacher_id", id),
        supabaseAdmin
          .from("teacher_timetables")
          .select("class_id")
          .eq("teacher_id", id),
      ]);

    const bootstrapError =
      schoolRes.error ?? bridgeRes.error ?? ownedClassesRes.error ?? timetableRes.error;

    if (bootstrapError) {
      return NextResponse.json({ error: bootstrapError.message }, { status: 500 });
    }

    const subjectIds = Array.from(
      new Set(
        [
          teacher.subject_id,
          ...(((bridgeRes.data as TeacherSubjectBridgeRow[]) ?? []).map((row) =>
            Number(row.subject_id),
          ) ?? []),
        ].filter((value): value is number => Number.isFinite(value)),
      ),
    );

    const ownedClasses = (ownedClassesRes.data as ClassRow[]) ?? [];
    const timetableRows = (timetableRes.data as TeacherTimetableRow[]) ?? [];
    const classIds = Array.from(
      new Set(
        [
          ...ownedClasses.map((classItem) => classItem.id),
          ...timetableRows
            .map((row) => row.class_id)
            .filter((value): value is string => Boolean(value)),
        ],
      ),
    );

    const [subjectsRes, classesRes, studentsRes] = await Promise.all([
      subjectIds.length
        ? supabaseAdmin
            .from("subjects")
            .select("id, subject_name")
            .in("id", subjectIds)
        : Promise.resolve({ data: [], error: null }),
      classIds.length
        ? supabaseAdmin
            .from("classes")
            .select("id, class_name, stream, class_teacher_id")
            .in("id", classIds)
        : Promise.resolve({ data: [], error: null }),
      classIds.length
        ? supabaseAdmin
            .from("students")
            .select(
              `
                id,
                admission_no,
                class_id,
                phone,
                phone2,
                status,
                first_name,
                last_name,
                profile_picture
              `,
            )
            .in("class_id", classIds)
        : Promise.resolve({ data: [], error: null }),
    ]);

    const relatedError = subjectsRes.error ?? classesRes.error ?? studentsRes.error;

    if (relatedError) {
      return NextResponse.json({ error: relatedError.message }, { status: 500 });
    }

    const students = (studentsRes.data as StudentRow[]) ?? [];
    const studentIds = students.map((student) => student.id);

    const averagesRes = studentIds.length
      ? await supabaseAdmin
          .from("student_average_grade")
          .select("student_id, avg_score")
          .in("student_id", studentIds)
      : { data: [], error: null };

    if (averagesRes.error) {
      return NextResponse.json({ error: averagesRes.error.message }, { status: 500 });
    }

    const school = (schoolRes.data as SchoolRow | null) ?? null;
    const subjects = (subjectsRes.data as SubjectRow[]) ?? [];
    const classes = (classesRes.data as ClassRow[]) ?? [];
    const averages = (averagesRes.data as StudentAverageGradeRow[]) ?? [];

    const classMap = new Map(classes.map((classItem) => [classItem.id, classItem]));
    const averageMap = new Map(
      averages.map((row) => [row.student_id, numericScore(row.avg_score)]),
    );

    const payloadStudents = students
      .map((student) => {
        const avgScore = averageMap.get(student.id) ?? null;

        return {
          id: student.id,
          full_name: getStudentName(student),
          admission_no: student.admission_no,
          class_id: student.class_id,
          class_name: formatClassLabel(
            student.class_id ? classMap.get(student.class_id) : null,
          ),
          phone: student.phone,
          phone2: student.phone2,
          status: student.status,
          profile_picture: student.profile_picture,
          avg_score: avgScore,
          grade: scoreToGrade(avgScore),
        };
      })
      .sort((left, right) => {
        const scoreGap = (right.avg_score ?? -1) - (left.avg_score ?? -1);
        if (scoreGap !== 0) return scoreGap;
        return left.full_name.localeCompare(right.full_name);
      });

    return NextResponse.json({
      ok: true,
      data: {
        teacher: {
          ...teacher,
          school_name: school?.name ?? null,
          subjects,
          classes: classes.map((classItem) => ({
            id: classItem.id,
            label: formatClassLabel(classItem),
          })),
          students_count: payloadStudents.length,
        },
        students: payloadStudents,
      },
    });
  } catch (error) {
    console.error("teacher detail route error", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unexpected server error." },
      { status: 500 },
    );
  }
}
