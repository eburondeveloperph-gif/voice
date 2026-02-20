import { NextRequest } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/db";
import { authorizeCrmProjectRequest } from "@/lib/crm/api";
import { ensureCrmProjectAgentMarker, crmProjectAgentMarker } from "@/lib/crm/agent-scope";
import { crmErrorJson, crmOkJson } from "@/lib/crm/http";
import { getActiveAssistantCredentialIds } from "@/lib/ev/credentials";
import { resolveDefaultApprovedVoice } from "@/lib/ev/default-voice";
import { buildAssistantTemplate } from "@/lib/ev/template";
import { upstream } from "@/lib/ev/vapi-client";

export const dynamic = "force-dynamic";

const createAgentSchema = z
  .object({
    name: z.string().trim().min(2).max(120),
    intro: z.string().trim().max(400).optional(),
    firstMessageMode: z.enum(["assistant-speaks-first", "assistant-waits-for-user"]).optional(),
    systemPrompt: z.string().trim().max(12000).optional(),
    voiceId: z.string().trim().min(1).optional(),
    phoneNumberId: z.string().trim().min(1).optional(),
    autoGeneratePhoneNumber: z.boolean().optional(),
    numberDesiredAreaCode: z
      .string()
      .trim()
      .regex(/^\d{3}$/, "Area code must be exactly 3 digits.")
      .optional(),
  })
  .superRefine((value, ctx) => {
    if (value.phoneNumberId && value.autoGeneratePhoneNumber) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Choose either an existing number or auto-generate a SIP number, not both.",
        path: ["phoneNumberId"],
      });
    }
    if (value.numberDesiredAreaCode && !value.autoGeneratePhoneNumber) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Area code is only used when auto-generating a SIP number.",
        path: ["numberDesiredAreaCode"],
      });
    }
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

function mapAgent(agent: {
  id: string;
  name: string;
  intro: string;
  firstMessageMode: string;
  systemPrompt: string;
  status: "draft" | "deployed";
  updatedAt: Date;
  voice: {
    id: string;
    label: string;
    locale: string;
  };
}, projectId: string) {
  const promptForUi = stripCrmProjectMarker(agent.systemPrompt, projectId);

  return {
    id: agent.id,
    name: agent.name,
    intro: agent.intro,
    firstMessageMode: agent.firstMessageMode,
    description: summarizePrompt(promptForUi),
    systemPrompt: promptForUi,
    status: agent.status,
    voiceId: agent.voice.id,
    voiceLabel: agent.voice.label,
    voiceLocale: agent.voice.locale,
    updatedAt: agent.updatedAt.toISOString(),
  };
}

function mapNumber(num: {
  id: string;
  displayNumber: string;
  status: string;
  monthlyPriceCents: number;
  assignedAgent: { id: string; name: string } | null;
}) {
  return {
    id: num.id,
    displayNumber: num.displayNumber,
    status: num.status,
    monthlyPriceCents: num.monthlyPriceCents,
    assignedAgent: num.assignedAgent,
  };
}

function normalizePhoneStatus(input: unknown): "pending" | "active" | "suspended" | "released" {
  if (typeof input !== "string") {
    return "active";
  }
  if (input === "active") {
    return "active";
  }
  if (input === "activating") {
    return "pending";
  }
  if (input === "blocked") {
    return "suspended";
  }
  return "active";
}

