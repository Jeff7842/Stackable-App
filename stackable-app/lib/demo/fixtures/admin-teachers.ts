// School admin handlers for teachers: directory, profile, edit data, timetable, attendance, update, delete.
import type { StudentListItem } from "@/lib/dto/students";
import {
  MAX_TIMETABLE_SLOTS,
  TEACHER_STATUSES,
  TIMETABLE_DAYS,
  type ClassOption,
  type TeacherAttendanceData,
  type TeacherEditData,
  type TeacherFormOptions,
  type TeacherListItem,
  type TeacherProfileData,
  type TeacherUpdateInput,
  type TimetableConflict,
  type TimetableSlot,
  type TimetableSlotInput,
} from "@/lib/dto/teachers";
import { route, type DemoRequest } from "../router";
import { CLASSES, SCHOOL, SUBJECTS, studentAvgGrade, studentAvgPct, studentIndex, table } from "./data";

const bad = (error: string, code = "BAD_REQUEST", status = 400, details?: unknown) => ({ status, body: { error, code, details } });
const subjectOptions = () => SUBJECTS.map((s) => ({ id: s.id, subject_name: s.name }));
const teachers = (db: DemoRequest["db"]) => table<TeacherListItem>(db, "teachers");
const classOfLabel = (label: string) => CLASSES.find((c) => c.label === label);

/** The class a teacher leads is the first class on their row, when they are a class teacher. */
const ledClass = (t: TeacherListItem) => (t.class_teacher ? classOfLabel(t.class_labels[0] ?? "")?.id ?? null : null);

function classOptions(all: TeacherListItem[]): ClassOption[] {
  return CLASSES.map((c) => ({ ...c, class_teacher_id: all.find((t) => ledClass(t) === c.id)?.id ?? null }));
}

function defaultSlots(t: TeacherListItem): TimetableSlot[] {
  const classes = t.class_labels.map((l) => classOfLabel(l)).filter((c) => c !== undefined);
  if (!classes.length) return [];
  return TIMETABLE_DAYS.slice(0, 5).map((day, d) => ({
    id: `slot-${t.id}-${d}`,
    teacher_id: t.id,
    class_id: classes[d % classes.length].id,
    subject_id: t.subject_id,
    day_of_week: day,
    start_time: "08:00",
    end_time: "08:40",
    room: `Room ${d + 1}`,
    item_type: "class",
    title: null,
    notes: null,
    created_at: null,
  }));
}

function slotsOf(db: DemoRequest["db"], t: TeacherListItem): TimetableSlot[] {
  const saved = (db.timetables ?? {}) as Record<string, TimetableSlot[]>;
  return saved[t.id] ?? defaultSlots(t);
}

function conflictsOf(slots: Array<Pick<TimetableSlot, "day_of_week" | "start_time" | "end_time">>): TimetableConflict[] {
  const out: TimetableConflict[] = [];
  slots.forEach((a, i) =>
    slots.forEach((b, j) => {
      if (j <= i || a.day_of_week !== b.day_of_week) return;
      if (a.start_time < b.end_time && b.start_time < a.end_time) {
        out.push({ day_of_week: a.day_of_week, first_index: i, second_index: j, message: `Two slots overlap on ${a.day_of_week}.` });
      }
    }),
  );
  return out;
}

/** Validate and store a whole timetable; returns an error answer or the saved slots. */
function saveSlots(db: DemoRequest["db"], t: TeacherListItem, input: TimetableSlotInput[]) {
  if (!Array.isArray(input) || input.length > MAX_TIMETABLE_SLOTS) return bad("The timetable is not valid.");
  for (const s of input) {
    const okDay = (TIMETABLE_DAYS as readonly string[]).includes(s.day_of_week);
    if (!okDay || !/^\d{2}:\d{2}$/.test(s.start_time) || !/^\d{2}:\d{2}$/.test(s.end_time) || s.start_time >= s.end_time) {
      return bad("Each slot needs a day and a start time before its end time.");
    }
  }
  const slots: TimetableSlot[] = input.map((s, n) => {
    const isClass = (s.item_type ?? "class") === "class";
    return {
      id: `slot-${t.id}-${Date.now().toString(36)}-${n}`,
      teacher_id: t.id,
      class_id: isClass ? s.class_id ?? null : null,
      subject_id: isClass ? s.subject_id ?? null : null,
      day_of_week: s.day_of_week,
      start_time: s.start_time,
      end_time: s.end_time,
      room: s.room ?? null,
      item_type: s.item_type ?? "class",
      title: isClass ? null : s.title ?? null,
      notes: s.notes ?? null,
      created_at: null,
    };
  });
  ((db.timetables ??= {}) as Record<string, TimetableSlot[]>)[t.id] = slots;
  return { slots, conflicts: conflictsOf(slots) };
}

