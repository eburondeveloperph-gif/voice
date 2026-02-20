import { NextRequest } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/db";
import { DEFAULT_AGENT_ID } from "@/lib/defaultAgent";
import { env } from "@/lib/env";
import { getActiveAssistantCredentialIds } from "@/lib/ev/credentials";
import { runGatewayHandler, runGatewayOptions } from "@/lib/ev/handler";
import { buildAssistantTemplate } from "@/lib/ev/template";
import { upstream } from "@/lib/ev/vapi-client";

export const dynamic = "force-dynamic";

const querySchema = z.object({
  agentId: z.string().min(1),
});

export async function OPTIONS(req: NextRequest) {
  return runGatewayOptions(req);
}

export async function GET(req: NextRequest) {
  return runGatewayHandler(req, "session-config.get", async ({ tenant }) => {
    if (!env.NEXT_PUBLIC_EV_WEB_KEY) {
      throw Object.assign(new Error("Public web key is not configured."), { status: 500 });
    }

    const parsed = querySchema.parse({
      agentId: req.nextUrl.searchParams.get("agentId"),
    });

    const agent = await prisma.agent.findFirst({
      where: {
        orgId: tenant.org.id,
        OR: [{ id: parsed.agentId }, { vapiAssistantId: parsed.agentId }],
      },
      include: { voice: true },
    });

    if (!agent) {
      const fallbackDefaultAssistantId = env.VAPI_DEFAULT_AGENT_ID || DEFAULT_AGENT_ID;
      if (parsed.agentId === DEFAULT_AGENT_ID || parsed.agentId === fallbackDefaultAssistantId) {
        return {
          payload: {
            assistantId: fallbackDefaultAssistantId,
            publicKey: env.NEXT_PUBLIC_EV_WEB_KEY,
            previewSessionId: "",
            allowedFeatures: ["preview-call", "live-transcript", "hangup"],
            timeoutSeconds: env.EV_PREVIEW_TIMEOUT_SECONDS,
          },
          resourceId: fallbackDefaultAssistantId,
        };
      }

      throw Object.assign(new Error("Agent not found. Create and save an agent first."), { status: 404 });
    }

    let remoteAssistantId = agent.vapiAssistantId;

    if (!remoteAssistantId) {
      const credentialIds = await getActiveAssistantCredentialIds(tenant.org.id);
      const created = await upstream.createAssistant(
        buildAssistantTemplate(agent, agent.voice, { credentialIds }),
      );
      remoteAssistantId = String(created.id ?? created.assistantId ?? "").trim();

      if (!remoteAssistantId) {
        throw Object.assign(new Error("Could not determine remote assistant id."), { status: 502 });
      }

      await prisma.agent.update({
        where: { id: agent.id },
        data: { vapiAssistantId: remoteAssistantId },
      });
    }

    const previewSession = await prisma.previewSession.create({
      data: {
        orgId: tenant.org.id,
        agentId: agent.id,
        userId: tenant.user.id,
        status: "ready",
      },
    });

    return {
      payload: {
        assistantId: remoteAssistantId,
        publicKey: env.NEXT_PUBLIC_EV_WEB_KEY,
        previewSessionId: previewSession.id,
        allowedFeatures: ["preview-call", "live-transcript", "hangup"],
        timeoutSeconds: env.EV_PREVIEW_TIMEOUT_SECONDS,
      },
      resourceId: agent.id,
    };
  });
}
