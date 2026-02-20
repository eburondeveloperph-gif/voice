import { NextRequest, NextResponse } from "next/server";

import { assertAllowedOrigin, withCors } from "@/lib/ev/cors";
import { checkRateLimit } from "@/lib/ev/rate-limit";
import { resolveTenant } from "@/lib/ev/tenant";
import type { GatewayAction, TenantContext } from "@/lib/ev/types";

export type GatewayRequestContext = {
  tenant: TenantContext;
  origin?: string;
  ipAddress?: string;
  userAgent?: string;
};

export async function authorizeGatewayRequest(req: NextRequest): Promise<GatewayRequestContext> {
  const origin = assertAllowedOrigin(req);
  const tenant = await resolveTenant(req);
  const ipAddress = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? undefined;
  const userAgent = req.headers.get("user-agent") ?? undefined;

  const rate = await checkRateLimit(tenant.org.id, tenant.user.id);
  if (!rate.allowed) {
    throw Object.assign(new Error(rate.message), { status: rate.status });
  }

  return { tenant, origin, ipAddress, userAgent };
}

export function okJson<T>(payload: T, origin?: string, status = 200): NextResponse {
  return withCors(NextResponse.json(payload, { status }), origin);
}

export function errorJson(
  error: unknown,
  origin?: string,
  fallbackStatus = 500,
  action?: GatewayAction,
): NextResponse {
  const anyError = error as { message?: string; status?: number; details?: unknown };
  const status = anyError.status ?? fallbackStatus;
  const payload = {
    error: anyError.message ?? "Unexpected gateway error.",
    action,
    details: anyError.details,
  };
  return withCors(NextResponse.json(payload, { status }), origin);
}
