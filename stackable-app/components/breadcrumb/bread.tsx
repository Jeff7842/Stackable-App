'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronRight, House } from 'lucide-react';

type BreadcrumbItem = {
  href: string;
  label: string;
  current: boolean;
  linkable: boolean;
};

const SEGMENT_LABELS: Record<string, string> = {
  dashboard: 'Dashboard',
  'admin-role': 'Admin Role',
  ai: 'AI',
  allocation: 'Allocation',
  analytics: 'Analytics',
  calender: 'Calendar',
  classes: 'Classes',
  'cognitive-abilities-test': 'Cognitive Abilities Test',
  edit: 'Edit',
  events: 'Events',
  exams: 'Exams',
  'flashcard-maker': 'Flashcard Maker',
  'grades-reports': 'Grades & Reports',
  home: 'Home',
  homework: 'Homework',
  'homework-assistant': 'Homework Assistant',
  inbox: 'Inbox',
  library: 'Library',
  'live-activity': 'Live Activity',
  login: 'Login',
  'load-allocation': 'Load Allocation',
  maintenance: 'Maintenance',
  'message-app': 'Message App',
  notifications: 'Notifications',
  'our-story': 'Our Story',
  page: 'Page',
  payments: 'Payments',
  quizes: 'Quizzes',
  'quiz-generator': 'Quiz Generator',
  'real-time': 'Real Time',
  salaries: 'Salaries',
  'school-fees': 'School Fees',
  settings: 'Settings',
  staff: 'Staff',
  'staff-resources': 'Staff Resources',
  students: 'Students',
  'students-resources': 'Student Resources',
  subjects: 'Subjects',
  summarizer: 'Summarizer',
  teachers: 'Teachers',
  'teachers-resources': 'Teacher Resources',
  timetable: 'Timetable',
  'transport-status': 'Transport Status',
  coursework: 'Coursework',
};

const ENTITY_LABELS: Record<string, string> = {
  students: 'Student',
  subjects: 'Subject',
  teachers: 'Teacher',
};

const WORD_LABELS: Record<string, string> = {
  ai: 'AI',
};

function titleizeSegment(segment: string) {
  return decodeURIComponent(segment)
    .split('-')
    .filter(Boolean)
    .map((word) => {
      const lower = word.toLowerCase();
      if (WORD_LABELS[lower]) {
        return WORD_LABELS[lower];
      }

      return `${word.charAt(0).toUpperCase()}${word.slice(1)}`;
    })
    .join(' ');
}

function labelForSegment(
  segment: string,
  previousSegment?: string,
  nextSegment?: string,
) {
  const normalizedSegment = decodeURIComponent(segment).toLowerCase();
  const staticLabel = SEGMENT_LABELS[normalizedSegment];

  if (staticLabel) {
    return staticLabel;
  }

  if (previousSegment) {
    const entityLabel = ENTITY_LABELS[previousSegment.toLowerCase()];

    if (entityLabel) {
      return nextSegment ? entityLabel : `${entityLabel} Details`;
    }
  }

  return titleizeSegment(segment);
}

function buildBreadcrumbs(pathname: string) {
  const segments = pathname.split('/').filter(Boolean);

  if (segments.length === 0) {
    return [];
  }

  return segments.map<BreadcrumbItem>((segment, index) => ({
    href: `/${segments.slice(0, index + 1).join('/')}`,
    label: labelForSegment(segment, segments[index - 1], segments[index + 1]),
    current: index === segments.length - 1,
    linkable: !Boolean(
      segments[index - 1] &&
        ENTITY_LABELS[segments[index - 1].toLowerCase()] &&
        segments[index + 1],
    ),
  }));
}

export default function BreadCrumb() {
  const pathname = usePathname();
  const breadcrumbs = buildBreadcrumbs(pathname);

  if (breadcrumbs.length === 0) {
    return null;
  }

  return (
    <nav aria-label="Breadcrumb" className="flex flex-wrap items-center">
      <ol className="inline-flex flex-wrap items-center gap-y-2 text-sm">
        {breadcrumbs.map((item, index) => (
          <li key={item.href} className="inline-flex items-center">
            {index > 0 && (
              <ChevronRight
                aria-hidden="true"
                className="mx-2 h-4 w-4 text-gray-400"
              />
            )}

            {item.current ? (
              <span
                aria-current="page"
                className="inline-flex items-center gap-2 font-semibold text-[#007146]"
              >
                {index === 0 && <House aria-hidden="true" className="h-4 w-4" />}
                {item.label}
              </span>
            ) : !item.linkable ? (
              <span className="inline-flex items-center gap-2 font-semibold text-gray-500">
                {index === 0 && <House aria-hidden="true" className="h-4 w-4" />}
                {item.label}
              </span>
            ) : (
              <Link
                href={item.href}
                className="inline-flex items-center gap-2 font-semibold text-gray-600 transition-colors duration-200 hover:text-[#F19F24]"
              >
                {index === 0 && <House aria-hidden="true" className="h-4 w-4" />}
                {item.label}
              </Link>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
