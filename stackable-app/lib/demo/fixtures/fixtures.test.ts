import { beforeAll, describe, expect, it } from "vitest";
import { normalizeChildCards, normalizeChildOverview, normalizeGrades, normalizeStudentDashboard } from "@/components/portal/student/normalize";
import type { AdminUsersResponse } from "@/hooks/useAdminUsers";
import type { SchoolsResponse } from "@/hooks/useSchools";
import type { StudentListData, StudentProfile } from "@/lib/dto/students";
import type { TeacherEditData, TeacherListItem, TeacherProfileData, TeacherUpdateResult } from "@/lib/dto/teachers";
import type { DevOverview, DevPage, DevUserRow } from "@/lib/dev-types";
import type { AdminOverviewData, TeacherPortalData, TeacherStudent, TeacherStudentProfile } from "@/lib/repositories/portal-types";
import type { SubjectAssessmentsPayload, SubjectCourseworkPayload, SubjectDetailPayload, SubjectDirectoryPayload } from "@/lib/subjects";
import type { Role } from "@/lib/validation/shared";
import { handleDemoRequest } from "../router";
import type { DemoDb } from "../store";
import { registerDemoHandlers, seedDb } from "./index";

type Out<T = unknown> = { status: number; body: T };
type Env<T> = { ok: true; data: T };

function client(role: Role) {
  const db: DemoDb = seedDb(role);
  const call = <T = unknown>(method: string, path: string, body?: unknown): Out<T> =>
    handleDemoRequest(method, new URL(path, "http://demo.local"), body, role, db) as Out<T>;
  return { db, call };
}

beforeAll(() => registerDemoHandlers());

describe("demo seed", () => {
  it("is identical on every run", () => {
    expect(JSON.stringify(seedDb("admin"))).toBe(JSON.stringify(seedDb("admin")));
  });
});

describe("parent portal", () => {
  const { call } = client("parent");

  it("lists the two linked children", () => {
    const res = call<Env<unknown>>("GET", "/api/parent/children");
    expect(res.status).toBe(200);
    const cards = normalizeChildCards(res.body.data);
    expect(cards).toHaveLength(2);
    expect(cards[0]).toMatchObject({ studentId: "stu-001", firstName: "Zawadi", lastName: "Hassan", subjectCount: 8 });
  });

  it("returns a child overview and refuses a child that is not linked", () => {
    const ok = call<Env<unknown>>("GET", "/api/parent/children/stu-002");
    expect(ok.status).toBe(200);
    const overview = normalizeChildOverview(ok.body.data);
    expect(overview.grades.length).toBeGreaterThan(0);
    expect(overview.attendance.total).toBe(40);
    expect(call("GET", "/api/parent/children/stu-005").status).toBe(403);
    expect(call("GET", "/api/parent/children/not-an-id").status).toBe(400);
  });
});

describe("student portal", () => {
  const { call } = client("student");

  it("serves the dashboard and grades", () => {
    const dash = call<Env<unknown>>("GET", "/api/student/dashboard");
    expect(dash.status).toBe(200);
    const data = normalizeStudentDashboard(dash.body.data);
    expect(data.student.lastName).toBe("Hassan");
    expect(data.subjects).toHaveLength(8);
    expect(data.today.lessons.length).toBeGreaterThan(0);
    const grades = call<Env<unknown>>("GET", "/api/student/grades");
    expect(normalizeGrades(grades.body.data)).toHaveLength(8);
  });
});

describe("teacher portal", () => {
  const { call } = client("teacher");

  it("serves portal data for the teacher's own classes", () => {
    const res = call<Env<TeacherPortalData>>("GET", "/api/teach/portal-data");
    expect(res.status).toBe(200);
    expect(res.body.data.teacher.name).toBe("Mercy Achieng");
    expect(res.body.data.classes).toHaveLength(3);
    expect(res.body.data.studentCount).toBe(12);
  });

  it("lists assigned students and opens only their profiles", () => {
    const list = call<Env<{ students: TeacherStudent[]; total: number }>>("GET", "/api/teach/students");
    expect(list.body.data.total).toBe(12);
    const profile = call<Env<TeacherStudentProfile>>("GET", "/api/teach/students/stu-001");
    expect(profile.status).toBe(200);
    expect(profile.body.data.grades.length).toBe(8);
    expect(call("GET", "/api/teach/students/stu-003").status).toBe(404);
  });
});

