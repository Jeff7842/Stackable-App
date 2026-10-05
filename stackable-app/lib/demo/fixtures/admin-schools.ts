// Schools and user-management handlers (dashboard schools page and the admin-role page).
import type { AdminUser } from "@/hooks/useAdminUsers";
import type { CreateSchoolInput, SchoolActionType, SchoolDetails, SchoolRow, UpdateSchoolInput } from "@/hooks/useSchools";
import { PAGE_KEYS, USER_STATUSES } from "@/lib/validation/shared";
import { route, type DemoRequest } from "../router";
import { CREATED_AT, SCHOOL, seedTeachers, table } from "./data";

const bad = (error: string, code = "BAD_REQUEST", status = 400) => ({ status, body: { error, code } });

const school = (n: number, id: string, name: string, code: string, status: SchoolRow["status"], pkg: string, sub: SchoolRow["subscription_status"], counts: number[]): SchoolDetails => ({
  id,
  school_id: n,
  name,
  code,
  logo: null,
  email: `info@${code.toLowerCase()}.demo.stackable.school`,
  phone_1: `+2542000${String(n).padStart(5, "0")}`,
  head_name: ["Grace Wanjiru", "Hassan Abdi", "Esther Mwikali"][n - 1],
  owner_name: ["Stackable Demo Trust", "Lakeview Education Ltd", "Savanna Ridge Foundation"][n - 1],
  status,
  subscription_package: pkg,
  subscription_status: sub,
  subscription_started_at: "2026-01-05",
  subscription_expires_at: "2026-12-31",
  expected_users: counts[0] + 40,
  expected_teachers: counts[1] + 4,
  expected_admins: 4,
  expected_students: counts[0],
  expected_parents: Math.round(counts[0] * 0.8),
  expected_staff: 10,
  no_of_users: counts[0] + counts[1] + 5,
  no_of_teachers: counts[1],
  no_of_admins: 2,
  no_of_students: counts[0],
  no_of_parents: Math.round(counts[0] * 0.6),
  no_of_staff: 6,
  code_change_count: 0,
  pending_code_change_at: null,
  pending_status_change_at: null,
  phone_2: null,
  phone_3: null,
  location: ["Nairobi", "Kisumu", "Nakuru"][n - 1],
});

export const seedSchools = (): SchoolDetails[] => [
  school(1, SCHOOL.id, SCHOOL.name, SCHOOL.code, "active", "Standard", "active", [24, 6]),
  school(2, "sch-lakeview", "Lakeview Junior Academy", "LAKE", "active", "Starter", "trial", [180, 12]),
  school(3, "sch-savanna", "Savanna Ridge School", "SAVA", "pending", "Standard", "inactive", [0, 0]),
];

export function seedUsers(): AdminUser[] {
  const base = { created_at: CREATED_AT, updated_at: CREATED_AT, school_id: SCHOOL.id, school_code: SCHOOL.code, school_adm: null, phone_2: null, must_change_password: false, schools: { id: SCHOOL.id, name: SCHOOL.name, code: SCHOOL.code }, permissions: [] };
  const staff: Array<[string, string, AdminUser["role"]]> = [["Grace", "Wanjiru", "admin"], ["Peter", "Otieno", "manager"], ["Amina", "Hassan", "parent"], ["Zawadi", "Hassan", "student"]];
  const teachers = seedTeachers().map((t): [string, string, AdminUser["role"]] => [t.name.split(" ")[0], t.name.split(" ")[1], "teacher"]);
  return [...staff, ...teachers].map(([first, last, role], n) => ({
    ...base,
    id: `usr-${String(n + 1).padStart(3, "0")}`,
    email: `${first.toLowerCase()}.${last.toLowerCase()}@demo.stackable.school`,
    phone: 254700000100 + n,
    role,
    status: USER_STATUSES[n % 7 === 6 ? 2 : 0],
    first_name: first,
    last_name: last,
  }));
}

const visibleSchools = ({ db, role }: DemoRequest) => table<SchoolDetails>(db, "schools").filter((s) => role === "super-admin" || s.id === SCHOOL.id);

