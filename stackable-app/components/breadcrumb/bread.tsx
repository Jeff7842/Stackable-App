'use client';

// Breadcrumb trail shown above every dashboard page (rendered by DashboardShell).
// Labels come from the small maps below; unknown segments are title-cased.
// Styling: design tokens only (light + dark), Solar icons via Iconify.

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icon } from '@/components/ui/Icon';
import { cn } from '@/lib/cn';

type BreadcrumbItem = {
  href: string;
  label: string;
  current: boolean;
  linkable: boolean;
};

const SEGMENT_LABELS: Record<string, string> = {
  dashboard: 'Dashboard',
  admin: 'Admin',
  teach: 'Teaching',
  learn: 'Learning',
  family: 'Family',
  dev: 'Developer',
  audit: 'Audit Log',
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

  const crumb =
    'inline-flex items-center gap-1.5 rounded-md text-sm font-semibold outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus';

  return (
    <nav aria-label="Breadcrumb" className="flex flex-wrap items-center">
      <ol className="inline-flex flex-wrap items-center gap-y-1 text-sm">
        {breadcrumbs.map((item, index) => (
          <li key={item.href} className="inline-flex items-center">
            {index > 0 && (
              <Icon
                icon="solar:alt-arrow-right-linear"
                width={14}
                className="mx-1.5 shrink-0 text-muted/70"
              />
            )}

            {item.current ? (
              <span aria-current="page" className={cn(crumb, 'text-primary-ink')}>
                {index === 0 && <Icon icon="solar:home-2-linear" width={16} />}
                {item.label}
              </span>
            ) : !item.linkable ? (
              <span className={cn(crumb, 'text-muted')}>
                {index === 0 && <Icon icon="solar:home-2-linear" width={16} />}
                {item.label}
              </span>
            ) : (
              <Link
                href={item.href}
                className={cn(
                  crumb,
                  'text-muted transition-colors duration-300 ease-standard hover:text-ink',
                )}
              >
                {index === 0 && <Icon icon="solar:home-2-linear" width={16} />}
                {item.label}
              </Link>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
