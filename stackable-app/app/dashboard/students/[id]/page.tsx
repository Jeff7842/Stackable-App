import Image from "next/image";
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import { notFound } from "next/navigation";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

function formatDate(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(date);
}

function getStatusClasses(status: string) {
  switch (status) {
    case "active":
      return "bg-green-50 text-green-700 border-green-200";
    case "suspended":
      return "bg-red-50 text-red-700 border-red-200";
    case "pending":
      return "bg-yellow-50 text-yellow-700 border-yellow-200";
    case "graduated":
      return "bg-blue-50 text-blue-700 border-blue-200";
    default:
      return "bg-gray-100 text-gray-700 border-gray-200";
  }
}

function scoreToGrade(score: number | null | undefined) {
  if (score == null) return "—";

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

export default async function StudentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const { data, error } = await supabase
    .from("students")
    .select(`
      *,
      users!students_user_fk (
        first_name,
        last_name,
        email,
        phone
      )
    `)
    .eq("id", id)
    .single();

  if (error || !data) notFound();

  const { data: averageGradeRow } = await supabase
    .from("student_average_grade")
    .select("avg_score")
    .eq("student_id", id)
    .single();

  const averageGrade = scoreToGrade(averageGradeRow?.avg_score);

  const fullName =
    `${data.first_name ?? ""} ${data.last_name ?? ""}`.trim() ||
    "Unnamed student";

  return (
    <div className="min-h-screen bg-[#F6F6F6] pl-5 pr-5 pt-5 pb-6">
      <div className="rounded-[32px] border border-white bg-[#FFFDF8] p-6 shadow-[0_30px_80px_rgba(15,23,42,0.08)]">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <Link
              href="/dashboard/students"
              className="text-sm font-medium text-[#007146] hover:text-[#F19F24]"
            >
              ← Back to students
            </Link>
            <h1 className="mt-2 text-[28px] font-bold text-gray-900">{fullName}</h1>
            <p className="mt-1 text-sm text-gray-500">
              Full student profile and operational details.
            </p>
          </div>

          <span
            className={`inline-flex rounded-full border px-4 py-2 text-sm font-semibold capitalize ${getStatusClasses(
              data.status,
            )}`}
          >
            {data.status}
          </span>
        </div>

        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[360px_1fr]">
          <div className="rounded-[28px] border border-gray-100 bg-white p-5 shadow-sm">
            <div className="flex flex-col items-center text-center">
              {data.profile_picture ? (
                <Image
                  src={data.profile_picture}
                  alt={fullName}
                  width={120}
                  height={120}
                  className="h-[120px] w-[120px] rounded-full object-cover ring-4 ring-[#F7F9E2]"
                />
              ) : (
                <div className="flex h-[120px] w-[120px] items-center justify-center rounded-full bg-[#F7F9E2] text-3xl font-bold text-[#007146]">
                  {fullName.slice(0, 2).toUpperCase()}
                </div>
              )}

              <h2 className="mt-4 text-xl font-bold text-gray-900">{fullName}</h2>
              <p className="mt-1 text-sm text-gray-500">{data.admission_no}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            {[
              ["School", data.school_name || "—"],
              ["Class", data.class_id || "Unassigned"],
              ["Date of Birth", formatDate(data.date_of_birth)],
              ["Parent Contact 1", data.phone || "—"],
              ["Parent Contact 2", data.phone2 || "—"],
              ["Email", data.email || data.users?.email || "—"],
              ["Location", data.location || "—"],
              ["Home Address", data.home_address || "—"],
              ["Emergency Contact", data.emergency_contact || "—"],
              ["Health Status", data.health_status || "—"],
              ["Average Grade", averageGrade || "—"],
              ["Other Info", data.other_info || "—"],
            ].map(([label, value]) => (
              <div
                key={label}
                className="rounded-[24px] border border-gray-100 bg-white p-5 shadow-sm"
              >
                <p className="text-xs uppercase tracking-wide text-gray-400">{label}</p>
                <p className="mt-2 text-sm font-medium text-gray-900">{value}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}