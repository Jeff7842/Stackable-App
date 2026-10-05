// Demo fixtures: seed data plus the handlers that serve it. Add one module per domain.
import { ROLE_DASHBOARD, ROLE_HOME, type Role } from "@/lib/validation/shared";
import { route } from "../router";
import type { DemoDb } from "../store";
import { registerAdmin } from "./admin";
import { registerAdminSchools, seedSchools, seedUsers } from "./admin-schools";
import { registerAdminTeachers } from "./admin-teachers";
import { seedStudents, seedTeachers } from "./data";
import { registerDev, seedAudit } from "./dev";
import { registerParent } from "./parent";
import { registerStudent } from "./student";
import { registerSubjects, seedSubjects } from "./subjects";
import { registerTeacher } from "./teacher";

export const DEMO_SCHOOL = { id: "demo-school", code: "DEMO", name: "Stackable Demo Academy" };

const NAMES: Record<Role, [string, string]> = {
  "super-admin": ["Sam", "Platform"],
  admin: ["Grace", "Wanjiru"],
  manager: ["Peter", "Otieno"],
  teacher: ["Mercy", "Achieng"],
  "dept-head": ["Daniel", "Kiprop"],
  staff: ["Joyce", "Mwangi"],
  finance: ["Brian", "Kamau"],
  secretary: ["Lilian", "Njeri"],
  driver: ["Samuel", "Mutua"],
  parent: ["Amina", "Hassan"],
  student: ["Zawadi", "Hassan"],
  pupil: ["Zawadi", "Hassan"],
};

export function seedDb(role: Role): DemoDb {
  const [firstName, lastName] = NAMES[role];
  return {
    me: {
      id: `demo-${role}`,
      firstName,
      lastName,
      email: `${firstName.toLowerCase()}@demo.stackable.school`,
      role,
      schoolId: DEMO_SCHOOL.id,
      schoolCode: DEMO_SCHOOL.code,
      schoolName: DEMO_SCHOOL.name,
      portal: ROLE_DASHBOARD[role],
      home: ROLE_HOME[role],
      impersonatedBy: null,
    },
    students: seedStudents(),
    teachers: seedTeachers(),
    subjects: seedSubjects(),
    schools: seedSchools(),
    users: seedUsers(),
    audit: seedAudit(),
  };
}

let registered = false;

/** Register every demo handler once. */
export function registerDemoHandlers(): void {
  if (registered) return;
  registered = true;
  route("GET", "/api/auth/me", ({ db }) => db.me);
  route("POST", "/api/auth/logout", () => ({ ok: true }));
  registerParent();
  registerStudent();
  registerTeacher();
  registerAdmin();
  registerAdminTeachers();
  registerAdminSchools();
  registerSubjects();
  registerDev();
}
