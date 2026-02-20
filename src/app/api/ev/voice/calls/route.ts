import { NextRequest } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/db";
import { DEFAULT_AGENT_PHONE_ID } from "@/lib/defaultAgent";
import { runGatewayHandler, runGatewayOptions } from "@/lib/ev/handler";
import { callIdFromUpstream, upsertCallLog } from "@/lib/ev/calls";
import { upstream } from "@/lib/ev/vapi-client";

export const dynamic = "force-dynamic";

const createCallSchema = z.object({
  agentId: z.string().min(1),
  to: z.string().min(5),
  phoneNumberId: z.string().optional(),
});

export async function OPTIONS(req: NextRequest) {
  return runGatewayOptions(req);
}

export async function GET(req: NextRequest) {
  return runGatewayHandler(req, "calls.list", async ({ tenant }) => {
    const sync = req.nextUrl.searchParams.get("sync") === "true";

    if (sync) {
      const upstreamCalls = await upstream.listCalls();
      await Promise.all(
        upstreamCalls.map((call) =>
          upsertCallLog({
            orgId: tenant.org.id,
            upstreamCall: call,
            source: "sync",
          }),
        ),
      );
    }

    const statusFilter = req.nextUrl.searchParams.get("status")?.trim();
    const query = req.nextUrl.searchParams.get("q")?.trim();

    const calls = await prisma.callLog.findMany({
      where: {
        orgId: tenant.org.id,
        ...(statusFilter ? { status: statusFilter } : {}),
        ...(query
          ? {
              OR: [
                { fromNumber: { contains: query } },
                { toNumber: { contains: query } },
                { vapiCallId: { contains: query } },
              ],
            }
          : {}),
      },
      orderBy: {
        startedAt: "desc",
      },
      take: 250,
      include: {
        agent: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return {
      payload: {
        calls,
      },
    };
  });
}

export async function POST(req: NextRequest) {
  return runGatewayHandler(req, "calls.create", async ({ tenant }) => {
    const parsed = createCallSchema.parse(await req.json());

    const agent = await prisma.agent.findFirst({
      where: {
        orgId: tenant.org.id,
        OR: [{ id: parsed.agentId }, { vapiAssistantId: parsed.agentId }],
      },
    });

    if (!agent) {
      throw Object.assign(new Error("Agent not found."), { status: 404 });
    }

    if (!agent.vapiAssistantId) {
      throw Object.assign(new Error("Deploy this agent before starting production calls."), { status: 409 });
    }

    const upstreamCall = await upstream.createCall({
      assistantId: agent.vapiAssistantId,
      customer: {
        number: parsed.to,
      },
      phoneNumberId: parsed.phoneNumberId ?? DEFAULT_AGENT_PHONE_ID,
      metadata: {
        orgId: tenant.org.id,
        agentId: agent.id,
        source: "eburon-dashboard",
      },
    });

    await upsertCallLog({
      orgId: tenant.org.id,
      agentId: agent.id,
      upstreamCall,
      source: "production",
    });

    return {
      status: 201,
      payload: {
        call: upstreamCall,
      },
      resourceId: callIdFromUpstream(upstreamCall),
    };
  });
}
