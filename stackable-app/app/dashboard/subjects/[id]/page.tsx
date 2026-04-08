"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowUpDown,
  BookCopy,
  CalendarClock,
  Eye,
  GraduationCap,
  Plus,
  Sparkles,
  TrendingUp,
  Users,
} from "lucide-react";
import SubjectSlideOver from "@/components/subjects/SlideOver";
import { SubjectPerformanceChart, TeacherStudentRatioChart } from "@/components/subjects/Charts";
import {
  classNames,
  formatDateTime,
  formatEnumLabel,
  formatPercent,
  getInitials,
  getSubjectHeroImage,
  type SubjectAssessmentsPayload,
  type SubjectDetailPayload,
} from "@/lib/subjects";

type SortDirection = "asc" | "desc";

type AssessmentFormState = {
  type: string;
  title: string;
  description: string;
  term: string;
  total_marks_raw: string;
  duration_minutes: string;
  scheduled_start_at: string;
  scheduled_end_at: string;
  target_class_ids: string[];
  teacher_id: string;
};

const INITIAL_ASSESSMENT_FORM: AssessmentFormState = {
  type: "cat",
  title: "",
  description: "",
  term: "",
  total_marks_raw: "100",
  duration_minutes: "60",
  scheduled_start_at: "",
  scheduled_end_at: "",
  target_class_ids: [],
  teacher_id: "",
};

