// =============================================================================
// Teacher admin facade — the functions the /api/teachers routes call.
// -----------------------------------------------------------------------------
// Binds the service rules (teacher-admin.service.ts) to the Prisma store and to the
// photo storage in lib/teacher-photo.ts, so routes stay thin: auth -> validate ->
// one call here -> JSON.
// =============================================================================

import { teacherAdminPrismaStore } from "@/lib/repositories/teacher-admin.repo";
import {
  createTeacher,
  deleteTeacher,
  readAttendance,
  readEditData,
  readTeacherFormOptions,
  readTeacherList,
  readTeacherProfile,
  readTimetable,
  saveTimetable,
  updateTeacher,
  type PhotoStorage,
} from "@/lib/services/teacher-admin.service";
import { managedPhotoPath, removeTeacherPhotoFile, uploadTeacherPhoto } from "@/lib/teacher-photo";
import type { TimetableWriteRow } from "@/lib/dto/teachers";
import type { TeacherCreateParsed, TeacherUpdateParsed } from "@/lib/validation/teachers";

const store = teacherAdminPrismaStore;

const photos: PhotoStorage = {
  upload: uploadTeacherPhoto,
  remove: removeTeacherPhotoFile,
  pathFromUrl: managedPhotoPath,
};

export const teacherAdmin = {
  list: (schoolId: string) => readTeacherList(store, schoolId),
  formOptions: (schoolId: string) => readTeacherFormOptions(store, schoolId),
  profile: (schoolId: string, teacherId: string) => readTeacherProfile(store, schoolId, teacherId),
  editData: (schoolId: string, teacherId: string) => readEditData(store, schoolId, teacherId),
  timetable: (schoolId: string, teacherId: string) => readTimetable(store, schoolId, teacherId),
  attendance: (schoolId: string, teacherId: string, limit: number) =>
    readAttendance(store, schoolId, teacherId, limit),
  create: (schoolId: string, input: TeacherCreateParsed, photo: File) =>
    createTeacher(store, photos, schoolId, input, photo),
  update: (schoolId: string, teacherId: string, input: TeacherUpdateParsed, photo: File | null) =>
    updateTeacher(store, photos, schoolId, teacherId, input, photo),
  saveTimetable: (schoolId: string, teacherId: string, slots: TimetableWriteRow[]) =>
    saveTimetable(store, schoolId, teacherId, slots),
  remove: (schoolId: string, teacherId: string, force: boolean) =>
    deleteTeacher(store, photos, schoolId, teacherId, force),
  /** true when the teacher exists in the school (guards the photo route). */
  exists: (schoolId: string, teacherId: string) => store.teacherExists(schoolId, teacherId),
};
