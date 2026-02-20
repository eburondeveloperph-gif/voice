import { NextRequest } from "next/server";

import { prisma } from "@/lib/db";
import { getActiveAssistantCredentialIds } from "@/lib/ev/credentials";
import { runGatewayHandler, runGatewayOptions } from "@/lib/ev/handler";
import { serializeAgent } from "@/lib/ev/serializers";
import { buildAssistantTemplate } from "@/lib/ev/template";
import { upstream } from "@/lib/ev/vapi-client";

export const dynamic = "force-dynamic";

export async function OPTIONS(req: NextRequest) {
  return runGatewayOptions(req);
}

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  return runGatewayHandler(req, "agents.deploy", async ({ tenant }) => {
    const { id } = await context.params;

    const agent = await prisma.agent.findFirst({
      where: {
        orgId: tenant.org.id,
        OR: [{ id }, { vapiAssistantId: id }],
      },
      include: { voice: true },
    });

    if (!agent) {
      throw Object.assign(new Error("Agent not found."), { status: 404 });
    }

    let remoteAssistantId = agent.vapiAssistantId;
    const credentialIds = await getActiveAssistantCredentialIds(tenant.org.id);

    if (remoteAssistantId) {
      await upstream.updateAssistant(
        remoteAssistantId,
        buildAssistantTemplate(agent, agent.voice, { credentialIds }),
      );
    } else {
      const created = await upstream.createAssistant(
        buildAssistantTemplate(agent, agent.voice, { credentialIds }),
      );
      remoteAssistantId = String(created.id ?? created.assistantId ?? "").trim();
      if (!remoteAssistantId) {
        throw Object.assign(new Error("Could not determine remote assistant id."), { status: 502 });
      }
    }

    const deployed = await prisma.agent.update({
      where: { id: agent.id },
      data: {
        vapiAssistantId: remoteAssistantId,
        status: "deployed",
        deployedAt: new Date(),
        isLocked: true,
      },
      include: { voice: true },
    });

    return {
      payload: {
        agent: serializeAgent(deployed),
        message: "Agent is now live.",
      },
      resourceId: deployed.id,
    };
  });
}