export default function SubjectDetailPage() {
  const params = useParams();
  const subjectId = params?.id as string;
  const [detail, setDetail] = useState<SubjectDetailPayload | null>(null);
  const [assessments, setAssessments] = useState<SubjectAssessmentsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [teacherSort, setTeacherSort] = useState<SortDirection>("desc");
  const [studentSort, setStudentSort] = useState<SortDirection>("desc");
  const [assessmentOpen, setAssessmentOpen] = useState(false);
  const [assessmentForm, setAssessmentForm] = useState(INITIAL_ASSESSMENT_FORM);
  const [savingAssessment, setSavingAssessment] = useState(false);

  useEffect(() => {
    async function loadPage() {
      try {
        setLoading(true);
        setError("");
        const [detailRes, assessmentsRes] = await Promise.all([
          fetch(`/api/subjects/${subjectId}`, { cache: "no-store" }),
          fetch(`/api/subjects/${subjectId}/assessments`, { cache: "no-store" }),
        ]);

        const detailPayload = (await detailRes.json()) as { error?: string; data?: SubjectDetailPayload };
        const assessmentsPayload = (await assessmentsRes.json()) as { error?: string; data?: SubjectAssessmentsPayload };

        if (!detailRes.ok || !detailPayload.data) {
          throw new Error(detailPayload.error || "Failed to load subject details.");
        }
        if (!assessmentsRes.ok || !assessmentsPayload.data) {
          throw new Error(assessmentsPayload.error || "Failed to load subject assessments.");
        }

        setDetail(detailPayload.data);
        setAssessments(assessmentsPayload.data);
      } catch (loadError) {
        console.error(loadError);
        setError(loadError instanceof Error ? loadError.message : "Failed to load subject.");
      } finally {
        setLoading(false);
      }
    }

    if (subjectId) {
      void loadPage();
    }
  }, [subjectId]);

  const sortedTeachers = useMemo(() => {
    const data = [...(detail?.teachers ?? [])];
    data.sort((left, right) => {
      const gap = (right.learnerAverage ?? -1) - (left.learnerAverage ?? -1);
      if (gap !== 0) return teacherSort === "desc" ? gap : -gap;
      return left.name.localeCompare(right.name);
    });
    return data;
  }, [detail?.teachers, teacherSort]);

  const sortedStudents = useMemo(() => {
    const data = [...(detail?.students ?? [])];
    data.sort((left, right) => {
      const gap = (right.avgScore ?? -1) - (left.avgScore ?? -1);
      if (gap !== 0) return studentSort === "desc" ? gap : -gap;
      return left.fullName.localeCompare(right.fullName);
    });
    return data;
  }, [detail?.students, studentSort]);

  function toggleAssessmentClass(classId: string) {
    setAssessmentForm((current) => ({
      ...current,
      target_class_ids: current.target_class_ids.includes(classId)
        ? current.target_class_ids.filter((item) => item !== classId)
        : [...current.target_class_ids, classId],
    }));
  }

  async function handleCreateAssessment() {
    try {
      setSavingAssessment(true);
      const res = await fetch(`/api/subjects/${subjectId}/assessments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...assessmentForm,
          total_marks_raw: Number(assessmentForm.total_marks_raw),
          duration_minutes: Number(assessmentForm.duration_minutes),
        }),
      });
      const payload = (await res.json()) as { error?: string; data?: SubjectAssessmentsPayload };
      if (!res.ok || !payload.data) {
        throw new Error(payload.error || "Failed to create assessment.");
      }
      setAssessments(payload.data);
      setAssessmentOpen(false);
      setAssessmentForm(INITIAL_ASSESSMENT_FORM);
    } catch (saveError) {
      console.error(saveError);
      setError(saveError instanceof Error ? saveError.message : "Failed to create assessment.");
    } finally {
      setSavingAssessment(false);
    }
  }

  if (loading) {
    return <div className="p-6"><div className="rounded-[28px] border border-gray-100 bg-white px-6 py-16 text-center shadow-sm"><div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-gray-200 border-t-[#F19F24]" /><p className="mt-4 text-sm text-gray-500">Loading subject command center...</p></div></div>;
  }

  if (error || !detail) {
    return <div className="p-6"><div className="rounded-[28px] border border-dashed border-gray-300 bg-white px-6 py-14 text-center"><h3 className="text-lg font-semibold text-gray-900">Subject not found</h3><p className="mt-2 text-sm text-gray-500">{error || "The requested subject record could not be loaded."}</p></div></div>;
  }

  const heroImage = getSubjectHeroImage(String(detail.subjectId), detail.abstractImageUrl);
  const upcomingAssessments = assessments?.upcoming ?? [];
  const pastAssessments = assessments?.past ?? [];

  return (
    <div className="min-h-screen w-full bg-transparent p-6">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href="/dashboard/subjects" className="inline-flex items-center gap-2 text-sm font-semibold text-[#007146] transition hover:text-[#F19F24]"><ArrowLeft className="h-4 w-4" />Back to subjects</Link>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Link href={`/dashboard/subjects/${subjectId}/coursework`} className="inline-flex items-center gap-2 rounded-[16px] border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-700 transition hover:border-[#F19F24] hover:text-[#F19F24]"><BookCopy className="h-4 w-4" />Coursework</Link>
          <button type="button" onClick={() => setAssessmentOpen(true)} className="inline-flex items-center gap-2 rounded-[16px] bg-[#F19F24] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#d88915]"><CalendarClock className="h-4 w-4" />Add Assessment</button>
        </div>
      </div>
      <div className="space-y-6">
        <section className="relative overflow-hidden rounded-[32px] border border-gray-100 shadow-sm">
          <div className="absolute inset-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={heroImage} alt={`${detail.title} background`} className="h-full w-full object-cover" />
            <div className="absolute inset-0 bg-slate-950/10" />
            <div className="absolute inset-0 bg-[linear-gradient(120deg,rgba(15,23,42,0.28)_0%,rgba(15,23,42,0.16)_42%,rgba(15,23,42,0.22)_100%)]" />
          </div>
          <div className="relative grid grid-cols-1 xl:grid-cols-[1.3fr_0.7fr]">
            <div className="p-6 md:p-8">
              <div className="inline-flex rounded-full border border-white/20 bg-white/12 px-3 py-1 text-xs font-semibold text-white backdrop-blur">{detail.schoolName}</div>
              <h2 className="mt-4 text-3xl font-bold text-white md:text-4xl">{detail.title}</h2>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-white/88">{detail.description || "No subject description has been added yet."}</p>
              <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold uppercase tracking-wide text-white/80"><span className="rounded-full border border-white/20 bg-white/12 px-3 py-1 backdrop-blur">{formatEnumLabel(detail.category)}</span><span className="rounded-full border border-white/20 bg-white/12 px-3 py-1 backdrop-blur">{formatEnumLabel(detail.subjectType)}</span><span className="rounded-full border border-white/20 bg-white/12 px-3 py-1 backdrop-blur">{formatEnumLabel(detail.educationLevel)}</span><span className="rounded-full border border-white/20 bg-white/12 px-3 py-1 backdrop-blur">{detail.subjectCode || detail.acronym || "Pending code"}</span></div>
            </div>
            <div className="p-6 md:p-8 xl:border-l xl:border-white/12">
              <div className="rounded-[26px] border border-white/18 bg-white/84 p-5 shadow-[0_20px_60px_rgba(15,23,42,0.18)] backdrop-blur-xl">
                <p className="text-xs uppercase tracking-wide text-gray-400">Head of department</p>
                {detail.headOfDepartment ? <div className="mt-4"><div className="flex items-center gap-3">{detail.headOfDepartment.profilePhoto ? <img src={detail.headOfDepartment.profilePhoto} alt={detail.headOfDepartment.name} className="h-16 w-16 rounded-full object-cover" /> : <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#F7F9E2] text-lg font-bold text-[#007146]">{getInitials(detail.headOfDepartment.name)}</div>}<div><h3 className="text-lg font-semibold text-gray-900">{detail.headOfDepartment.name}</h3><p className="text-sm text-gray-500">{formatEnumLabel(detail.headOfDepartment.role)}</p><p className="mt-1 text-xs text-gray-500">{detail.headOfDepartment.email || detail.headOfDepartment.phone || "No contact yet"}</p></div></div></div> : <div className="mt-4 rounded-[24px] border border-dashed border-gray-300 bg-[#FCFCFC] p-5 text-sm text-gray-500">No HOD assignment has been set for this subject yet.</div>}
              </div>
            </div>
          </div>
        </section>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">{[{ icon: Users, label: "Students", value: String(detail.statSummary.totalStudents) }, { icon: GraduationCap, label: "Teachers", value: String(detail.statSummary.totalTeachers) }, { icon: TrendingUp, label: "Average score", value: formatPercent(detail.statSummary.averageScore) }, { icon: Sparkles, label: "School rank", value: detail.statSummary.schoolRank ? `#${detail.statSummary.schoolRank}` : "—" }].map((item) => <div key={item.label} className="rounded-[24px] border border-gray-100 bg-white p-5 shadow-sm"><div className="flex items-center gap-3"><span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-[#FFF4E2] text-[#F19F24]"><item.icon className="h-5 w-5" /></span><div><p className="text-xs uppercase tracking-wide text-gray-400">{item.label}</p><p className="mt-1 text-2xl font-bold text-gray-900">{item.value}</p></div></div></div>)}</div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.45fr_0.95fr]">
          <div className="rounded-[28px] border border-gray-100 bg-white p-6 shadow-sm"><div className="mb-4 flex items-center justify-between gap-3"><div><h2 className="text-lg font-semibold text-gray-900">Past vs recent results</h2><p className="text-sm text-gray-500">Term-based performance trend using published subject marks.</p></div><div className="rounded-full border border-[#dbe8cc] bg-[#F7F9E2] px-3 py-1 text-xs font-semibold text-[#007146]">{detail.statSummary.latestTerm || "No term yet"}</div></div><SubjectPerformanceChart points={detail.performanceTrend} /></div>
          <div className="rounded-[28px] border border-gray-100 bg-white p-6 shadow-sm"><div className="mb-4"><h2 className="text-lg font-semibold text-gray-900">Teacher to learner ratio</h2><p className="text-sm text-gray-500">Teaching capacity versus subject enrollment for this offering.</p></div><TeacherStudentRatioChart teacherCount={detail.statSummary.totalTeachers} studentCount={detail.statSummary.totalStudents} /></div>
        </div>

        <section className="rounded-[28px] border border-gray-100 bg-white p-6 shadow-sm"><div className="mb-4 flex items-center justify-between gap-3"><div><h2 className="text-lg font-semibold text-gray-900">Class performance grid</h2><p className="text-sm text-gray-500">Latest cached class averages for this subject offering.</p></div></div><div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">{detail.classPerformance.map((item) => <div key={item.id} className="rounded-[22px] border border-gray-100 bg-[#FCFCFC] p-4"><p className="text-xs uppercase tracking-wide text-gray-400">{item.classLabel}</p><p className="mt-2 text-xl font-bold text-gray-900">{formatPercent(item.averageScore)}</p><p className="mt-1 text-sm text-gray-500">Grade {item.averageGrade || "—"}</p></div>)}</div></section>

        <section className="rounded-[28px] border border-gray-100 bg-white p-6 shadow-sm"><div className="mb-4 flex items-center justify-between gap-3"><div><h2 className="text-lg font-semibold text-gray-900">Teachers teaching this subject</h2><p className="text-sm text-gray-500">Ordered by learner performance, with direct access to teacher detail pages.</p></div><button type="button" onClick={() => setTeacherSort((current) => current === "desc" ? "asc" : "desc")} className="inline-flex items-center gap-2 rounded-[14px] border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700"><ArrowUpDown className="h-4 w-4" />{teacherSort === "desc" ? "Highest first" : "Lowest first"}</button></div><div className="overflow-hidden rounded-[24px] border border-gray-100"><div className="overflow-x-auto"><table className="min-w-full"><thead className="bg-[#F8F8F8] text-left"><tr className="text-xs uppercase tracking-wide text-gray-500"><th className="px-5 py-4">Teacher</th><th className="px-5 py-4">Role</th><th className="px-5 py-4">Classes</th><th className="px-5 py-4">Learner average</th><th className="px-5 py-4 text-right">Action</th></tr></thead><tbody>{sortedTeachers.map((teacher) => <tr key={teacher.id} className="border-t border-gray-100 text-sm text-gray-700"><td className="px-5 py-4"><div className="flex items-center gap-3">{teacher.profilePhoto ? <img src={teacher.profilePhoto} alt={teacher.name} className="h-11 w-11 rounded-full object-cover" /> : <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#F7F9E2] font-semibold text-[#007146]">{getInitials(teacher.name)}</div>}<div><p className="font-semibold text-gray-900">{teacher.name}</p><p className="text-xs text-gray-500">{teacher.email || teacher.phone || "No contact"}</p></div></div></td><td className="px-5 py-4">{formatEnumLabel(teacher.role)}</td><td className="px-5 py-4">{teacher.classes.join(", ") || "No classes"}</td><td className="px-5 py-4 font-semibold text-gray-900">{formatPercent(teacher.learnerAverage)}</td><td className="px-5 py-4 text-right"><Link href={`/dashboard/teachers/${teacher.id}`} className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[#dbe8cc] bg-[#F7F9E2] text-[#007146]"><Eye className="h-4 w-4" /></Link></td></tr>)}</tbody></table></div></div></section>

        <section className="rounded-[28px] border border-gray-100 bg-white p-6 shadow-sm"><div className="mb-4 flex items-center justify-between gap-3"><div><h2 className="text-lg font-semibold text-gray-900">Students taking this subject</h2><p className="text-sm text-gray-500">Subject averages arranged from highest to lowest with a quick sort toggle.</p></div><button type="button" onClick={() => setStudentSort((current) => current === "desc" ? "asc" : "desc")} className="inline-flex items-center gap-2 rounded-[14px] border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700"><ArrowUpDown className="h-4 w-4" />{studentSort === "desc" ? "Highest first" : "Lowest first"}</button></div><div className="overflow-hidden rounded-[24px] border border-gray-100"><div className="overflow-x-auto"><table className="min-w-full"><thead className="bg-[#F8F8F8] text-left"><tr className="text-xs uppercase tracking-wide text-gray-500"><th className="px-5 py-4">Student</th><th className="px-5 py-4">Admission</th><th className="px-5 py-4">Class</th><th className="px-5 py-4">Average</th><th className="px-5 py-4">Grade</th><th className="px-5 py-4">Teacher</th></tr></thead><tbody>{sortedStudents.map((student) => <tr key={student.id} className="border-t border-gray-100 text-sm text-gray-700"><td className="px-5 py-4"><div className="flex items-center gap-3">{student.profilePhoto ? <img src={student.profilePhoto} alt={student.fullName} className="h-11 w-11 rounded-full object-cover" /> : <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#F7F9E2] font-semibold text-[#007146]">{getInitials(student.fullName)}</div>}<div><p className="font-semibold text-gray-900">{student.fullName}</p><p className="text-xs text-gray-500">{student.status}</p></div></div></td><td className="px-5 py-4 font-medium text-gray-900">{student.admissionNo}</td><td className="px-5 py-4">{student.classLabel}</td><td className="px-5 py-4 font-semibold text-gray-900">{formatPercent(student.avgScore)}</td><td className="px-5 py-4">{student.grade}</td><td className="px-5 py-4">{student.teacherName || "—"}</td></tr>)}</tbody></table></div></div></section>

        <section id="assessments" className="rounded-[28px] border border-gray-100 bg-white p-6 shadow-sm"><div className="mb-6 flex items-center justify-between gap-3"><div><h2 className="text-lg font-semibold text-gray-900">Assessment timeline</h2><p className="text-sm text-gray-500">Upcoming and completed assessments for this subject across its linked classes.</p></div><button type="button" onClick={() => setAssessmentOpen(true)} className="inline-flex items-center gap-2 rounded-[16px] bg-[#F19F24] px-4 py-3 text-sm font-semibold text-white"><CalendarClock className="h-4 w-4" />Add Assessment</button></div>
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2"><div><h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-400">Upcoming assessments</h3><div className="space-y-4">{upcomingAssessments.length > 0 ? upcomingAssessments.map((item) => <div key={item.id} className="rounded-[24px] border border-gray-100 bg-[#FCFCFC] p-5"><div className="flex items-start justify-between gap-3"><div><p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#F19F24]">{item.type}</p><h4 className="mt-1 text-lg font-semibold text-gray-900">{item.title}</h4><p className="mt-1 text-sm text-gray-500">{item.classLabel} • {formatDateTime(item.scheduledStartAt)}</p></div><span className={classNames("rounded-full border px-3 py-1 text-xs font-semibold", item.status === "in_progress" ? "border-amber-200 bg-amber-50 text-amber-700" : "border-[#dbe8cc] bg-[#F7F9E2] text-[#007146]")}>{formatEnumLabel(item.status)}</span></div><p className="mt-3 text-sm text-gray-600">{item.description || "No assessment description yet."}</p>{item.progressPct != null ? <div className="mt-4"><div className="mb-2 flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-gray-400"><span>Time progress</span><span>{Math.round(item.progressPct)}%</span></div><div className="h-2 rounded-full bg-gray-100"><div className="h-2 rounded-full bg-[#F19F24]" style={{ width: `${item.progressPct}%` }} /></div></div> : null}</div>) : <div className="rounded-[24px] border border-dashed border-gray-300 bg-[#FCFCFC] px-5 py-10 text-sm text-gray-500">No upcoming assessments for this subject yet.</div>}</div></div>
            <div><h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-400">Past assessments</h3><div className="space-y-4">{pastAssessments.length > 0 ? pastAssessments.map((item) => <div key={item.id} className="rounded-[24px] border border-gray-100 bg-[#FCFCFC] p-5"><div className="flex items-start justify-between gap-3"><div><p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#007146]">{item.type}</p><h4 className="mt-1 text-lg font-semibold text-gray-900">{item.title}</h4><p className="mt-1 text-sm text-gray-500">Completed {formatDateTime(item.completedAt || item.scheduledEndAt)}</p></div><span className="rounded-full border border-gray-200 bg-white px-3 py-1 text-xs font-semibold text-gray-600">{item.classLabel}</span></div><div className="mt-4 flex items-center justify-between"><div><p className="text-xs uppercase tracking-wide text-gray-400">Average grade</p><p className="mt-1 text-lg font-bold text-gray-900">{item.hasPublishedResults ? item.averageGrade || "—" : "Pending"}</p></div><Link href={`/dashboard/subjects/${subjectId}`} className="inline-flex rounded-[14px] border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700">View Details</Link></div></div>) : <div className="rounded-[24px] border border-dashed border-gray-300 bg-[#FCFCFC] px-5 py-10 text-sm text-gray-500">No completed assessments are available yet.</div>}</div></div></div>
        </section>
      </div>

      <SubjectSlideOver open={assessmentOpen} onClose={() => setAssessmentOpen(false)} title="Add Assessment" subtitle="Create a CAT, exam, RAT, or quiz and assign the target classes for this subject">
        <div className="space-y-5">
          <div className="rounded-[28px] border border-gray-100 bg-white p-6 shadow-sm">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div><label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-gray-400">Type</label><select value={assessmentForm.type} onChange={(event) => setAssessmentForm((current) => ({ ...current, type: event.target.value }))} className="w-full rounded-[18px] border border-gray-200 bg-[#FCFCFC] px-4 py-3 text-sm outline-none"><option value="cat">CAT</option><option value="exam">Exam</option><option value="rat">RAT</option><option value="quiz">Quiz</option></select></div>
              <div><label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-gray-400">Term</label><input value={assessmentForm.term} onChange={(event) => setAssessmentForm((current) => ({ ...current, term: event.target.value }))} className="w-full rounded-[18px] border border-gray-200 bg-[#FCFCFC] px-4 py-3 text-sm outline-none" placeholder="Term 1" /></div>
              <div className="md:col-span-2"><label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-gray-400">Title</label><input value={assessmentForm.title} onChange={(event) => setAssessmentForm((current) => ({ ...current, title: event.target.value }))} className="w-full rounded-[18px] border border-gray-200 bg-[#FCFCFC] px-4 py-3 text-sm outline-none" placeholder="Mid-term mathematics CAT" /></div>
              <div className="md:col-span-2"><label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-gray-400">Description</label><textarea value={assessmentForm.description} onChange={(event) => setAssessmentForm((current) => ({ ...current, description: event.target.value }))} className="min-h-[110px] w-full rounded-[18px] border border-gray-200 bg-[#FCFCFC] px-4 py-3 text-sm outline-none" /></div>
              <div><label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-gray-400">Total marks</label><input type="number" value={assessmentForm.total_marks_raw} onChange={(event) => setAssessmentForm((current) => ({ ...current, total_marks_raw: event.target.value }))} className="w-full rounded-[18px] border border-gray-200 bg-[#FCFCFC] px-4 py-3 text-sm outline-none" /></div>
              <div><label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-gray-400">Duration in minutes</label><input type="number" value={assessmentForm.duration_minutes} onChange={(event) => setAssessmentForm((current) => ({ ...current, duration_minutes: event.target.value }))} className="w-full rounded-[18px] border border-gray-200 bg-[#FCFCFC] px-4 py-3 text-sm outline-none" /></div>
              <div><label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-gray-400">Start at</label><input type="datetime-local" value={assessmentForm.scheduled_start_at} onChange={(event) => setAssessmentForm((current) => ({ ...current, scheduled_start_at: event.target.value }))} className="w-full rounded-[18px] border border-gray-200 bg-[#FCFCFC] px-4 py-3 text-sm outline-none" /></div>
              <div><label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-gray-400">End at</label><input type="datetime-local" value={assessmentForm.scheduled_end_at} onChange={(event) => setAssessmentForm((current) => ({ ...current, scheduled_end_at: event.target.value }))} className="w-full rounded-[18px] border border-gray-200 bg-[#FCFCFC] px-4 py-3 text-sm outline-none" /></div>
              <div className="md:col-span-2"><label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-gray-400">Assign teacher</label><select value={assessmentForm.teacher_id} onChange={(event) => setAssessmentForm((current) => ({ ...current, teacher_id: event.target.value }))} className="w-full rounded-[18px] border border-gray-200 bg-[#FCFCFC] px-4 py-3 text-sm outline-none"><option value="">No specific teacher</option>{detail.teachers.map((teacher) => <option key={teacher.id} value={teacher.id}>{teacher.name}</option>)}</select></div>
              <div className="md:col-span-2"><label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-gray-400">Target classes</label><div className="flex flex-wrap gap-2">{detail.classPerformance.map((classItem) => <button key={classItem.classId} type="button" onClick={() => toggleAssessmentClass(classItem.classId)} className={classNames("rounded-full border px-4 py-2 text-sm font-semibold transition", assessmentForm.target_class_ids.includes(classItem.classId) ? "border-[#dbe8cc] bg-[#F7F9E2] text-[#007146]" : "border-gray-200 bg-white text-gray-600")}>{classItem.classLabel}</button>)}</div></div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3"><button type="button" onClick={() => void handleCreateAssessment()} disabled={savingAssessment} className="inline-flex items-center gap-2 rounded-[16px] bg-[#F19F24] px-5 py-3 text-sm font-semibold text-white disabled:opacity-50"><Plus className="h-4 w-4" />{savingAssessment ? "Creating..." : "Create Assessment"}</button><button type="button" onClick={() => setAssessmentOpen(false)} className="inline-flex rounded-[16px] border border-gray-200 bg-white px-5 py-3 text-sm font-semibold text-gray-700">Cancel</button></div>
        </div>
      </SubjectSlideOver>
    </div>
  );
}

