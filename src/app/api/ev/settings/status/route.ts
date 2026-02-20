import { NextRequest } from "next/server";

import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { runGatewayHandler, runGatewayOptions } from "@/lib/ev/handler";

export const dynamic = "force-dynamic";

export async function OPTIONS(req: NextRequest) {
  return runGatewayOptions(req);
}

export async function GET(req: NextRequest) {
  return runGatewayHandler(req, "settings.status", async ({ tenant }) => {
    const [latestAudit, latestCall] = await Promise.all([
      prisma.gatewayAuditLog.findFirst({
        where: { orgId: tenant.org.id },
        orderBy: { createdAt: "desc" },
      }),
      prisma.callLog.findFirst({
        where: { orgId: tenant.org.id },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    return {
      payload: {
        org: {
          id: tenant.org.id,
          name: tenant.org.name,
          slug: tenant.org.slug,
        },
        gateway: {
          privateTokenConfigured: Boolean(env.EV_PRIVATE_TOKEN),
          publicWebKeyConfigured: Boolean(env.NEXT_PUBLIC_EV_WEB_KEY),
          allowedOrigins: env.allowedOrigins,
          lastAuditAt: latestAudit?.createdAt ?? null,
        },
        operations: {
          lastCallAt: latestCall?.createdAt ?? null,
          previewTimeoutSeconds: env.EV_PREVIEW_TIMEOUT_SECONDS,
          userRateLimitPerMinute: env.EV_RATE_LIMIT_USER_PER_MINUTE,
          orgRateLimitPerMinute: env.EV_RATE_LIMIT_ORG_PER_MINUTE,
        },
      },
    };
  });
}