function profile(db: DemoRequest["db"], t: TeacherListItem): TeacherProfileData {
  const classes = t.class_labels.map((l) => classOfLabel(l)).filter((c) => c !== undefined);
  const pupils = table<StudentListItem>(db, "students").filter((s) => classes.some((c) => c.id === s.class_id));
  return {
    teacher: {
      ...t,
      subjects: subjectOptions().filter((s) => s.id === t.subject_id),
      classes: classes.map((c) => ({ id: c.id, label: c.label })),
      students_count: pupils.length,
    },
    students: pupils.map((s) => {
      const i = studentIndex(s.id);
      return {
        id: s.id,
        full_name: s.full_name,
        admission_no: s.admission_no,
        class_id: s.class_id,
        class_name: s.class_label ?? "",
        phone: s.phone,
        phone2: s.phone2,
        status: s.status,
        profile_picture: s.profile_picture,
        avg_score: i >= 0 ? Math.round((studentAvgPct(i) / 100) * 120) / 10 : null,
        grade: i >= 0 ? studentAvgGrade(i) : "-",
      };
    }),
  };
}

function editData(db: DemoRequest["db"], t: TeacherListItem): TeacherEditData {
  const slots = slotsOf(db, t);
  const led = ledClass(t);
  const assigned = new Set([...slots.map((s) => s.class_id).filter((c): c is string => c !== null), ...(led ? [led] : [])]);
  return {
    teacher: { ...t, class_teacher: Boolean(t.class_teacher), attendance_percentage: t.attendance_percentage },
    subjects: subjectOptions(),
    classes: classOptions(teachers(db)),
    assigned_subject_ids: t.subject_id === null ? [] : [t.subject_id],
    class_teacher_class_id: led,
    assigned_class_ids: [...assigned],
    timetable: slots,
  };
}

function attendance(t: TeacherListItem): TeacherAttendanceData {
  const records = Array.from({ length: 12 }, (_, d) => {
    const status = d % 6 === 5 ? "late" : "present";
    const day = new Date(Date.now() - d * 86_400_000).toISOString().slice(0, 10);
    return {
      id: `att-${t.id}-${d}`,
      reference_code: `ATT-${day.replaceAll("-", "")}-${t.id.slice(-3)}`,
      clock_in: `${day}T0${status === "late" ? 8 : 7}:${status === "late" ? "25" : "40"}:00.000Z`,
      clock_out: `${day}T14:30:00.000Z`,
      status,
      remarks: null,
      created_at: `${day}T07:40:00.000Z`,
    };
  });
  const late = records.filter((r) => r.status === "late").length;
  return {
    teacher: { ...t, class_teacher: Boolean(t.class_teacher) },
    summary: { total: records.length, present: records.length - late, late, absent: 0 },
    records,
    truncated: false,
  };
}

