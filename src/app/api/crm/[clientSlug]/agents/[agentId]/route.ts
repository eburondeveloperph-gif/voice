import { NextRequest } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/db";
import { authorizeCrmProjectRequest } from "@/lib/crm/api";
import { crmProjectAgentMarker, ensureCrmProjectAgentMarker } from "@/lib/crm/agent-scope";
import { crmErrorJson, crmOkJson } from "@/lib/crm/http";
import { getActiveAssistantCredentialIds } from "@/lib/ev/credentials";
import { resolveDefaultApprovedVoice } from "@/lib/ev/default-voice";
import { buildAssistantTemplate } from "@/lib/ev/template";
import { upstream } from "@/lib/ev/vapi-client";

export const dynamic = "force-dynamic";

const updateAgentSchema = z.object({
  name: z.string().trim().min(2).max(120),
  intro: z.string().trim().max(400).optional(),
  firstMessageMode: z.enum(["assistant-speaks-first", "assistant-waits-for-user"]).optional(),
  systemPrompt: z.string().trim().max(12000).optional(),
  voiceId: z.string().trim().min(1).optional(),
});

function summarizePrompt(prompt: string): string {
  const normalized = prompt.replace(/\s+/g, " ").trim();
  if (normalized.length <= 180) {
    return normalized;
  }
  return `${normalized.slice(0, 177)}...`;
}

function stripCrmProjectMarker(systemPrompt: string, projectId: string): string {
  const marker = crmProjectAgentMarker(projectId);
  return systemPrompt.split(marker).join("").trim();
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ clientSlug: string; agentId: string }> },
) {
  try {
    const { clientSlug, agentId } = await context.params;
    const { project } = await authorizeCrmProjectRequest(req, clientSlug);
    const parsed = updateAgentSchema.parse(await req.json());
    const marker = crmProjectAgentMarker(project.id);

    const existing = await prisma.agent.findFirst({
      where: {
        id: agentId,
        orgId: project.orgId,
        systemPrompt: {
          contains: marker,
        },
      },
      include: {
        voice: {
          select: {
            id: true,
            label: true,
            locale: true,
          },
        },
      },
    });

    if (!existing) {
      throw Object.assign(new Error("CRM agent not found for this project."), { status: 404 });
    }

    const voice = await resolveDefaultApprovedVoice(parsed.voiceId || existing.voiceId);
    if (!voice) {
      throw Object.assign(new Error("No approved voices are available. Sync voices first."), { status: 409 });
    }

    const name = parsed.name.trim();
    const intro = parsed.intro?.trim() || existing.intro;
    const firstMessageMode = parsed.firstMessageMode ?? existing.firstMessageMode;
    const systemPrompt = ensureCrmProjectAgentMarker(
      parsed.systemPrompt?.trim() || stripCrmProjectMarker(existing.systemPrompt, project.id),
      project.id,
    );

    const credentialIds = await getActiveAssistantCredentialIds(project.orgId);
    const assistantTemplate = buildAssistantTemplate(
      {
        name,
        intro,
        firstMessageMode,
        systemPrompt,
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
        name,
        intro,
        firstMessageMode,
        systemPrompt,
        voiceId: voice.id,
        vapiAssistantId: remoteAssistantId,
      },
      include: {
        voice: {
          select: {
            id: true,
            label: true,
            locale: true,
          },
        },
      },
    });

    const promptForUi = stripCrmProjectMarker(updated.systemPrompt, project.id);

    return crmOkJson({
      agent: {
        id: updated.id,
        name: updated.name,
        intro: updated.intro,
        firstMessageMode: updated.firstMessageMode,
        description: summarizePrompt(promptForUi),
        systemPrompt: promptForUi,
        status: updated.status,
        voiceId: updated.voice.id,
        voiceLabel: updated.voice.label,
        voiceLocale: updated.voice.locale,
        updatedAt: updated.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    return crmErrorJson(error);
  }
}
