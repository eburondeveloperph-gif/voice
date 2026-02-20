import { NextRequest } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/db";
import { getActiveAssistantCredentialIds } from "@/lib/ev/credentials";
import { resolveDefaultApprovedVoice } from "@/lib/ev/default-voice";
import { runGatewayHandler, runGatewayOptions } from "@/lib/ev/handler";
import { serializeAgent } from "@/lib/ev/serializers";
import { buildAssistantTemplate } from "@/lib/ev/template";
import { agentInputSchema, rejectForbiddenKeys } from "@/lib/ev/validation";
import { upstream } from "@/lib/ev/vapi-client";

export const dynamic = "force-dynamic";

const updateAgentSchema = z.object({
  name: agentInputSchema.shape.name,
  intro: agentInputSchema.shape.intro,
  firstMessageMode: agentInputSchema.shape.firstMessageMode,
  systemPrompt: agentInputSchema.shape.systemPrompt,
  voiceId: agentInputSchema.shape.voiceId.optional(),
}).strict();

export async function OPTIONS(req: NextRequest) {
  return runGatewayOptions(req);
}

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  return runGatewayHandler(req, "agents.list", async ({ tenant }) => {
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

    return {
      payload: {
        agent: serializeAgent(agent),
      },
      resourceId: agent.id,
    };
  });
}

export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  return runGatewayHandler(req, "agents.update", async ({ tenant }) => {
    const { id } = await context.params;
    const raw = (await req.json()) as Record<string, unknown>;
    rejectForbiddenKeys(raw);

    const parsed = updateAgentSchema.parse(raw);

    const existing = await prisma.agent.findFirst({
      where: {
        orgId: tenant.org.id,
        OR: [{ id }, { vapiAssistantId: id }],
      },
      include: { voice: true },
    });

    if (!existing) {
      throw Object.assign(new Error("Agent not found."), { status: 404 });
    }

    if (existing.isLocked && existing.status === "deployed") {
      throw Object.assign(new Error("This deployed agent is locked. Use redeploy workflow."), { status: 409 });
    }

    const voice = await resolveDefaultApprovedVoice(parsed.voiceId || existing.voiceId);

    if (!voice) {
      throw Object.assign(new Error("No approved voices are available. Sync voices first."), { status: 409 });
    }

    const credentialIds = await getActiveAssistantCredentialIds(tenant.org.id);
    const assistantTemplate = buildAssistantTemplate(
      {
        name: parsed.name,
        intro: parsed.intro,
        firstMessageMode: parsed.firstMessageMode ?? existing.firstMessageMode,
        systemPrompt: parsed.systemPrompt,
      },
      voice,
      { credentialIds },
    );

    let remoteAssistantId = existing.vapiAssistantId;
    if (remoteAssistantId) {
      await upstream.updateAssistant(
        remoteAssistantId,
        assistantTemplate,
      );
    } else {
      const created = await upstream.createAssistant(assistantTemplate);
      remoteAssistantId = String(created.id ?? created.assistantId ?? "").trim();
      if (!remoteAssistantId) {
        throw Object.assign(new Error("Could not determine remote assistant id."), { status: 502 });
      }
    }

    const updated = await prisma.agent.update({
      where: { id: existing.id },
      data: {
        name: parsed.name,
        intro: parsed.intro,
        firstMessageMode: parsed.firstMessageMode ?? existing.firstMessageMode,
        systemPrompt: parsed.systemPrompt,
        voiceId: voice.id,
        vapiAssistantId: remoteAssistantId,
      },
      include: { voice: true },
    });

    return {
      payload: {
        agent: serializeAgent(updated),
      },
      resourceId: updated.id,
    };
  });
}
