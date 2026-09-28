"use client";

/**
 * SchoolDrawer - the school detail drawer (right-hand slide-over).
 *
 * Layout follows the "User details" and calendar-modal references: a tinted
 * hero (logo, name, meta line with icons, status chips, copy-code chip), then
 * tabs (Overview, Subscription, Capacity, Security). The footer holds the two
 * everyday actions: Suspend / Activate and Edit details (edit opens the form
 * drawer on top of this one).
 *
 * Data: useSchool(id). The list row is shown instantly as placeholder while
 * the full record loads; phone 2 / 3 and location show skeletons until then.
 * The parent keeps `schoolId` after closing so the exit animation still shows
 * the content.
 */
import { Avatar, Badge, Button, Drawer, EmptyState, Icon, Skeleton, Tabs, type TabItem } from "@/components/ui";
import { useSchool, type SchoolDetails } from "@/hooks/useSchools";
import { CapacityTab, OverviewTab, SubscriptionTab } from "./SchoolDetailTabs";
import { SchoolSecurityTab } from "./SchoolSecurityTab";
import { SchoolStatusBadge, SubscriptionStatusBadge } from "./StatusBadge";
import type { SchoolPermissions } from "./permissions";
import type { SchoolActions } from "./useSchoolActions";
import { useErrorToast } from "./useErrorToast";
import { formatDate } from "./utils";

export interface SchoolDrawerProps {
  open: boolean;
  schoolId: string | null;
  onClose: () => void;
  onEdit: (id: string) => void;
  permissions: SchoolPermissions;
  actions: SchoolActions;
}

function Hero({ school, actions }: { school: SchoolDetails; actions: SchoolActions }) {
  return (
    <section className="rounded-2xl bg-primary-tint p-5 animate-fade-in">
      <div className="flex items-start gap-4">
        <span className="rounded-full bg-surface p-1 shadow-soft">
          <Avatar name={school.name} src={school.logo} size="xl" />
        </span>

        <div className="min-w-0 flex-1">
          <h3 className="font-display text-xl font-semibold break-words text-ink">{school.name}</h3>
          <p className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-ink-soft">
            <span className="inline-flex items-center gap-1.5 tabular-nums">
              <Icon icon="solar:hashtag-linear" width={16} className="text-muted" />
              School {school.school_id}
            </span>
            {school.location ? (
              <span className="inline-flex items-center gap-1.5">
                <Icon icon="solar:map-point-linear" width={16} className="text-muted" />
                {school.location}
              </span>
            ) : null}
            <span className="inline-flex items-center gap-1.5">
              <Icon icon="solar:calendar-linear" width={16} className="text-muted" />
              Expires {formatDate(school.subscription_expires_at)}
            </span>
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <SchoolStatusBadge status={school.status} />
        <SubscriptionStatusBadge status={school.subscription_status} />
        <Badge tone="neutral" icon="solar:layers-minimalistic-linear">
          {school.subscription_package}
        </Badge>
        {school.pending_status_change_at ? (
          <Badge tone="warning" icon="solar:clock-circle-linear">
            Status change queued {formatDate(school.pending_status_change_at)}
          </Badge>
        ) : null}
        <Button
          variant="secondary"
          size="sm"
          rightIcon="solar:copy-linear"
          onClick={() => void actions.copyCode(school.code)}
          className="ml-auto"
        >
          {school.code}
        </Button>
      </div>
    </section>
  );
}

function DrawerSkeleton() {
  return (
    <div className="space-y-5" aria-busy="true" aria-label="Loading school">
      <Skeleton className="h-40" rounded="2xl" />
      <Skeleton className="h-10 w-2/3" rounded="xl" />
      <Skeleton className="h-56" rounded="2xl" />
    </div>
  );
}

export function SchoolDrawer({ open, schoolId, onClose, onEdit, permissions, actions }: SchoolDrawerProps) {
  const query = useSchool(schoolId);
  useErrorToast(query.error, "Details load failed", "Failed to load school details.");

  const school = query.data?.data ?? null;
  const suspended = school?.status === "suspended";

  const tabs: TabItem[] = school
    ? [
        {
          id: "overview",
          label: "Overview",
          icon: "solar:buildings-2-linear",
          content: <OverviewTab school={school} loadingExtras={query.isPlaceholderData} />,
        },
        {
          id: "subscription",
          label: "Subscription",
          icon: "solar:card-linear",
          content: <SubscriptionTab school={school} />,
        },
        {
          id: "capacity",
          label: "Capacity",
          icon: "solar:chart-2-linear",
          content: <CapacityTab school={school} canWrite={permissions.canWrite} actions={actions} />,
        },
        {
          id: "security",
          label: "Security",
          icon: "solar:shield-keyhole-linear",
          content: <SchoolSecurityTab school={school} permissions={permissions} actions={actions} />,
        },
      ]
    : [];

  return (
    <Drawer
      open={open}
      onClose={onClose}
      size="lg"
      title="School details"
      subtitle="Profile, subscription, capacity and security."
      footer={
        school && permissions.canWrite ? (
          <>
            <Button
              variant="secondary"
              leftIcon={suspended ? "solar:play-circle-linear" : "solar:pause-circle-linear"}
              loading={actions.busyId === school.id}
              onClick={() => void actions.toggleStatus(school)}
            >
              {suspended ? "Activate" : "Suspend"}
            </Button>
            <Button leftIcon="solar:pen-2-linear" onClick={() => onEdit(school.id)}>
              Edit details
            </Button>
          </>
        ) : undefined
      }
    >
      {!school && query.isError ? (
        <EmptyState
          icon="solar:danger-triangle-linear"
          title="Could not load this school"
          description={query.error instanceof Error ? query.error.message : "Failed to load school details."}
          action={
            <Button variant="secondary" leftIcon="solar:refresh-linear" onClick={() => void query.refetch()}>
              Try again
            </Button>
          }
        />
      ) : !school ? (
        <DrawerSkeleton />
      ) : (
        <div className="space-y-5">
          <Hero school={school} actions={actions} />
          <Tabs items={tabs} defaultValue="overview" aria-label="School sections" />
        </div>
      )}
    </Drawer>
  );
}
