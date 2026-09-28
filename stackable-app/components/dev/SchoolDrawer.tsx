"use client";

// SchoolDrawer - right drawer with every DevSchoolRow field as calm info blocks
// (modelled on the "User details" reference: a tinted header block, then quiet
// label / value tiles). "View users" jumps to /dev/users?schoolId=<id>.

import { Avatar, Badge, Button, Drawer } from "@/components/ui";
import type { DevSchoolRow } from "@/lib/dev-types";
import { formatDateTime, statusTone, titleCase } from "./format";
import { InfoBlock } from "./InfoBlock";

export function SchoolDrawer({
  school,
  open,
  onClose,
}: {
  school: DevSchoolRow | null;
  open: boolean;
  onClose: () => void;
}) {
  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={school?.name ?? "School"}
      subtitle={school ? `School code ${school.code}` : undefined}
      size="md"
      footer={
        school ? (
          <>
            <Button variant="ghost" onClick={onClose}>
              Close
            </Button>
            <Button
              as="a"
              href={`/dev/users?schoolId=${encodeURIComponent(school.id)}`}
              leftIcon="solar:users-group-two-rounded-linear"
            >
              View users
            </Button>
          </>
        ) : null
      }
    >
      {school ? (
        <div className="space-y-5">
          <section className="flex items-center gap-4 rounded-2xl bg-recessed p-4">
            <Avatar name={school.name} size="lg" />
            <div className="min-w-0">
              <p className="truncate font-display text-lg font-semibold text-ink">{school.name}</p>
              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                <Badge tone={statusTone(school.status)} dot>
                  {titleCase(school.status)}
                </Badge>
                <Badge tone="neutral">{titleCase(school.subscriptionPackage)}</Badge>
              </div>
            </div>
          </section>

          <dl className="grid gap-3 sm:grid-cols-2">
            <InfoBlock label="Users">
              <span className="tabular-nums">{school.userCount.toLocaleString("en-US")}</span>
            </InfoBlock>
            <InfoBlock label="Students">
              <span className="tabular-nums">{school.studentCount.toLocaleString("en-US")}</span>
            </InfoBlock>
            <InfoBlock label="Package">{titleCase(school.subscriptionPackage)}</InfoBlock>
            <InfoBlock label="Subscription">
              <Badge tone={statusTone(school.subscriptionStatus)} size="sm">
                {titleCase(school.subscriptionStatus)}
              </Badge>
            </InfoBlock>
            <InfoBlock label="Location">{school.location ?? "Not set"}</InfoBlock>
            <InfoBlock label="Contact email">{school.email ?? "Not set"}</InfoBlock>
            <InfoBlock label="Created" wide>
              {formatDateTime(school.createdAt)}
            </InfoBlock>
            <InfoBlock label="School code" mono copy={school.code}>
              {school.code}
            </InfoBlock>
            <InfoBlock label="School ID" mono copy={school.id}>
              {school.id}
            </InfoBlock>
          </dl>
        </div>
      ) : null}
    </Drawer>
  );
}
