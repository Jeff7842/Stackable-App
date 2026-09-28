// Clock + timetable helpers shared with the teacher portal (Nairobi time, once-a-minute
// tick, "5m ago" labels, lesson phases). One seam: if the teacher helpers ever move,
// only this re-export changes.
export {
  formatLongDate,
  greetingFor,
  isBreakSlot,
  lessonPhase,
  lessonTitle,
  nairobiMinuteOfDay,
  timeAgo,
  useEpochMinute,
  type LessonPhase,
} from "@/components/portal/teacher/helpers";