describe("school admin: overview and students", () => {
  const { call } = client("admin");

  it("serves the overview", () => {
    const res = call<Env<AdminOverviewData>>("GET", "/api/admin/overview");
    expect(res.status).toBe(200);
    expect(res.body.data.totals).toMatchObject({ students: 24, teachers: 6, classes: 6, subjects: 8 });
    expect(res.body.data.attendanceTrend).toHaveLength(7);
  });

  it("lists, updates and deletes students for the session", () => {
    const list = call<Env<StudentListData>>("GET", "/api/students");
    expect(list.body.data).toMatchObject({ total: 24, truncated: false });
    expect(list.body.data.counts).toMatchObject({ all: 24, pending: 1 });

    const patch = call("PATCH", "/api/students/stu-003", { status: "suspended", class_id: "cls-7a" });
    expect(patch.status).toBe(200);
    expect(call("PATCH", "/api/students/stu-003", { status: "bogus" }).status).toBe(400);
    const profile = call<Env<StudentProfile>>("GET", "/api/students/stu-003");
    expect(profile.body.data.student).toMatchObject({ status: "suspended", class_label: "Grade 7 A" });
    expect(profile.body.data.guardians.length).toBeGreaterThan(0);

    expect(call("DELETE", "/api/students/stu-003").status).toBe(200);
    expect(call("GET", "/api/students/stu-003").status).toBe(404);
    expect(call<Env<StudentListData>>("GET", "/api/students").body.data.total).toBe(23);
    expect(call("GET", "/api/students/form-options").status).toBe(200);
  });
});

describe("school admin: teachers", () => {
  const { call } = client("admin");

  it("serves the directory, profile, edit data, timetable and attendance", () => {
    const list = call<Env<TeacherListItem[]>>("GET", "/api/teachers");
    expect(list.body.data).toHaveLength(6);
    expect(call<Env<TeacherProfileData>>("GET", "/api/teachers/tch-001").body.data.students).toHaveLength(12);
    const edit = call<Env<TeacherEditData>>("GET", "/api/teachers/tch-001/edit-data");
    expect(edit.body.data.timetable.length).toBeGreaterThan(0);
    expect(call("GET", "/api/teachers/tch-001/timetable").status).toBe(200);
    expect(call("GET", "/api/teachers/tch-001/attendance").status).toBe(200);
    expect(call("GET", "/api/teachers/form-options").status).toBe(200);
    expect(call("GET", "/api/teachers/tch-999").status).toBe(404);
  });

  it("updates a teacher, rejects a taken class and needs force to delete", () => {
    const upd = call<Env<TeacherUpdateResult>>("PATCH", "/api/teachers/tch-003", { status: "on_leave" });
    expect(upd.body.data.teacher.status).toBe("on_leave");
    const taken = call("PATCH", "/api/teachers/tch-003", { class_teacher_class_id: "cls-7a" });
    expect(taken).toMatchObject({ status: 409, body: { code: "CLASS_TEACHER_TAKEN" } });
    expect(call("DELETE", "/api/teachers/tch-003")).toMatchObject({ status: 409, body: { code: "TEACHER_HAS_GRADING_REPORTS" } });
    expect(call("DELETE", "/api/teachers/tch-003?force=true").status).toBe(200);
    expect(call<Env<TeacherListItem[]>>("GET", "/api/teachers").body.data).toHaveLength(5);
  });

  it("saves a timetable and reports overlaps", () => {
    const slot = { day_of_week: "monday", start_time: "08:00", end_time: "09:00", item_type: "event", title: "Staff meeting" };
    const res = call<Env<{ slots: unknown[]; conflicts: unknown[] }>>("PUT", "/api/teachers/tch-001/timetable", { slots: [slot, { ...slot, start_time: "08:30", end_time: "09:30" }] });
    expect(res.body.data.conflicts).toHaveLength(1);
    expect(call("PUT", "/api/teachers/tch-001/timetable", { slots: [{ ...slot, end_time: "07:00" }] }).status).toBe(400);
  });
});

