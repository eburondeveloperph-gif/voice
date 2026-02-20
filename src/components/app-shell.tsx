"use client";

import { usePathname } from "next/navigation";
import { type ReactNode } from "react";

import { NavShell } from "@/components/nav-shell";

const INTERNAL_ROOT_SEGMENTS = new Set([
  "dashboard",
  "create",
  "agents",
  "voices",
  "dialer",
  "calls",
  "call-logs",
  "contacts",
  "numbers",
  "settings",
  "crm",
]);

function isInternalRoute(pathname: string): boolean {
  const firstSegment = pathname.split("/").filter(Boolean)[0] ?? "";
  return INTERNAL_ROOT_SEGMENTS.has(firstSegment);
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "/";

  // Middleware handles all redirect routing now.
  // We just need to decide whether to wrap the content in NavShell or not.
  if (isInternalRoute(pathname)) {
    return <NavShell>{children}</NavShell>;
  }

  return <>{children}</>;
}
