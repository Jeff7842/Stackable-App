// =============================================================================
// QueryProvider — makes TanStack Query available to the whole app.
// -----------------------------------------------------------------------------
// Wrap the app once (in app/layout.tsx, alongside the existing Toast and
// Confirmation providers). We create the client with useState so it's made once
// per browser tab, not on every render.
// =============================================================================

"use client";

import { useState, type ReactNode } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { makeQueryClient } from "@/lib/query/client";

export function QueryProvider({ children }: { children: ReactNode }) {
  const [client] = useState(makeQueryClient);
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