describe("school admin: subjects", () => {
  const { call } = client("admin");

  it("serves the directory, detail, assessments and coursework", () => {
    const dir = call<Env<SubjectDirectoryPayload>>("GET", "/api/subjects");
    expect(dir.body.data.cards).toHaveLength(8);
    expect(dir.body.data.options.masterSubjects.length).toBe(8);
    const detail = call<Env<SubjectDetailPayload>>("GET", "/api/subjects/sub-1");
    expect(detail.body.data).toMatchObject({ title: "Mathematics" });
    expect(detail.body.data.students).toHaveLength(24);
    const assess = call<Env<SubjectAssessmentsPayload>>("GET", "/api/subjects/sub-1/assessments");
    expect(assess.body.data.past.length + assess.body.data.upcoming.length).toBeGreaterThan(0);
    const work = call<Env<SubjectCourseworkPayload>>("GET", "/api/subjects/sub-1/coursework");
    expect(work.body.data.classOfferings.length).toBeGreaterThan(0);
    expect(call("GET", "/api/subjects/nope").status).toBe(404);
  });

  it("keeps assessment and progress changes for the session", () => {
    const made = call<Env<SubjectAssessmentsPayload>>("POST", "/api/subjects/sub-2/assessments", { type: "quiz", title: "Vocabulary quiz", target_class_ids: ["cls-7a"] });
    expect(made.body.data.upcoming.some((a) => a.title === "Vocabulary quiz")).toBe(true);
    const offering = call<Env<SubjectCourseworkPayload>>("GET", "/api/subjects/sub-2/coursework").body.data.classOfferings[0];
    call("PATCH", "/api/subjects/sub-2/coursework", { action: "update_progress", school_subject_class_id: offering.id, syllabus_progress_pct: 90 });
    const after = call<Env<SubjectCourseworkPayload>>("GET", "/api/subjects/sub-2/coursework").body.data;
    expect(after.classOfferings[0].progressPct).toBe(90);
  });
});

describe("schools and users", () => {
  it("shows an admin only their own school but a super admin all of them", () => {
    expect(client("admin").call<SchoolsResponse>("GET", "/api/school").body.data).toHaveLength(1);
    const sa = client("super-admin");
    expect(sa.call<SchoolsResponse>("GET", "/api/school").body.data).toHaveLength(3);
    const created = sa.call("POST", "/api/school", { name: "Mombasa Bay School", email: "a@b.co" });
    expect(created.status).toBe(201);
    expect(sa.call<SchoolsResponse>("GET", "/api/school").body.data).toHaveLength(4);
    expect(client("admin").call("DELETE", "/api/school/sch-lakeview").status).toBe(403);
  });

  it("filters the admin user list", () => {
    const res = client("admin").call<AdminUsersResponse>("GET", "/api/admin/users?role=teacher&search=mercy");
    expect(res.body.users).toHaveLength(1);
  });
});

describe("developer console", () => {
  const { call } = client("super-admin");

  it("serves overview, schools, users and audit with paging", () => {
    const ov = call<Env<DevOverview>>("GET", "/api/dev/overview");
    expect(ov.body.data.counts.schools).toBe(3);
    expect(ov.body.data.services).toHaveLength(5);
    const schools = call<Env<DevPage<unknown>>>("GET", "/api/dev/schools?q=lake");
    expect(schools.body.data.total).toBe(1);
    const users = call<Env<DevPage<DevUserRow>>>("GET", "/api/dev/users?role=teacher&pageSize=2&page=2");
    expect(users.body.data).toMatchObject({ page: 2, pageSize: 2, total: 6 });
    expect(users.body.data.items).toHaveLength(2);
    const audit = call<Env<DevPage<{ action: string }>>>("GET", "/api/dev/audit?action=impersonation.");
    expect(audit.body.data.total).toBeGreaterThan(0);
    expect(audit.body.data.items.every((a) => a.action.startsWith("impersonation."))).toBe(true);
  });

  it("refuses impersonation with a clear message", () => {
    expect(call("POST", "/api/dev/impersonate/start", {})).toMatchObject({ status: 400, body: { code: "DEMO_UNAVAILABLE" } });
  });
});
