// =============================================================================
// Teacher admin repository (Prisma + PostgreSQL) — the school-admin view of teachers.
// -----------------------------------------------------------------------------
// Implements TeacherAdminStore. Rows go through lib/mappers/teacher-admin.mapper.ts
// so the JSON is plain (no Date/BigInt). Every query is scoped by schoolId.
// Multi-row writes run inside one interactive transaction: all or nothing.
// =============================================================================

import { prisma } from "@/lib/db/prisma";
import { ApiError, notFound } from "@/lib/api/errors";
import { timeToDate, toIso, toNumber } from "@/lib/admin-normalize";
import { averagePointsFromCounts } from "@/lib/grade-points";
import {
  diffTeacherSubjects,
  toAttendanceData,
  toEditData,
  toSubjectOptions,
  toTeacherListItem,
  toTimetableData,
  type TeacherRaw,
} from "@/lib/mappers/teacher-admin.mapper";
import type { TeacherFormOptions, TeacherProfileData, TimetableWriteRow } from "@/lib/dto/teachers";
import type { TeacherAdminStore, TeacherCreatePlan, TeacherWritePlan } from "@/lib/services/teacher-admin.store";
import { formatClassLabel, scoreToGrade } from "@/lib/teachers";

const TEACHER_SELECT = {
  id: true,
  name: true,
  email: true,
  phone: true,
  admission_number: true,
  subject_id: true,
  school_id: true,
  profile_photo: true,
  status: true,
  created_at: true,
  days_present: true,
  total_school_days: true,
  attendance_percentage: true,
  class_teacher: true,
} as const;

const CLASS_SELECT = { id: true, school_id: true, class_name: true, stream: true, class_teacher_id: true } as const;

const TIMETABLE_SELECT = {
  id: true,
  teacher_id: true,
  class_id: true,
  subject_id: true,
  day_of_week: true,
  start_time: true,
  end_time: true,
  room: true,
  item_type: true,
  title: true,
  notes: true,
  created_at: true,
} as const;

/** Row limits: every list here is bounded (a school never has this many classes or timetable items). */
const MAX_CLASSES = 500;
const MAX_SUBJECTS = 2000;
const MAX_SLOTS = 500;
const MAX_PUPILS = 2000;

const findTeacher = (schoolId: string, teacherId: string) =>
  prisma.teachers.findFirst({ where: { id: teacherId, school_id: schoolId }, select: TEACHER_SELECT });

const schoolName = async (schoolId: string) =>
  (await prisma.schools.findUnique({ where: { id: schoolId }, select: { name: true } }))?.name ?? null;

const timetableInsertRows = (schoolId: string, teacherId: string, slots: TimetableWriteRow[]) =>
  slots.map((slot) => ({
    teacher_id: teacherId,
    school_id: schoolId,
    class_id: slot.class_id,
    subject_id: slot.subject_id === null ? null : BigInt(slot.subject_id),
    day_of_week: slot.day_of_week,
    start_time: timeToDate(slot.start_time),
    end_time: timeToDate(slot.end_time),
    room: slot.room,
    item_type: slot.item_type,
    title: slot.title,
    notes: slot.notes,
  }));

