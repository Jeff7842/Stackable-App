"use client";

// Demo mode runtime: while the demo cookie is set, /api/* calls are answered in the browser.
import { useEffect, useState, type ReactNode } from "react";
import { DEMO_COOKIE, parseDemoRole } from "@/lib/demo/mode";
import { handleDemoRequest } from "@/lib/demo/router";
import { registerDemoHandlers, seedDb } from "@/lib/demo/fixtures";
import { clearDb, loadDb, saveDb } from "@/lib/demo/store";
import type { Role } from "@/lib/validation/shared";

function readCookie(): Role | null {
  const match = document.cookie.split("; ").find((c) => c.startsWith(`${DEMO_COOKIE}=`));
  return parseDemoRole(match?.split("=")[1]);
}

export function startDemo(role: Role): void {
  document.cookie = `${DEMO_COOKIE}=${role}; path=/; SameSite=Lax`; // session cookie: no expiry
  clearDb();
}

export function exitDemo(): void {
  document.cookie = `${DEMO_COOKIE}=; path=/; max-age=0`;
  clearDb();
}

let patched = false;

function installFetchPatch(): void {
  if (patched) return;
  patched = true;
  registerDemoHandlers();
  const real = window.fetch.bind(window);
  window.fetch = async (input, init) => {
    const role = readCookie();
    const href = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const url = new URL(href, window.location.origin);
    if (!role || url.origin !== window.location.origin || !url.pathname.startsWith("/api/")) {
      return real(input, init);
    }
    const method = (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();
    let body: unknown;
    if (typeof init?.body === "string") {
      try {
        body = JSON.parse(init.body);
      } catch {
        body = undefined;
      }
    }
    const db = loadDb(() => seedDb(role));
    const out = handleDemoRequest(method, url, body, role, db);
    saveDb(db);
    if (url.pathname === "/api/auth/logout") exitDemo();
    return new Response(JSON.stringify(out.body), {
      status: out.status,
      headers: { "content-type": "application/json" },
    });
  };
}

export function DemoProvider({ children }: { children: ReactNode }) {
  // Installed during the first render so it is ready before any child query fires.
  useState(() => {
    if (typeof window !== "undefined" && readCookie()) installFetchPatch();
  });
  // The pill appears after mount so server and client markup match.
  const [active, setActive] = useState(false);
  useEffect(() => setActive(readCookie() !== null), []);

  return (
    <>
      {children}
      {active ? <DemoPill /> : null}
    </>
  );
}

function DemoPill() {
  return (
    <div className="fixed bottom-4 right-4 z-[60] flex items-center gap-2 rounded-full bg-ink px-3 py-1.5 text-xs font-medium text-canvas shadow-pop">
      <span>Demo mode: changes last only for this session</span>
      <button
        type="button"
        className="rounded-full bg-canvas/15 px-2 py-0.5 hover:bg-canvas/25"
        onClick={() => {
          exitDemo();
          window.location.href = "/demo";
        }}
      >
        Exit
      </button>
    </div>
  );
}
