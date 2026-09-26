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
} as const;
