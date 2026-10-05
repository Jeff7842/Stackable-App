// Subjects handlers: directory, detail, assessments and coursework for the admin subjects pages.
import type {
  AssessmentTimelineItem,
  CourseworkOutlineNode,
  SubjectAssessmentsPayload,
  SubjectCourseworkPayload,
  SubjectDetailPayload,
  SubjectDirectoryCard,
  SubjectDirectoryPayload,
  SubjectResourceCard,
} from "@/lib/subjects";
import { scoreToGrade } from "@/lib/subjects";
import type { CreateSubjectPayload } from "@/hooks/useSubjects";
import type { StudentListItem } from "@/lib/dto/students";
import { route, type DemoRequest } from "../router";
import { CLASSES, SCHOOL, SUBJECTS, TERM, scorePct, seedTeachers, studentIndex, table } from "./data";

const bad = (error: string, code = "BAD_REQUEST", status = 400) => ({ status, body: { error, code } });
const notFound = () => bad("Subject not found.", "SUBJECT_NOT_FOUND", 404);
const mean = (xs: number[]) => (xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 100) / 100 : null);
const offeredIn = [2, 3, 4].map((c) => CLASSES[c]);

export function seedSubjects(): SubjectDirectoryCard[] {
  const teachers = seedTeachers();
  const ids = Array.from({ length: 24 }, (_, i) => i);
  return SUBJECTS.map((s, n) => {
    const scores = ids.map((i) => scorePct(i, n));
    const t = teachers.find((x) => x.subject_id === s.id) ?? teachers[0];
    return {
      id: `sub-${s.id}`,
      schoolId: SCHOOL.id,
      schoolName: SCHOOL.name,
      subjectId: s.id,
      title: s.name,
      subjectCode: s.code,
      acronym: s.code.slice(0, 3),
      shortName: s.name.split(" ")[0],
      strapline: `${s.name} for Grades 6 to 8`,
      description: `The ${s.name} programme at ${SCHOOL.name}.`,
      department: n < 3 ? "Languages and Maths" : "Sciences and Humanities",
      category: "core",
      subjectType: "general",
      educationLevel: "junior-secondary",
      requiresLab: s.id === 4,
      hasCoursework: true,
      hasAssessments: true,
      isElective: false,
      isActive: true,
      themeToken: ["amber", "lime", "coral", "ocean", "violet"][n % 5],
      abstractImageUrl: null,
      classes: offeredIn.map((c) => ({ id: c.id, label: c.label })),
      teachers: [{ id: t.id, name: t.name, profilePhoto: null, role: "lead" }],
      totalStudents: 24,
      totalTeachers: 1,
      averageScore: mean(scores),
      schoolRank: n + 1,
      latestTerm: TERM,
    };
  });
}

function directory(db: DemoRequest["db"]): SubjectDirectoryPayload {
  const cards = table<SubjectDirectoryCard>(db, "subjects");
  return {
    cards,
    options: {
      schools: [{ id: SCHOOL.id, name: SCHOOL.name }],
      classes: CLASSES.map(({ id, school_id, class_name, stream }) => ({ id, school_id, class_name, stream })),
      teachers: seedTeachers().map((t) => ({ id: t.id, school_id: SCHOOL.id, name: t.name, email: t.email, phone: t.phone, profile_photo: null })),
      masterSubjects: SUBJECTS.map((s) => ({ id: s.id, subject_name: s.name, subject_code: s.code })),
      departments: [...new Set(cards.map((c) => c.department).filter((d): d is string => Boolean(d)))],
    },
  };
}

function detail(db: DemoRequest["db"], card: SubjectDirectoryCard): SubjectDetailPayload {
  const n = SUBJECTS.findIndex((s) => s.id === card.subjectId);
  const teacher = seedTeachers().find((t) => t.id === card.teachers[0]?.id);
  const students = table<StudentListItem>(db, "students").filter((s) => s.status !== "removed");
  const avg = card.averageScore;
  const row = teacher && {
    id: teacher.id, name: teacher.name, email: teacher.email, phone: teacher.phone, profilePhoto: null, role: "lead", isPrimary: true,
    classes: teacher.class_labels, learnerAverage: avg,
  };
  return {
    ...card,
    category: String(card.category),
    subjectType: String(card.subjectType),
    educationLevel: String(card.educationLevel),
    headOfDepartment: row ?? null,
    statSummary: { totalStudents: students.length, totalTeachers: card.totalTeachers, averageScore: avg, schoolRank: card.schoolRank, latestTerm: TERM, teacherStudentRatio: students.length },
    classPerformance: CLASSES.map((c) => {
      const score = mean(students.filter((s) => s.class_id === c.id).map((s) => scorePct(studentIndex(s.id), n)));
      return { id: `${card.id}-${c.id}`, classId: c.id, classLabel: c.label, averageScore: score, averageGrade: score === null ? null : scoreToGrade(score) };
    }),
    teachers: row ? [row] : [],
    students: students.map((s) => {
      const score = scorePct(studentIndex(s.id), n);
      return { id: s.id, fullName: s.full_name, admissionNo: s.admission_no, classLabel: s.class_label ?? "Unassigned", avgScore: score, grade: scoreToGrade(score), teacherName: teacher?.name ?? null, profilePhoto: null, status: s.status };
    }),
    performanceTrend: ["Term 3 2025", "Term 1 2026", TERM].map((label, k) => ({ label, averageScore: avg === null ? null : avg - 4 + k * 2, recentAverage: avg })),
  };
}