export function registerAdminSchools(): void {
  route("GET", "/api/school", (req) => ({ data: visibleSchools(req) }));
  route("GET", "/api/admin/schools", (req) => ({ schools: visibleSchools(req).map(({ id, name, code }) => ({ id, name, code, created_at: CREATED_AT })) }));
  route("GET", "/api/school/:id", (req) => {
    const s = visibleSchools(req).find((x) => x.id === req.params.id);
    return s ? { data: s } : bad("School not found.", "NOT_FOUND", 404);
  });
  route("POST", "/api/school", (req) => {
    const input = req.body as CreateSchoolInput | undefined;
    if (!input?.name?.trim()) return bad("School name is required.");
    const list = table<SchoolDetails>(req.db, "schools");
    const n = list.length + 1;
    const code = `${input.name.replace(/[^A-Za-z]/g, "").slice(0, 4).toUpperCase().padEnd(4, "X")}${n}`;
    const created = school(1, `sch-new-${n}`, input.name.trim(), code, "pending", input.subscription_package || "Starter", input.subscription_status || "inactive", [0, 0]);
    Object.assign(created, { school_id: n, email: input.email || null, head_name: input.head_name || null, owner_name: input.owner_name || null, location: input.location || null });
    list.push(created);
    return { status: 201, body: { ok: true, data: { id: created.id, school_id: n, name: created.name, code, email: input.email, status: "pending" }, message: "School created." } };
  });
  route("PATCH", "/api/school/:id", (req) => {
    const s = visibleSchools(req).find((x) => x.id === req.params.id);
    if (!s) return bad("School not found.", "NOT_FOUND", 404);
    Object.assign(s, req.body as UpdateSchoolInput);
    return { ok: true };
  });
  route("POST", "/api/school/:id/actions", (req) => {
    const s = visibleSchools(req).find((x) => x.id === req.params.id);
    if (!s) return bad("School not found.", "NOT_FOUND", 404);
    const action = (req.body as { action?: SchoolActionType } | undefined)?.action;
    if (action === "activate") s.status = "active";
    else if (action === "suspend") s.status = "suspended";
    else if (action === "increase_capacity_50") {
      s.expected_users += 50;
      s.expected_students += 50;
    } else if (action === "regenerate_code") s.code_change_count += 1;
    else return bad("That action is not valid.");
    return { ok: true, message: "Done." };
  });
  route("DELETE", "/api/school/:id", (req) => {
    if (req.role !== "super-admin") return bad("Only a super admin can delete a school.", "FORBIDDEN", 403);
    const list = table<SchoolDetails>(req.db, "schools");
    const at = list.findIndex((x) => x.id === req.params.id);
    if (at < 0) return bad("School not found.", "NOT_FOUND", 404);
    list.splice(at, 1);
    return { ok: true };
  });
  route("POST", "/api/school/logo", () => bad("Logo upload is not available in the demo.", "DEMO_UNAVAILABLE"));
  route("GET", "/api/school/:id/security-codes", () => bad("Security codes are not available in the demo.", "DEMO_UNAVAILABLE"));

  route("GET", "/api/admin/users", (req) => {
    const q = req.url.searchParams;
    const search = (q.get("search") ?? "").toLowerCase();
    const users = table<AdminUser>(req.db, "users").filter(
      (u) =>
        (!q.get("role") || u.role === q.get("role")) &&
        (!q.get("status") || u.status === q.get("status")) &&
        (!q.get("schoolId") || u.school_id === q.get("schoolId")) &&
        (!search || `${u.first_name} ${u.last_name} ${u.email ?? ""}`.toLowerCase().includes(search)),
    );
    return { users, pageKeys: [...PAGE_KEYS] };
  });
  route("POST", "/api/admin/users", (req) => {
    const b = req.body as { first_name?: string; last_name?: string; role?: AdminUser["role"]; email?: string } | undefined;
    if (!b?.first_name || !b.last_name || !b.role) return bad("First name, last name and role are required.");
    const users = table<AdminUser>(req.db, "users");
    const user: AdminUser = {
      ...users[0],
      id: `usr-${String(users.length + 1).padStart(3, "0")}`,
      first_name: b.first_name,
      last_name: b.last_name,
      role: b.role,
      email: b.email || null,
      status: "pending",
      must_change_password: true,
      permissions: undefined,
    };
    users.push(user);
    return { status: 201, body: { user } };
  });
  route("PATCH", "/api/admin/users", (req) => {
    const b = (req.body ?? {}) as Partial<AdminUser> & { id?: string; permissions?: AdminUser["permissions"] };
    const u = table<AdminUser>(req.db, "users").find((x) => x.id === b.id);
    if (!u) return bad("User not found.", "NOT_FOUND", 404);
    for (const key of ["email", "status", "role", "must_change_password", "permissions"] as const) {
      if (b[key] !== undefined) Object.assign(u, { [key]: b[key] });
    }
    return { ok: true };
  });
  route("DELETE", "/api/admin/users", (req) => {
    if (req.role !== "super-admin") return bad("Only a super admin can delete a user.", "FORBIDDEN", 403);
    const users = table<AdminUser>(req.db, "users");
    const at = users.findIndex((x) => x.id === req.url.searchParams.get("id"));
    if (at < 0) return bad("User not found.", "NOT_FOUND", 404);
    users.splice(at, 1);
    return { ok: true };
  });
}
