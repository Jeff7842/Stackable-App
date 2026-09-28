"use client";

// =============================================================================
// PostHog — session monitoring (pageviews, clicks via autocapture, session
// replay if enabled on the project). Silently does nothing when
// NEXT_PUBLIC_POSTHOG_KEY is unset, so this file is always safe to ship.
// =============================================================================

import { Suspense, useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import posthog from "posthog-js";
import { PostHogProvider as Provider, usePostHog } from "posthog-js/react";

const KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;

if (typeof window !== "undefined" && KEY) {
  posthog.init(KEY, {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com",
    // The App Router does full client-side navigations without a page reload,
    // so PostHog's own auto-pageview (which listens for History API calls) can
    // double-count route changes; we send the pageview ourselves below instead.
    capture_pageview: false,
    capture_pageleave: true,
    person_profiles: "identified_only",
  });
}

/** Fires one $pageview per route change (path + query), App-Router style. */
function PageviewTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const ph = usePostHog();

  useEffect(() => {
    if (!KEY || !pathname) return;
    const query = searchParams.toString();
    ph?.capture("$pageview", { $current_url: query ? `${pathname}?${query}` : pathname });
  }, [pathname, searchParams, ph]);

  return null;
}

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  if (!KEY) return <>{children}</>;
  return (
    <Provider client={posthog}>
      <Suspense fallback={null}>
        <PageviewTracker />
      </Suspense>
      {children}
    </Provider>
  );
}
