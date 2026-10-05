"use client";

// Public demo entry: pick a role, explore the real screens with sample data. No login, nothing is saved.
import { Icon } from "@/components/ui";
import { startDemo } from "@/components/demo/DemoProvider";
import { ROLE_HOME, type Role } from "@/lib/validation/shared";

const ROLES_SHOWN: Array<{ role: Role; label: string; blurb: string; icon: string }> = [
  { role: "parent", label: "Parent", blurb: "Children, fees, notices and safety alerts.", icon: "user-hands" },
  { role: "student", label: "Student", blurb: "Homework, the AI tutor, tests and grades.", icon: "square-academic-cap" },
  { role: "teacher", label: "Teacher", blurb: "Classes, marking, attendance and timetable.", icon: "users-group-two-rounded" },
  { role: "admin", label: "Principal", blurb: "School overview, people, academics and approvals.", icon: "buildings-2" },
  { role: "finance", label: "Finance", blurb: "Fee structures, invoices and reconciliation.", icon: "wallet-money" },
  { role: "secretary", label: "Secretary", blurb: "Records, pickup checks and announcements.", icon: "folder-with-files" },
  { role: "driver", label: "Driver", blurb: "Route manifest and bus duty.", icon: "bus" },
  { role: "super-admin", label: "Platform admin", blurb: "Schools, users, audit trail and integrations.", icon: "code-square" },
];

export default function DemoPage() {
  return (
    <main className="mx-auto min-h-screen max-w-5xl bg-canvas px-4 py-12 text-ink sm:px-6">
      <h1 className="text-3xl font-bold tracking-tight">Try Stackable</h1>
      <p className="mt-2 max-w-xl text-ink-soft">
        Choose a role to explore the screens with sample data. No sign-in needed. Anything you change is kept only
        for this browser session and disappears when it ends.
      </p>
      <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {ROLES_SHOWN.map(({ role, label, blurb, icon }) => (
          <li key={role}>
            <button
              type="button"
              onClick={() => {
                startDemo(role);
                window.location.href = ROLE_HOME[role];
              }}
              className="flex h-full w-full flex-col items-start gap-3 rounded-2xl bg-surface p-5 text-left shadow-soft ring-1 ring-ghost transition hover:-translate-y-0.5 hover:shadow-lift focus-visible:outline-2 focus-visible:outline-primary"
            >
              <span className="grid size-10 place-items-center rounded-xl bg-primary-tint text-primary-ink">
                <Icon icon={`solar:${icon}-linear`} width={22} />
              </span>
              <span className="font-semibold">{label}</span>
              <span className="text-sm text-ink-soft">{blurb}</span>
            </button>
          </li>
        ))}
      </ul>
      <p className="mt-8 text-sm text-muted">
        Some pages show &quot;Coming soon&quot; while we build them. Have an account? <a className="underline" href="/login">Sign in</a>.
      </p>
    </main>
  );
}