export const teacherAdminPrismaStore: TeacherAdminStore = {
  listTeachers,
  getProfile: getTeacherProfile,
  getFormOptions: getTeacherFormOptions,

  async teacherExists(schoolId, teacherId) {
    const found = await prisma.teachers.findFirst({ where: { id: teacherId, school_id: schoolId }, select: { id: true } });
    return found !== null;
  },

  async findCreateContext(schoolId, classId, subjectId) {
    const [school, klass, subject] = await Promise.all([
      prisma.schools.findUnique({ where: { id: schoolId }, select: { id: true, name: true } }),
      prisma.classes.findFirst({ where: { id: classId, school_id: schoolId }, select: CLASS_SELECT }),
      prisma.subjects.findUnique({ where: { id: BigInt(subjectId) }, select: { id: true, subject_name: true } }),
    ]);
    return { school, klass, subject: subject ? { id: Number(subject.id), subject_name: subject.subject_name } : null };
  },

  async createTeacher(plan: TeacherCreatePlan) {
    await prisma.$transaction(
      async (tx) => {
        await tx.teachers.create({
          data: {
            id: plan.id,
            school_id: plan.schoolId,
            name: plan.name,
            email: plan.email,
            phone: plan.phone,
            admission_number: plan.admissionNumber,
            profile_photo: plan.profilePhoto,
            status: "active",
            class_teacher: true,
            subject_id: BigInt(plan.subjectId),
          },
        });

        // Conditional claim: two admins creating teachers for one class cannot both win.
        const claimed = await tx.classes.updateMany({
          where: { id: plan.classId, school_id: plan.schoolId, class_teacher_id: null },
          data: { class_teacher_id: plan.id },
        });
        if (claimed.count !== 1) {
          throw new ApiError(409, "That class is already assigned to another teacher.", { code: "CLASS_TEACHER_TAKEN" });
        }

        const offering = await tx.school_subjects.findFirst({
          where: { school_id: plan.schoolId, subject_id: BigInt(plan.subjectId) },
          select: { id: true },
        });
        await tx.teacher_subjects.create({
          data: {
            teacher_id: plan.id,
            school_id: plan.schoolId,
            subject_id: BigInt(plan.subjectId),
            is_primary: true,
            school_subject_id: offering?.id ?? null,
          },
        });
      },
      { timeout: 15_000 },
    );
  },

  async getTeacherRow(schoolId, teacherId) {
    const row = await prisma.teachers.findFirst({
      where: { id: teacherId, school_id: schoolId },
      select: {
        id: true,
        school_id: true,
        name: true,
        email: true,
        phone: true,
        admission_number: true,
        subject_id: true,
        profile_photo: true,
        status: true,
        class_teacher: true,
      },
    });
    return row ? { ...row, subject_id: toNumber(row.subject_id) } : null;
  },

  async getTeacherListItem(schoolId, teacherId) {
    const teacher = await findTeacher(schoolId, teacherId);
    if (!teacher) return null;

    const [name, subject, ownedClasses, timetableRows] = await Promise.all([
      schoolName(schoolId),
      teacher.subject_id === null
        ? Promise.resolve(null)
        : prisma.subjects.findUnique({ where: { id: teacher.subject_id }, select: { subject_name: true } }),
      prisma.classes.findMany({ where: { school_id: schoolId, class_teacher_id: teacherId }, select: CLASS_SELECT, take: MAX_CLASSES }),
      prisma.teacher_timetables.findMany({ where: { teacher_id: teacherId, school_id: schoolId }, select: { class_id: true }, take: MAX_SLOTS }),
    ]);

    const timetableClassIds = timetableRows.map((row) => row.class_id);
    const extraIds = timetableClassIds.filter((id): id is string => Boolean(id) && !ownedClasses.some((item) => item.id === id));
    const extraClasses = extraIds.length
      ? await prisma.classes.findMany({ where: { id: { in: extraIds }, school_id: schoolId }, select: CLASS_SELECT })
      : [];

    return toTeacherListItem(teacher, {
      schoolName: name,
      subjectName: subject?.subject_name ?? null,
      ownedClasses,
      timetableClassIds,
      classesById: new Map([...ownedClasses, ...extraClasses].map((item) => [item.id, item])),
    });
  },

  async getEditData(schoolId, teacherId) {
    const teacher = await findTeacher(schoolId, teacherId);
    if (!teacher) return null;

    const [name, subjects, classes, timetable, bridge] = await Promise.all([
      schoolName(schoolId),
      prisma.subjects.findMany({ select: { id: true, subject_name: true }, orderBy: { subject_name: "asc" }, take: MAX_SUBJECTS }),
      prisma.classes.findMany({ where: { school_id: schoolId }, select: CLASS_SELECT, take: MAX_CLASSES }),
      prisma.teacher_timetables.findMany({ where: { teacher_id: teacherId, school_id: schoolId }, select: TIMETABLE_SELECT, take: MAX_SLOTS }),
      prisma.teacher_subjects.findMany({
        where: { teacher_id: teacherId, school_id: schoolId },
        orderBy: [{ is_primary: "desc" }, { created_at: "asc" }],
        select: { subject_id: true },
        take: 100,
      }),
    ]);

    return toEditData({
      teacher,
      schoolName: name,
      subjects,
      classes,
      bridgeSubjectIds: bridge.map((row) => row.subject_id),
      timetable,
    });
  },

  async getTimetable(schoolId, teacherId) {
    const teacher = await findTeacher(schoolId, teacherId);
    if (!teacher) return null;

    const [timetable, classes, subjects] = await Promise.all([
      prisma.teacher_timetables.findMany({ where: { teacher_id: teacherId, school_id: schoolId }, select: TIMETABLE_SELECT, take: MAX_SLOTS }),
      prisma.classes.findMany({ where: { school_id: schoolId }, select: CLASS_SELECT, take: MAX_CLASSES }),
      prisma.subjects.findMany({ select: { id: true, subject_name: true }, orderBy: { subject_name: "asc" }, take: MAX_SUBJECTS }),
    ]);
    return toTimetableData({ teacher, timetable, classes, subjects });
  },

  async getAttendance(schoolId, teacherId, limit) {
    const teacher = await findTeacher(schoolId, teacherId);
    if (!teacher) return null;

    const where = { school_id: schoolId, user_type: "teacher", user_id: teacherId };
    const [subject, groups, records] = await Promise.all([
      teacher.subject_id === null
        ? Promise.resolve(null)
        : prisma.subjects.findUnique({ where: { id: teacher.subject_id }, select: { subject_name: true } }),
      prisma.attendance.groupBy({ by: ["status"], where, _count: { _all: true } }),
      prisma.attendance.findMany({
        where,
        orderBy: { clock_in: "desc" },
        take: limit,
        select: { id: true, reference_code: true, clock_in: true, clock_out: true, status: true, remarks: true, created_at: true },
      }),
    ]);

    return toAttendanceData({
      teacher,
      subjectName: subject?.subject_name ?? null,
      groups: groups.map((group) => ({ status: group.status, count: group._count._all })),
      records,
      limit,
    });
  },

  async findIdentityConflicts({ email, admissionNumber, excludeTeacherId }) {
    const [byEmail, byAdmission] = await Promise.all([
      email === undefined
        ? Promise.resolve(null)
        : prisma.teachers.findFirst({
            where: { email, ...(excludeTeacherId ? { id: { not: excludeTeacherId } } : {}) },
            select: { id: true },
          }),
      admissionNumber === undefined
        ? Promise.resolve(null)
        : prisma.teachers.findFirst({
            where: { admission_number: admissionNumber, ...(excludeTeacherId ? { id: { not: excludeTeacherId } } : {}) },
            select: { id: true },
          }),
    ]);
    return { email: byEmail !== null, admission_number: byAdmission !== null };
  },

  async listClasses(schoolId) {
    return prisma.classes.findMany({ where: { school_id: schoolId }, select: CLASS_SELECT, take: MAX_CLASSES });
  },

  async findSubjects(ids) {
    if (ids.length === 0) return [];
    const rows = await prisma.subjects.findMany({
      where: { id: { in: ids.map((id) => BigInt(id)) } },
      select: { id: true, subject_name: true },
    });
    return toSubjectOptions(rows);
  },

  async applyUpdate(plan: TeacherWritePlan) {
    const { schoolId, teacherId, fields } = plan;

    await prisma.$transaction(
      async (tx) => {
        // 1. Teacher columns. updateMany + school filter = a foreign id can never be written.
        const { subject_id, ...columns } = fields;
        const data = {
          ...columns,
          ...(subject_id !== undefined ? { subject_id: subject_id === null ? null : BigInt(subject_id) } : {}),
        };
        if (Object.keys(data).length > 0) {
          const updated = await tx.teachers.updateMany({ where: { id: teacherId, school_id: schoolId }, data });
          if (updated.count !== 1) throw notFound("Teacher not found.");
        }

        // 2. Class ownership: release everything this teacher led, then claim the chosen class.
        //    The claim is conditional, so two admins racing for one class cannot both win.
        if (plan.classOwnership !== undefined) {
          await tx.classes.updateMany({
            where: { school_id: schoolId, class_teacher_id: teacherId },
            data: { class_teacher_id: null },
          });
          if (plan.classOwnership !== null) {
            const claimed = await tx.classes.updateMany({
              where: {
                id: plan.classOwnership,
                school_id: schoolId,
                OR: [{ class_teacher_id: null }, { class_teacher_id: teacherId }],
              },
              data: { class_teacher_id: teacherId },
            });
            if (claimed.count !== 1) {
              throw new ApiError(409, "That class is already assigned to another teacher.", { code: "CLASS_TEACHER_TAKEN" });
            }
          }
        }

        // 3. Subjects: touch only the rows that change, so assignment_role / school_subject_id survive.
        if (plan.subjectIds !== undefined) {
          const existing = await tx.teacher_subjects.findMany({
            where: { teacher_id: teacherId, school_id: schoolId },
            select: { subject_id: true },
          });
          const diff = diffTeacherSubjects(
            existing.map((row) => ({ subject_id: Number(row.subject_id) })),
            plan.subjectIds,
          );

          if (diff.toDelete.length > 0) {
            await tx.teacher_subjects.deleteMany({
              where: { teacher_id: teacherId, school_id: schoolId, subject_id: { in: diff.toDelete.map((id) => BigInt(id)) } },
            });
          }
          if (diff.toInsert.length > 0) {
            // Link each new row to the school's own offering of that subject when there is one.
            const offerings = await tx.school_subjects.findMany({
              where: { school_id: schoolId, subject_id: { in: diff.toInsert.map((id) => BigInt(id)) } },
              select: { id: true, subject_id: true },
            });
            const offeringBySubject = new Map(offerings.map((row) => [Number(row.subject_id), row.id]));
            await tx.teacher_subjects.createMany({
              data: diff.toInsert.map((id) => ({
                teacher_id: teacherId,
                school_id: schoolId,
                subject_id: BigInt(id),
                is_primary: false,
                school_subject_id: offeringBySubject.get(id) ?? null,
              })),
            });
          }
          await tx.teacher_subjects.updateMany({
            where: { teacher_id: teacherId, school_id: schoolId },
            data: { is_primary: false },
          });
          if (diff.primary !== null) {
            await tx.teacher_subjects.updateMany({
              where: { teacher_id: teacherId, school_id: schoolId, subject_id: BigInt(diff.primary) },
              data: { is_primary: true },
            });
          }
        }

        // 4. Timetable: replace the whole week.
        if (plan.timetable !== undefined) {
          await tx.teacher_timetables.deleteMany({ where: { teacher_id: teacherId, school_id: schoolId } });
          if (plan.timetable.length > 0) {
            await tx.teacher_timetables.createMany({ data: timetableInsertRows(schoolId, teacherId, plan.timetable) });
          }
        }
      },
      { timeout: 15_000 },
    );
  },

  async replaceTimetable(schoolId, teacherId, slots) {
    await prisma.$transaction(
      async (tx) => {
        await tx.teacher_timetables.deleteMany({ where: { teacher_id: teacherId, school_id: schoolId } });
        if (slots.length > 0) {
          await tx.teacher_timetables.createMany({ data: timetableInsertRows(schoolId, teacherId, slots) });
        }
      },
      { timeout: 15_000 },
    );
  },

  countGradingReports(teacherId) {
    return prisma.grading_reports.count({ where: { teacher_id: teacherId } });
  },

  async deleteTeacher(schoolId, teacherId) {
    const result = await prisma.teachers.deleteMany({ where: { id: teacherId, school_id: schoolId } });
    return result.count === 1;
  },
};

