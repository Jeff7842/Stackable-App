// =============================================================================
// TanStack Query client settings.
// -----------------------------------------------------------------------------
// Sensible defaults for the whole app. "staleTime" = how long data is considered
// fresh before a background refetch. Refetch-on-focus gives us "near-live" data
// without websockets (our chosen approach this phase).
// =============================================================================

import { QueryClient } from "@tanstack/react-query";

export function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000, // 30s
        gcTime: 5 * 60_000, // 5 min
        retry: 1,
        refetchOnWindowFocus: true,
      },
      mutations: {
        retry: 0,
      },
    },
  });
}
