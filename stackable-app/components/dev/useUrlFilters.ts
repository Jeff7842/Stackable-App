"use client";

// =============================================================================
// useUrlFilters - list filters that live in the URL query string.
// -----------------------------------------------------------------------------
//   const { filters, update } = useUrlFilters(parseUsersFilters, USERS_DEFAULTS);
//   update({ role: "teacher", page: 1 });      // merges, then router.replace()
//
// Why: /dev/users?schoolId=<id> (from the schools drawer) and shared links must
// work, and refresh / back must keep the filters.
//
// How it stays snappy: the URL is the source of truth (via useSearchParams), but
// router.replace is a server round trip, so a plain controlled <select> would
// snap back to its old value until the URL catches up. useOptimistic shows the new
// filters immediately and drops them once the URL has the same values.
//
// `update` merges into the LATEST requested filters (a ref), not the last rendered
// ones, because DataTable can fire two callbacks in one event (page size, then
// "reset to page 1"); merging into stale state would lose the first change.
// Values equal to their default (or empty) are removed from the URL, and query
// params this page does not own are left alone.
// =============================================================================

import { useEffect, useOptimistic, useRef, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

export type UrlFilterValues = Record<string, string | number>;

export function useUrlFilters<F extends UrlFilterValues>(
  parse: (params: URLSearchParams) => F,
  defaults: F,
) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  const fromUrl = parse(new URLSearchParams(searchParams.toString()));
  const [filters, setOptimistic] = useOptimistic(fromUrl);

  // Latest requested filters (survives two update() calls in one event).
  const latest = useRef(filters);
  useEffect(() => {
    latest.current = filters;
  }, [filters]);

  const update = (patch: Partial<F>) => {
    const next = { ...latest.current, ...patch } as F;
    latest.current = next;

    const params = new URLSearchParams(searchParams.toString());
    for (const key of Object.keys(defaults)) {
      const value = next[key];
      if (value === "" || value === undefined || value === defaults[key]) params.delete(key);
      else params.set(key, String(value));
    }
    const qs = params.toString();

    startTransition(() => {
      setOptimistic(next);
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    });
  };

  return { filters, update };
}
