import { NextRequest, NextResponse } from "next/server";

import { writeAuditLog } from "@/lib/ev/audit";
import { preflight } from "@/lib/ev/cors";
import { authorizeGatewayRequest, errorJson, okJson, type GatewayRequestContext } from "@/lib/ev/http";
import type { GatewayAction } from "@/lib/ev/types";

type HandlerResult = {
  payload: unknown;
  status?: number;
  resourceId?: string;
};

export async function runGatewayHandler(
  req: NextRequest,
  action: GatewayAction,
  handler: (ctx: GatewayRequestContext) => Promise<HandlerResult>,
): Promise<NextResponse> {
  let ctx: GatewayRequestContext | null = null;

  try {
    ctx = await authorizeGatewayRequest(req);
    const result = await handler(ctx);

    await writeAuditLog({
      context: ctx.tenant,
      action,
      method: req.method,
      path: req.nextUrl.pathname,
      statusCode: result.status ?? 200,
      resourceId: result.resourceId,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
    });

    return okJson(result.payload, ctx.origin, result.status ?? 200);
  } catch (error) {
    const statusCode = (error as { status?: number }).status ?? 500;

    if (ctx) {
      await writeAuditLog({
        context: ctx.tenant,
        action,
        method: req.method,
        path: req.nextUrl.pathname,
        statusCode,
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
      });
    }

    return errorJson(error, ctx?.origin, statusCode, action);
  }
}

export function runGatewayOptions(req: NextRequest): NextResponse {
  const origin = req.headers.get("origin") ?? undefined;
  return preflight(origin);
}
