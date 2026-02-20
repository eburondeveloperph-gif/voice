import { NextRequest } from "next/server";

import { prisma } from "@/lib/db";
import { runGatewayHandler, runGatewayOptions } from "@/lib/ev/handler";

export const dynamic = "force-dynamic";

export async function OPTIONS(req: NextRequest) {
  return runGatewayOptions(req);
}

export async function GET(req: NextRequest) {
  return runGatewayHandler(req, "dashboard.overview", async ({ tenant }) => {
    const [agentsCount, liveAgentsCount, callsCount, contactsCount, numberCount, billingNet] = await Promise.all([
      prisma.agent.count({ where: { orgId: tenant.org.id } }),
      prisma.agent.count({ where: { orgId: tenant.org.id, status: "deployed" } }),
      prisma.callLog.count({ where: { orgId: tenant.org.id } }),
      prisma.contact.count({ where: { orgId: tenant.org.id } }),
      prisma.phoneNumber.count({ where: { orgId: tenant.org.id, status: "active" } }),
      prisma.billingLedger.aggregate({
        where: { orgId: tenant.org.id },
        _sum: { amountCents: true },
      }),
    ]);

    return {
      payload: {
        org: {
          id: tenant.org.id,
          name: tenant.org.name,
        },
        metrics: {
          agentsCount,
          liveAgentsCount,
          callsCount,
          contactsCount,
          numberCount,
          balanceCents: billingNet._sum.amountCents ?? 0,
        },
      },
    };
  });
}
