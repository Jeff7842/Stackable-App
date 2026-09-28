"use client";

import { formatDateTime, formatRelative } from "./format";
import { useNow } from "./useNow";

/** "5 min ago" that keeps itself fresh; the exact time is in the tooltip and the <time> element. */
export function RelativeTime({ iso, className }: { iso: string | null | undefined; className?: string }) {
  const now = useNow();
  if (!iso) return <span className={className}>-</span>;
  return (
    <time dateTime={iso} title={formatDateTime(iso)} className={className}>
      {formatRelative(iso, now)}
    </time>
  );
}
