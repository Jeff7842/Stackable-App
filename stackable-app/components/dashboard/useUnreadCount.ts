"use client";

// =============================================================================
// useUnreadCount - how many unread notifications the signed-in user has.
// -----------------------------------------------------------------------------
// PLACEHOLDER. The top-bar bell only shows its dot when `count > 0`, so today
// (count is always 0) no dot is shown. The Communication lane (Lane E) replaces
// the internals with a real query (e.g. GET /api/notifications/unread-count via
// TanStack Query, polled every 30-60 s). Keep the return shape stable:
//   { count: number }
// =============================================================================

export type UnreadCount = { count: number };

export function useUnreadCount(): UnreadCount {
  // TODO(lane E): replace with useQuery(qk.notifications.list({ unread: true })).
  return { count: 0 };
}