function assessments(db: DemoRequest["db"], card: SubjectDirectoryCard): SubjectAssessmentsPayload {
  const all = (db.assessments ??= {}) as Record<string, SubjectAssessmentsPayload>;
  if (!all[card.id]) {
    const item = (key: string, title: string, status: string, start: string, score: number | null): AssessmentTimelineItem => ({
      id: `${card.id}-${key}`, assessmentId: `${card.id}-${key}`, title, description: null, type: "cat", term: TERM,
      classId: offeredIn[0].id, classLabel: offeredIn[0].label, teacherId: card.teachers[0]?.id ?? null, teacherName: card.teachers[0]?.name ?? null,
      scheduledStartAt: start, scheduledEndAt: start.replace("T09:00", "T09:40"), durationMinutes: 40, status,
      startedAt: score === null ? null : start, completedAt: score === null ? null : start, lingerUntil: null,
      averageScore: score, averageGrade: score === null ? null : scoreToGrade(score), hasPublishedResults: score !== null, progressPct: score === null ? 0 : 100,
    });
    all[card.id] = {
      subjectId: card.id,
      upcoming: [item("cat2", `${card.title} CAT 2`, "scheduled", new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10) + "T09:00:00", null)],
      past: [item("cat1", `${card.title} CAT 1`, "published", "2026-06-12T09:00:00", card.averageScore)],
    };
  }
  return all[card.id];
}

function node(id: string, parentId: string | null, title: string, depth: number, state: CourseworkOutlineNode["completionState"], children: CourseworkOutlineNode[] = []): CourseworkOutlineNode {
  return { id, parentId, title, nodeType: depth ? "subtopic" : "topic", sortOrder: 0, depth, completionState: state, completedAt: null, children };
}

function coursework(db: DemoRequest["db"], card: SubjectDirectoryCard): SubjectCourseworkPayload {
  const all = (db.coursework ??= {}) as Record<string, SubjectCourseworkPayload>;
  if (!all[card.id]) {
    const curriculumByClass: SubjectCourseworkPayload["curriculumByClass"] = {};
    const resourcesByClass: SubjectCourseworkPayload["resourcesByClass"] = {};
    const classOfferings = offeredIn.map((c, k) => {
      const id = `${card.id}-${c.id}`;
      curriculumByClass[id] = [
        node(`${id}-t1`, null, "Topic 1: Foundations", 0, "complete", [node(`${id}-t1a`, `${id}-t1`, "Key ideas", 1, "complete")]),
        node(`${id}-t2`, null, "Topic 2: Applications", 0, "partial", [node(`${id}-t2a`, `${id}-t2`, "Worked examples", 1, "partial")]),
        node(`${id}-t3`, null, "Topic 3: Revision", 0, "pending"),
      ];
      const res = (key: string, type: string, title: string, url: string | null): SubjectResourceCard => ({
        id: `${id}-${key}`, curriculumNodeId: null, resourceType: type, title, shortDescription: null, authorName: "Demo teacher", coverImageUrl: null,
        storagePath: null, fileUrl: null, sourceUrl: url, visibility: "public", uploadedBy: card.teachers[0]?.name ?? null, uploadedAt: "2026-05-04T09:00:00.000Z",
      });
      resourcesByClass[id] = [res("r1", "link", `${card.title} revision playlist`, "https://example.com/revision"), res("r2", "document", `${card.title} notes`, null)];
      return { id, classId: c.id, classLabel: c.label, progressPct: 40 + k * 15, currentNodeId: `${id}-t2` };
    });
    all[card.id] = { subjectId: card.id, title: card.title, strapline: card.strapline, description: card.description, abstractImageUrl: null, schoolId: SCHOOL.id, schoolName: SCHOOL.name, classOfferings, curriculumByClass, resourcesByClass };
  }
  return all[card.id];
}

