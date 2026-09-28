// =============================================================================
// StudentAdminStore — the data-access contract the student admin service needs.
// -----------------------------------------------------------------------------
// The one real implementation is lib/repositories/student-admin.repo.ts (Prisma +
// PostgreSQL); the service is tested against an in-memory fake of this interface.
// Every method scopes by schoolId: an id from another school is "not found".
// =============================================================================

import type {
  StudentFormOptions,
  StudentListData,
  StudentListItem,
  StudentProfile,
} from "@/lib/dto/students";

/** Column changes for the students row. Only keys that are present are written. */
export type StudentFieldChanges = {
  status?: string;
  class_id?: string | null;
  phone?: string | null;
  phone2?: string | null;
  /** "YYYY-MM-DD" or null. */
  date_of_birth?: string | null;
  location?: string | null;
  home_address?: string | null;
  emergency_contact?: string | null;
  health_status?: string | null;
  other_info?: string | null;
};

export interface StudentAdminStore {
  /** Students of the school (max MAX_STUDENTS_PER_LIST) with counts and class options. */
  list(schoolId: string): Promise<StudentListData>;
  /** One student's full profile, or null. */
  getProfile(schoolId: string, studentId: string): Promise<StudentProfile | null>;
  /** The list-row shape for one student, or null. */
  getListItem(schoolId: string, studentId: string): Promise<StudentListItem | null>;
  formOptions(schoolId: string): Promise<StudentFormOptions>;
  /** true when the class exists in this school. */
  classExists(schoolId: string, classId: string): Promise<boolean>;
  /** Update one student of the school. false when not found. */
  update(schoolId: string, studentId: string, changes: StudentFieldChanges): Promise<boolean>;
  /** Delete one student of the school. false when not found. */
  remove(schoolId: string, studentId: string): Promise<boolean>;
}
