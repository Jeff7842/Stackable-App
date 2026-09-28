// =============================================================================
// Query keys — the "addresses" TanStack Query uses to cache data.
// -----------------------------------------------------------------------------
// Using one factory means: when we change a teacher, we can reliably refresh
// every "teacher" query by invalidating qk.teachers.all. No guessing strings.
// =============================================================================

export type ListFilters = Record<string, unknown> | undefined;

function entity(name: string) {
  return {
    all: [name] as const,
    list: (filters?: ListFilters) => [name, "list", filters ?? {}] as const,
    detail: (id: string) => [name, "detail", id] as const,
  };
}

export const qk = {
  // The signed-in user's identity (GET /api/auth/me). Invalidate on login/logout/impersonation.
  me: ["me"] as const,
  teachers: entity("teachers"),
  students: entity("students"),
  staff: entity("staff"),
  parents: entity("parents"),
  users: entity("users"),
  schools: entity("schools"),
  subjects: entity("subjects"),
  classes: entity("classes"),
  assessments: entity("assessments"),
  attendance: entity("attendance"),
  grades: entity("grades"),
  notifications: entity("notifications"),
  parent: {
    children: () => ["parent", "children"] as const,
    child: (id: string) => ["parent", "child", id] as const,
  },
  // Wave 2A (CTO pre-registered so the dev + portal UI lanes never collide on this file).
  admin: {
    overview: () => ["admin", "overview"] as const,
  },
  teacher: {
    studentProfile: (id: string) => ["teacher", "student-profile", id] as const,
  },
  // Wave 2B lane portals-ui-b: the signed-in student's own portal data. Own root name so
  // it never collides with the admin `students` list keys (qk.students.list() etc.).
  studentPortal: {
    dashboard: () => ["student-portal", "dashboard"] as const,
    grades: () => ["student-portal", "grades"] as const,
  },
  // Wave 2B lane admin-b (students + teachers admin). Every key starts with the entity
  // name so qk.students.all / qk.teachers.all invalidate them too.
  studentAdmin: {
    formOptions: () => ["students", "form-options"] as const,
  },
  teacherAdmin: {
    formOptions: () => ["teachers", "form-options"] as const,
    editData: (id: string) => ["teachers", "edit-data", id] as const,
    timetable: (id: string) => ["teachers", "timetable", id] as const,
    attendance: (id: string) => ["teachers", "attendance", id] as const,
  },
  dev: {
    all: ["dev"] as const,
    overview: () => ["dev", "overview"] as const,
    schools: (filters?: ListFilters) => ["dev", "schools", filters ?? {}] as const,
    users: (filters?: ListFilters) => ["dev", "users", filters ?? {}] as const,
    audit: (filters?: ListFilters) => ["dev", "audit", filters ?? {}] as const,
  },
} as const;