// ---- list, profile and form options (the read endpoints that existed before) ----

const MAX_TEACHERS = 5000;
const MAX_TIMETABLE_LINKS = 50_000;

/**
 * Every teacher of the school with school name, subject name and class labels
 * (classes they lead first, then classes in their timetable): the rows of GET /api/teachers.
 * Scoped queries only (the older listTeachersWithMeta() read every school's classes).
 */
async function listTeachers(schoolId: string) {
  const [teachers, name, subjects, classes, timetableRows] = await Promise.all([
    prisma.teachers.findMany({
      where: { school_id: schoolId },
      orderBy: { created_at: "desc" },
      take: MAX_TEACHERS,
      select: TEACHER_SELECT,
    }),
    schoolName(schoolId),
    prisma.subjects.findMany({ select: { id: true, subject_name: true }, take: MAX_SUBJECTS }),
    prisma.classes.findMany({ where: { school_id: schoolId }, select: CLASS_SELECT, take: MAX_CLASSES }),
    prisma.teacher_timetables.findMany({
      where: { school_id: schoolId },
      orderBy: [{ created_at: "asc" }, { id: "asc" }],
      take: MAX_TIMETABLE_LINKS,
      select: { teacher_id: true, class_id: true },
    }),
  ]);

  const subjectNames = new Map(subjects.map((row) => [Number(row.id), row.subject_name]));
  const classesById = new Map(classes.map((item) => [item.id, item]));
  const ownedByTeacher = new Map<string, typeof classes>();
  for (const item of classes) {
    if (!item.class_teacher_id) continue;
    ownedByTeacher.set(item.class_teacher_id, [...(ownedByTeacher.get(item.class_teacher_id) ?? []), item]);
  }
  const timetableByTeacher = new Map<string, Array<string | null>>();
  for (const row of timetableRows) {
    timetableByTeacher.set(row.teacher_id, [...(timetableByTeacher.get(row.teacher_id) ?? []), row.class_id]);
  }

  return teachers.map((teacher) => {
    const subjectId = toNumber(teacher.subject_id);
    return toTeacherListItem(teacher, {
      schoolName: name,
      subjectName: subjectId === null ? null : (subjectNames.get(subjectId) ?? null),
      ownedClasses: ownedByTeacher.get(teacher.id) ?? [],
      timetableClassIds: timetableByTeacher.get(teacher.id) ?? [],
      classesById,
    });
  });
}

