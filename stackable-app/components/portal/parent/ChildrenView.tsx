"use client";

// =============================================================================
// Parent children page body (/family/children). Data: useParentChildren()
// (GET /api/parent/children). A clean list of compact rows, one per child; a search
// pill appears when there are several (4 or more). No linked child -> EmptyState.
// A failed background refetch keeps the last good data.
// =============================================================================

import { useState } from "react";
import { Button, EmptyState, Input } from "@/components/ui";
import { useParentChildren } from "@/hooks/useParentChildren";
import { errorMessage, pluralize } from "../student/helpers";
import { QueryError } from "../student/Panel";
import { ChildRow } from "./ChildCardView";
import { ChildrenListSkeleton } from "./FamilySkeletons";
import { filterChildren } from "./helpers";

const SEARCH_FROM = 4;

export default function ChildrenView() {
  const query = useParentChildren();
  const [search, setSearch] = useState("");
  const kids = query.data;

  if (query.isError && !kids) {
    return (
      <QueryError
        title="We could not load your children"
        message={errorMessage(query.error)}
        onRetry={() => void query.refetch()}
        retrying={query.isFetching}
      />
    );
  }
  if (!kids) return <ChildrenListSkeleton />;

  if (kids.length === 0) {
    return (
      <div className="animate-fade-up rounded-2xl bg-surface shadow-soft ring-1 ring-ghost">
        <EmptyState
          icon="solar:users-group-rounded-linear"
          title="No children linked yet"
          description="No children are linked to your account yet. Please contact your school office and they will link them for you."
          action={
            <Button
              variant="secondary"
              leftIcon="solar:refresh-linear"
              loading={query.isFetching}
              onClick={() => void query.refetch()}
            >
              Check again
            </Button>
          }
        />
      </div>
    );
  }

  const searchable = kids.length >= SEARCH_FROM;
  const shown = searchable ? filterChildren(kids, search) : kids;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-ink-soft" aria-live="polite">
          {search.trim() && searchable
            ? `${shown.length} of ${pluralize(kids.length, "child", "children")}`
            : `${pluralize(kids.length, "child", "children")} linked to your account`}
        </p>
        <div className="flex items-center gap-2">
          {searchable ? (
            <Input
              size="sm"
              pill
              type="search"
              leftIcon="solar:magnifer-linear"
              placeholder="Search by name, class or admission no"
              aria-label="Search your children"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full sm:w-72"
            />
          ) : null}
          <Button
            variant="ghost"
            size="sm"
            leftIcon="solar:refresh-linear"
            loading={query.isFetching}
            onClick={() => void query.refetch()}
            aria-label="Refresh children"
          >
            Refresh
          </Button>
        </div>
      </div>

      {shown.length === 0 ? (
        <div className="rounded-2xl bg-surface shadow-soft ring-1 ring-ghost">
          <EmptyState
            icon="solar:magnifer-linear"
            title="No children match"
            description="Try a different name, class or admission number."
            action={
              <Button variant="secondary" size="sm" onClick={() => setSearch("")}>
                Clear search
              </Button>
            }
          />
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {shown.map((child, i) => (
            <li key={child.studentId}>
              <ChildRow child={child} index={i} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
