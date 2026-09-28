"use client";

// Ties PostHog events to the real signed-in user (not the impersonation target),
// so "session monitoring" reads as one person across a whole visit. Call once
// from DashboardShell, which already fetches `me` via useMe().
import { useEffect } from "react";
import posthog from "posthog-js";
import type { Me } from "@/hooks/useMe";

export function useIdentifyUser(me: Me | undefined): void {
  useEffect(() => {
    if (!me || !process.env.NEXT_PUBLIC_POSTHOG_KEY) return;
    // While impersonating, `me` describes the TARGET (role/school/etc.), but the person
    // actually clicking is the super-admin in `impersonatedBy`. Identify as whoever is
    // really at the keyboard, so events land on one real account either way.
    const actorId = me.impersonatedBy?.id ?? me.id;
    posthog.identify(actorId, {
      email: me.impersonatedBy ? undefined : (me.email ?? undefined),
      role: me.impersonatedBy?.role ?? me.role,
      school_id: me.impersonatedBy ? undefined : me.schoolId,
      school_name: me.impersonatedBy ? undefined : me.schoolName,
      viewing_as: me.impersonatedBy ? { id: me.id, role: me.role, school_id: me.schoolId } : undefined,
    });
  }, [me]);
}
