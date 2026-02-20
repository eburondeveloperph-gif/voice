import { NextRequest } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/db";
import { DEFAULT_AGENT_PHONE_ID } from "@/lib/defaultAgent";
import { runGatewayHandler, runGatewayOptions } from "@/lib/ev/handler";
import { callIdFromUpstream, upsertCallLog } from "@/lib/ev/calls";
import { upstream } from "@/lib/ev/vapi-client";

export const dynamic = "force-dynamic";

const outboundCallSchema = z.object({
  assistantId: z.string().trim().min(1),
  phoneNumberId: z.string().trim().min(1).optional(),
  customerNumber: z.string().trim().min(5),
  customerName: z.string().trim().min(1).optional(),
});

async function resolveAssistantForCall(orgId: string, requestedAssistantId: string) {
  const agent = await prisma.agent.findFirst({
    where: {
      orgId,
      OR: [{ id: requestedAssistantId }, { vapiAssistantId: requestedAssistantId }],
    },
    select: {
      id: true,
      vapiAssistantId: true,
    },
  });

  if (!agent) {
    return {
      assistantId: requestedAssistantId,
      localAgentId: null,
    };
  }

  if (!agent.vapiAssistantId) {
    throw Object.assign(new Error("Deploy this agent before starting outbound calls."), { status: 409 });
  }

  return {
    assistantId: agent.vapiAssistantId,
    localAgentId: agent.id,
  };
}

export async function OPTIONS(req: NextRequest) {
  return runGatewayOptions(req);
}

export async function POST(req: NextRequest) {
  return runGatewayHandler(req, "calls.outbound", async ({ tenant }) => {
    const parsed = outboundCallSchema.parse(await req.json());
    const outboundPhoneNumberId = parsed.phoneNumberId || DEFAULT_AGENT_PHONE_ID;
    const resolved = await resolveAssistantForCall(tenant.org.id, parsed.assistantId);

    const callResult = await upstream.createCall({
      assistantId: resolved.assistantId,
      phoneNumberId: outboundPhoneNumberId,
      customer: {
        number: parsed.customerNumber,
        ...(parsed.customerName ? { name: parsed.customerName } : {}),
      },
      metadata: {
        orgId: tenant.org.id,
        source: "eburon-dashboard",
        ...(resolved.localAgentId ? { agentId: resolved.localAgentId } : {}),
      },
    });

    await upsertCallLog({
      orgId: tenant.org.id,
      agentId: resolved.localAgentId ?? undefined,
      upstreamCall: callResult,
      source: "production",
    });

    const callId = callIdFromUpstream(callResult);
    return {
      payload: {
        success: true,
        callId: callId || "",
        status: String(callResult.status ?? "queued"),
      },
      resourceId: callId || undefined,
    };
  });
}
