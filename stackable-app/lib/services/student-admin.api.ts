// =============================================================================
// Student admin facade — the functions the /api/students routes call.
// -----------------------------------------------------------------------------
// Binds the service rules (student-admin.service.ts) to the Prisma store, so routes
// stay thin: auth -> validate -> one call here -> JSON.
// =============================================================================

import { studentAdminPrismaStore } from "@/lib/repositories/student-admin.repo";
import {
  deleteStudent,
  readStudentFormOptions,
  readStudentList,
  readStudentProfile,
  updateStudent,
} from "@/lib/services/student-admin.service";
import type { StudentUpdateParsed } from "@/lib/validation/students";

const store = studentAdminPrismaStore;

export const studentAdmin = {
  list: (schoolId: string) => readStudentList(store, schoolId),
  formOptions: (schoolId: string) => readStudentFormOptions(store, schoolId),
  profile: (schoolId: string, studentId: string) => readStudentProfile(store, schoolId, studentId),
  update: (schoolId: string, studentId: string, input: StudentUpdateParsed) =>
    updateStudent(store, schoolId, studentId, input),
  remove: (schoolId: string, studentId: string) => deleteStudent(store, schoolId, studentId),
};
