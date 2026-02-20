import { NextRequest, NextResponse } from "next/server";

import { env } from "@/lib/env";

export function assertAllowedOrigin(req: NextRequest): string | undefined {
  const origin = req.headers.get("origin") ?? undefined;

  // Non-browser clients usually omit origin.
  if (!origin) {
    return undefined;
  }

  if (!env.allowedOrigins.includes(origin)) {
    throw Object.assign(new Error("Origin is not allowed."), { status: 403 });
  }

  return origin;
}

export function withCors(res: NextResponse, origin?: string): NextResponse {
  const allowOrigin = origin && env.allowedOrigins.includes(origin) ? origin : env.allowedOrigins[0] ?? "*";
  res.headers.set("Access-Control-Allow-Origin", allowOrigin);
  res.headers.set("Access-Control-Allow-Credentials", "true");
  res.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Org-Id, X-User-Id");
  res.headers.set("Access-Control-Allow-Methods", "GET, POST, PATCH, OPTIONS");
  res.headers.set("Vary", "Origin");
  return res;
}

export function preflight(origin?: string): NextResponse {
  return withCors(new NextResponse(null, { status: 204 }), origin);
}