function applyUpdate(db: DemoRequest["db"], t: TeacherListItem, input: TeacherUpdateInput) {
  const all = teachers(db);
  if (input.status !== undefined && !(TEACHER_STATUSES as readonly string[]).includes(input.status)) return bad("That status is not valid.");
  if (input.email && all.some((o) => o.id !== t.id && o.email?.toLowerCase() === input.email?.toLowerCase())) {
    return bad("That email is already used by another teacher.", "TEACHER_EMAIL_TAKEN", 409);
  }
  if (input.admission_number && all.some((o) => o.id !== t.id && o.admission_number === input.admission_number)) {
    return bad("That teacher ID is already in use.", "TEACHER_ID_TAKEN", 409);
  }
  if (input.class_teacher_class_id) {
    const cls = CLASSES.find((c) => c.id === input.class_teacher_class_id);
    if (!cls) return bad("That class does not exist.");
    const holder = all.find((o) => o.id !== t.id && ledClass(o) === cls.id);
    if (holder) return bad(`${cls.label} already has a class teacher.`, "CLASS_TEACHER_TAKEN", 409);
    t.class_labels = [cls.label, ...t.class_labels.filter((l) => l !== cls.label)];
    t.class_teacher = true;
  } else if (input.class_teacher_class_id === null) {
    t.class_teacher = false;
  }
  if (input.name !== undefined) t.name = input.name.trim() || t.name;
  if (input.email !== undefined) t.email = input.email.trim() || t.email;
  if (input.phone !== undefined) t.phone = input.phone;
  if (input.admission_number !== undefined) t.admission_number = input.admission_number.trim() || t.admission_number;
  if (input.status !== undefined) t.status = input.status;
  if (input.subject_ids?.length) {
    t.subject_id = input.subject_ids[0];
    t.subject_name = SUBJECTS.find((s) => s.id === t.subject_id)?.name ?? null;
  }
  if (input.timetable) {
    const saved = saveSlots(db, t, input.timetable);
    if ("status" in saved) return saved;
    return { conflicts: saved.conflicts };
  }
  return { conflicts: [] as TimetableConflict[] };
}

export function registerAdminTeachers(): void {
  route("GET", "/api/teachers", ({ db }) => ({ ok: true, data: teachers(db) }));
  route("GET", "/api/teachers/form-options", ({ db }) => {
    const data: TeacherFormOptions = {
      schools: [{ id: SCHOOL.id, name: SCHOOL.name }],
      classes: classOptions(teachers(db)).map(({ id, school_id, class_name, stream, class_teacher_id }) => ({ id, school_id, class_name, stream, class_teacher_id })),
      subjects: subjectOptions(),
    };
    return { ok: true, data };
  });
  // Teacher creation sends a photo as multipart, which the in-browser demo cannot read.
  route("POST", "/api/teachers", () => bad("Adding a teacher is not available in the demo.", "DEMO_UNAVAILABLE"));

  const find = (req: DemoRequest) => teachers(req.db).find((t) => t.id === req.params.id);
  const missing = () => bad("Teacher not found.", "NOT_FOUND", 404);
  route("GET", "/api/teachers/:id", (req) => {
    const t = find(req);
    return t ? { ok: true, data: profile(req.db, t) } : missing();
  });
  route("GET", "/api/teachers/:id/edit-data", (req) => {
    const t = find(req);
    return t ? { ok: true, data: editData(req.db, t) } : missing();
  });
  route("GET", "/api/teachers/:id/attendance", (req) => {
    const t = find(req);
    return t ? { ok: true, data: attendance(t) } : missing();
  });
  route("GET", "/api/teachers/:id/timetable", (req) => {
    const t = find(req);
    if (!t) return missing();
    const { id, name, email, phone, admission_number, profile_photo, status, class_teacher } = t;
    const teacher = { id, name, email, phone, admission_number, profile_photo, status, class_teacher: Boolean(class_teacher) };
    return { ok: true, data: { teacher, slots: slotsOf(req.db, t), classes: classOptions(teachers(req.db)), subjects: subjectOptions() } };
  });
  route("PUT", "/api/teachers/:id/timetable", (req) => {
    const t = find(req);
    if (!t) return missing();
    const saved = saveSlots(req.db, t, (req.body as { slots?: TimetableSlotInput[] } | undefined)?.slots ?? []);
    return "status" in saved ? saved : { ok: true, data: saved };
  });
  route("PATCH", "/api/teachers/:id", (req) => {
    const t = find(req);
    if (!t) return missing();
    const result = applyUpdate(req.db, t, (req.body ?? {}) as TeacherUpdateInput);
    return "status" in result ? result : { ok: true, data: { id: t.id, teacher: t, timetable_conflicts: result.conflicts } };
  });
  route("DELETE", "/api/teachers/:id", (req) => {
    const t = find(req);
    if (!t) return missing();
    if (req.url.searchParams.get("force") !== "true") {
      return bad("This teacher has grading results that would be deleted too.", "TEACHER_HAS_GRADING_REPORTS", 409, { grading_reports: 24 });
    }
    const list = teachers(req.db);
    list.splice(list.indexOf(t), 1);
    return { ok: true, data: { id: t.id } };
  });
}