export async function GET(req: NextRequest, context: { params: Promise<{ clientSlug: string }> }) {
  try {
    const { clientSlug } = await context.params;
    const { project } = await authorizeCrmProjectRequest(req, clientSlug);
    const marker = crmProjectAgentMarker(project.id);

    const [agents, voices] = await Promise.all([
      prisma.agent.findMany({
        where: {
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
        orderBy: { updatedAt: "desc" },
      }),
      prisma.voiceCatalog.findMany({
        where: { isApproved: true },
        select: {
          id: true,
          label: true,
          locale: true,
          previewSampleUrl: true,
        },
        orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
      }),
    ]);

    return crmOkJson({
      agents: agents.map((agent) => mapAgent(agent, project.id)),
      voices,
    });
  } catch (error) {
    return crmErrorJson(error);
  }
}

export async function POST(req: NextRequest, context: { params: Promise<{ clientSlug: string }> }) {
  try {
    const { clientSlug } = await context.params;
    const { project, identity } = await authorizeCrmProjectRequest(req, clientSlug);
    const parsed = createAgentSchema.parse(await req.json());
    const marker = crmProjectAgentMarker(project.id);

    const voice = await resolveDefaultApprovedVoice(parsed.voiceId);

    if (!voice) {
      throw Object.assign(new Error("No approved voices are available. Sync voices first, then create an agent."), { status: 409 });
    }

    const projectAgents = await prisma.agent.findMany({
      where: {
        orgId: project.orgId,
        systemPrompt: { contains: marker },
      },
      select: {
        id: true,
      },
    });
    const projectAgentIds = new Set(projectAgents.map((agent) => agent.id));

    let selectedNumber: {
      id: string;
      assignedAgentId: string | null;
    } | null = null;

    if (parsed.phoneNumberId) {
      selectedNumber = await prisma.phoneNumber.findFirst({
        where: {
          id: parsed.phoneNumberId,
          orgId: project.orgId,
        },
        select: {
          id: true,
          assignedAgentId: true,
        },
      });

      if (!selectedNumber) {
        throw Object.assign(new Error("Selected phone number was not found."), { status: 404 });
      }

      if (selectedNumber.assignedAgentId && !projectAgentIds.has(selectedNumber.assignedAgentId)) {
        throw Object.assign(new Error("Selected phone number belongs to another CRM project."), { status: 403 });
      }
    }

    const owner = await prisma.user.findFirst({
      where: {
        orgId: project.orgId,
        email: identity.email,
      },
      select: { id: true },
    });

    const taggedPrompt = ensureCrmProjectAgentMarker(
      parsed.systemPrompt ??
        `You are a client support agent for ${project.name}. Be concise, helpful, and professional.`,
      project.id,
    );

    let createdAgentId: string | null = null;

    try {
      let created = await prisma.agent.create({
        data: {
          orgId: project.orgId,
          createdById: owner?.id ?? null,
          name: parsed.name.trim(),
          intro: parsed.intro?.trim() || `Hi, this is ${parsed.name.trim()}. How can I help you today?`,
          firstMessageMode: parsed.firstMessageMode ?? "assistant-speaks-first",
          systemPrompt: taggedPrompt,
          voiceId: voice.id,
          status: "draft",
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
      createdAgentId = created.id;

      const credentialIds = await getActiveAssistantCredentialIds(project.orgId);
      const remoteAssistant = await upstream.createAssistant(
        buildAssistantTemplate(
          {
            name: created.name,
            intro: created.intro,
            firstMessageMode: created.firstMessageMode,
            systemPrompt: created.systemPrompt,
          },
          voice,
          { credentialIds },
        ),
      );
      const remoteAssistantId = String(remoteAssistant.id ?? remoteAssistant.assistantId ?? "").trim();
      if (!remoteAssistantId) {
        throw Object.assign(new Error("Could not determine remote assistant id."), { status: 502 });
      }

      created = await prisma.agent.update({
        where: { id: created.id },
        data: {
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

      let assignedNumber: ReturnType<typeof mapNumber> | null = null;

      if (selectedNumber) {
        const reassigned = await prisma.phoneNumber.update({
          where: {
            id: selectedNumber.id,
          },
          data: {
            assignedAgentId: created.id,
          },
          include: {
            assignedAgent: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        });
        assignedNumber = mapNumber(reassigned);
      } else if (parsed.autoGeneratePhoneNumber) {
        const remote = await upstream.createPhoneNumber({
          provider: "vapi",
          name: `${created.name} (${project.slug})`,
          ...(parsed.numberDesiredAreaCode ? { numberDesiredAreaCode: parsed.numberDesiredAreaCode } : {}),
          ...(created.vapiAssistantId ? { assistantId: created.vapiAssistantId } : {}),
        });

        const remoteNumberId = String(remote.id ?? remote.phoneNumberId ?? "").trim() || null;
        const displayNumber = String(
          remote.number ?? remote.phoneNumber ?? remote.sipUri ?? "VAPI SIP Number",
        ).trim();

        const createdNumber = await prisma.phoneNumber.create({
          data: {
            orgId: project.orgId,
            displayNumber: displayNumber || "VAPI SIP Number",
            status: normalizePhoneStatus(remote.status),
            vapiPhoneNumberId: remoteNumberId,
            assignedAgentId: created.id,
            // Vapi provider SIP numbers are free to provision.
            monthlyPriceCents: 0,
          },
          include: {
            assignedAgent: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        });
        assignedNumber = mapNumber(createdNumber);
      }

      return crmOkJson(
        {
          agent: mapAgent(created, project.id),
          number: assignedNumber,
        },
        201,
      );
    } catch (error) {
      if (createdAgentId) {
        await prisma.agent.delete({ where: { id: createdAgentId } }).catch(() => {
          // best effort rollback if downstream phone setup failed
        });
      }
      throw error;
    }
  } catch (error) {
    return crmErrorJson(error);
  }
}
