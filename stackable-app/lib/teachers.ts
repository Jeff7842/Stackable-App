export const TEACHERS_PROFILE_BUCKET = "teachers_profile";

type ClassLike = {
  class_name: string;
  stream: string | null;
};

export function buildTeacherPhotoUrl(filePath: string) {
  const params = new URLSearchParams({ path: filePath });
  return `/api/teachers/photo?${params.toString()}`;
}

export function formatClassLabel(classItem: ClassLike | null | undefined) {
  if (!classItem) return "Unassigned";
  return classItem.stream
    ? `${classItem.class_name} ${classItem.stream}`
    : classItem.class_name;
}

export function numericScore(value: number | string | null | undefined) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function scoreToGrade(score: number | null | undefined) {
  if (score == null) return "-";
  if (score >= 11.5) return "A";
  if (score >= 10.5) return "B+";
  if (score >= 9.5) return "B";
  if (score >= 8.5) return "B-";
  if (score >= 7.5) return "C+";
  if (score >= 6.5) return "C";
  if (score >= 5.5) return "C-";
  if (score >= 4.5) return "D+";
  if (score >= 3.5) return "D";
  if (score >= 2.5) return "D-";
  if (score >= 1.5) return "E";
  return "F";
}