export function registerSubjects(): void {
  const card = (req: DemoRequest) => table<SubjectDirectoryCard>(req.db, "subjects").find((c) => c.id === req.params.id);

  route("GET", "/api/subjects", ({ db }) => ({ ok: true, data: directory(db) }));
  // A multipart create arrives with no readable body in the browser demo, so it answers 400.
  route("POST", "/api/subjects", ({ db, body }) => {
    const p = body as CreateSubjectPayload | undefined;
    if (!p) return bad("Adding a subject is not available in the demo.", "DEMO_UNAVAILABLE");
    const cards = table<SubjectDirectoryCard>(db, "subjects");
    const title = p.subject_name?.trim() || SUBJECTS.find((s) => s.id === p.existing_subject_id)?.name;
    if (!title) return bad("A subject name is required.");
    if (cards.some((c) => c.title.toLowerCase() === title.toLowerCase())) return bad("That subject already exists.", "SUBJECT_DUPLICATE", 409);
    const created: SubjectDirectoryCard = { ...cards[0], id: `sub-new-${cards.length + 1}`, subjectId: 100 + cards.length, title, subjectCode: p.subject_code ?? null, teachers: [], totalTeachers: 0, totalStudents: 0, averageScore: null, schoolRank: null };
    cards.push(created);
    return { ok: true, data: { id: created.id, subject_id: created.subjectId, school_id: SCHOOL.id, options: directory(db).options } };
  });
  route("GET", "/api/subjects/:id", (req) => {
    const c = card(req);
    return c ? { ok: true, data: detail(req.db, c) } : notFound();
  });
  route("GET", "/api/subjects/:id/assessments", (req) => {
    const c = card(req);
    return c ? { ok: true, data: assessments(req.db, c) } : notFound();
  });
  route("POST", "/api/subjects/:id/assessments", (req) => {
    const c = card(req);
    if (!c) return notFound();
    const b = req.body as { type?: string; title?: string; target_class_ids?: string[]; scheduled_start_at?: string | null; duration_minutes?: number | null } | undefined;
    if (!b?.title?.trim() || !b.type) return bad("A type and title are required.");
    const targets = CLASSES.filter((k) => b.target_class_ids?.includes(k.id));
    if (!targets.length) return bad("Choose at least one class.", "ASSESSMENT_TARGETS_INVALID");
    const data = assessments(req.db, c);
    targets.forEach((k) =>
      data.upcoming.push({
        id: `${c.id}-new-${data.upcoming.length}`, assessmentId: `${c.id}-new-${data.upcoming.length}`, title: b.title!.trim(), description: null, type: b.type!, term: TERM,
        classId: k.id, classLabel: k.label, teacherId: c.teachers[0]?.id ?? null, teacherName: c.teachers[0]?.name ?? null,
        scheduledStartAt: b.scheduled_start_at ?? null, scheduledEndAt: null, durationMinutes: b.duration_minutes || null, status: "scheduled",
        startedAt: null, completedAt: null, lingerUntil: null, averageScore: null, averageGrade: null, hasPublishedResults: false, progressPct: 0,
      }),
    );
    return { ok: true, data };
  });
  route("GET", "/api/subjects/:id/coursework", (req) => {
    const c = card(req);
    if (!c) return notFound();
    const data = coursework(req.db, c);
    const only = req.url.searchParams.get("class_offering_id");
    if (!only) return { ok: true, data };
    return { ok: true, data: { ...data, curriculumByClass: { [only]: data.curriculumByClass[only] ?? [] }, resourcesByClass: { [only]: data.resourcesByClass[only] ?? [] } } };
  });
  // Topic and resource creation are multipart, which the demo cannot read.
  route("POST", "/api/subjects/:id/coursework", () => bad("Adding topics and resources is not available in the demo.", "DEMO_UNAVAILABLE"));
  route("PATCH", "/api/subjects/:id/coursework", (req) => {
    const c = card(req);
    if (!c) return notFound();
    const data = coursework(req.db, c);
    const b = (req.body ?? {}) as { action?: string; school_subject_class_id?: string; current_node_id?: string | null; syllabus_progress_pct?: number; resource_id?: string; next_visibility?: string };
    if (b.action === "update_progress") {
      const offering = data.classOfferings.find((o) => o.id === b.school_subject_class_id);
      if (!offering) return bad("That class is not part of this subject.", "SUBJECT_CLASS_NOT_FOUND", 404);
      if (b.current_node_id !== undefined) offering.currentNodeId = b.current_node_id;
      if (typeof b.syllabus_progress_pct === "number") offering.progressPct = Math.max(0, Math.min(100, b.syllabus_progress_pct));
    } else if (b.action === "toggle_visibility") {
      const resource = Object.values(data.resourcesByClass).flat().find((r) => r.id === b.resource_id);
      if (!resource) return bad("That resource is not part of this subject.", "SUBJECT_RESOURCE_NOT_FOUND", 404);
      resource.visibility = b.next_visibility === "public" ? "public" : "private";
    } else return bad("That action is not valid.");
    return { ok: true, data };
  });
}