/** `data` of GET /api/teachers/form-options for one school (only the caller's school is returned). */
async function getTeacherFormOptions(schoolId: string): Promise<TeacherFormOptions> {
  const [schools, classes, subjects] = await Promise.all([
    prisma.schools.findMany({ where: { id: schoolId }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.classes.findMany({ where: { school_id: schoolId }, select: CLASS_SELECT, orderBy: { class_name: "asc" }, take: MAX_CLASSES }),
    prisma.subjects.findMany({ select: { id: true, subject_name: true }, orderBy: { subject_name: "asc" }, take: MAX_SUBJECTS }),
  ]);
  return {
    schools,
    classes,
    subjects: subjects.map((row) => ({ id: Number(row.id), subject_name: row.subject_name })),
  };
}

/**
 * `data` of GET /api/teachers/[id]: the teacher plus the pupils of every class they
 * lead or teach, each with an average grade. Returns null when the teacher is not in the school.
 */
async function getTeacherProfile(schoolId: string, teacherId: string): Promise<TeacherProfileData | null> {
  const teacher = await findTeacher(schoolId, teacherId);
  if (!teacher) return null;

  const [name, bridge, ownedClasses, timetableRows] = await Promise.all([
    schoolName(schoolId),
    prisma.teacher_subjects.findMany({ where: { teacher_id: teacherId, school_id: schoolId }, select: { subject_id: true }, take: 100 }),
    prisma.classes.findMany({ where: { school_id: schoolId, class_teacher_id: teacherId }, select: CLASS_SELECT, take: MAX_CLASSES }),
    prisma.teacher_timetables.findMany({ where: { teacher_id: teacherId, school_id: schoolId }, select: { class_id: true }, take: MAX_SLOTS }),
  ]);

  const subjectIds = Array.from(
    new Set([
      ...(teacher.subject_id === null ? [] : [teacher.subject_id]),
      ...bridge.map((row) => row.subject_id),
    ]),
  );
  const classIds = Array.from(
    new Set([
      ...ownedClasses.map((item) => item.id),
      ...timetableRows.map((row) => row.class_id).filter((id): id is string => Boolean(id)),
    ]),
  );

  const [subjects, classes, students] = await Promise.all([
    subjectIds.length
      ? prisma.subjects.findMany({ where: { id: { in: subjectIds } }, select: { id: true, subject_name: true } })
      : Promise.resolve([]),
    classIds.length
      ? prisma.classes.findMany({ where: { id: { in: classIds }, school_id: schoolId }, select: CLASS_SELECT })
      : Promise.resolve([]),
    classIds.length
      ? prisma.students.findMany({
          where: { class_id: { in: classIds }, school_id: schoolId },
          take: MAX_PUPILS,
          select: {
            id: true,
            admission_no: true,
            class_id: true,
            phone: true,
            phone2: true,
            status: true,
            first_name: true,
            last_name: true,
            profile_picture: true,
          },
        })
      : Promise.resolve([]),
  ]);

  const gradeGroups = students.length
    ? await prisma.grading_reports.groupBy({
        by: ["student_id", "grade"],
        where: { student_id: { in: students.map((student) => student.id) } },
        _count: { _all: true },
      })
    : [];
  const gradesByStudent = new Map<string, Array<{ grade: string; count: number }>>();
  for (const group of gradeGroups) {
    const list = gradesByStudent.get(group.student_id) ?? [];
    list.push({ grade: group.grade, count: group._count._all });
    gradesByStudent.set(group.student_id, list);
  }

  const classMap = new Map(classes.map((item) => [item.id, item]));
  const pupils = students
    .map((student) => {
      const avgScore = averagePointsFromCounts(gradesByStudent.get(student.id) ?? []);
      return {
        id: student.id,
        full_name: `${student.first_name ?? ""} ${student.last_name ?? ""}`.trim() || "Unnamed student",
        admission_no: student.admission_no,
        class_id: student.class_id,
        class_name: formatClassLabel(student.class_id ? classMap.get(student.class_id) : null),
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
      return scoreGap !== 0 ? scoreGap : left.full_name.localeCompare(right.full_name);
    });

  const raw: TeacherRaw = teacher;
  return {
    teacher: {
      id: raw.id,
      name: raw.name,
      email: raw.email,
      phone: raw.phone,
      admission_number: raw.admission_number,
      subject_id: toNumber(raw.subject_id),
      school_id: raw.school_id,
      profile_photo: raw.profile_photo,
      status: raw.status,
      created_at: toIso(raw.created_at as Date | null),
      days_present: raw.days_present,
      total_school_days: raw.total_school_days,
      attendance_percentage: toNumber(raw.attendance_percentage),
      class_teacher: raw.class_teacher,
      school_name: name,
      subjects: toSubjectOptions(subjects),
      classes: classes.map((item) => ({ id: item.id, label: formatClassLabel(item) })),
      students_count: pupils.length,
    },
    students: pupils,
  };
}
