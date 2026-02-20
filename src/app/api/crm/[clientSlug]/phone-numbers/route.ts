import { NextRequest } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/db";
import { authorizeCrmProjectRequest } from "@/lib/crm/api";
import { crmProjectAgentMarker } from "@/lib/crm/agent-scope";
import { crmErrorJson, crmOkJson } from "@/lib/crm/http";
import { upstream } from "@/lib/ev/vapi-client";

export const dynamic = "force-dynamic";

const purchaseSchema = z.object({
  country: z.string().default("US"),
  areaCode: z.string().optional(),
  assignAgentId: z.string().optional(),
  upstreamPayload: z.record(z.string(), z.unknown()).optional(),
});

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

export async function GET(req: NextRequest, context: { params: Promise<{ clientSlug: string }> }) {
  try {
    const { clientSlug } = await context.params;
    const { project } = await authorizeCrmProjectRequest(req, clientSlug);
    const marker = crmProjectAgentMarker(project.id);

    const projectAgents = await prisma.agent.findMany({
      where: {
        orgId: project.orgId,
        systemPrompt: { contains: marker },
      },
      select: { id: true, name: true },
      orderBy: { updatedAt: "desc" },
    });
    const projectAgentIds = projectAgents.map((agent) => agent.id);

    if (!projectAgentIds.length) {
      return crmOkJson({
        numbers: [],
        agents: [],
      });
    }

    const numbers = await prisma.phoneNumber.findMany({
      where: {
        orgId: project.orgId,
        assignedAgentId: {
          in: projectAgentIds,
        },
      },
      include: {
        assignedAgent: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return crmOkJson({
      numbers: numbers.map(mapNumber),
      agents: projectAgents,
    });
  } catch (error) {
    return crmErrorJson(error);
  }
}

export async function POST(req: NextRequest, context: { params: Promise<{ clientSlug: string }> }) {
  try {
    const { clientSlug } = await context.params;
    const { project } = await authorizeCrmProjectRequest(req, clientSlug);
    const parsed = purchaseSchema.parse(await req.json());
    const marker = crmProjectAgentMarker(project.id);

    const projectAgents = await prisma.agent.findMany({
      where: {
        orgId: project.orgId,
        systemPrompt: { contains: marker },
      },
      select: {
        id: true,
      },
      orderBy: { updatedAt: "desc" },
    });

    if (!projectAgents.length) {
      throw Object.assign(new Error("Create a CRM agent first, then purchase a number."), { status: 409 });
    }

    const projectAgentIds = new Set(projectAgents.map((agent) => agent.id));
    const resolvedAgentId = parsed.assignAgentId?.trim() || projectAgents[0].id;
    if (!projectAgentIds.has(resolvedAgentId)) {
      throw Object.assign(new Error("Selected agent does not belong to this CRM project."), { status: 403 });
    }

    let remoteNumberId: string | null = null;
    let displayNumber = `Pending (${parsed.country})`;

    if (parsed.upstreamPayload) {
      const remote = await upstream.createPhoneNumber(parsed.upstreamPayload);
      remoteNumberId = String(remote.id ?? remote.phoneNumberId ?? "").trim() || null;
      displayNumber = String(remote.number ?? remote.phoneNumber ?? displayNumber);
    } else if (parsed.areaCode?.trim()) {
      displayNumber = `Pending (${parsed.country}/${parsed.areaCode.trim()})`;
    }

    const created = await prisma.phoneNumber.create({
      data: {
        orgId: project.orgId,
        displayNumber,
        status: remoteNumberId ? "active" : "pending",
        vapiPhoneNumberId: remoteNumberId,
        assignedAgentId: resolvedAgentId,
        monthlyPriceCents: 1500,
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

    await prisma.billingLedger.create({
      data: {
        orgId: project.orgId,
        entryType: "number_purchase",
        amountCents: -1500,
        description: `CRM number charge for ${created.displayNumber}`,
        referenceId: created.id,
        metadata: {
          projectId: project.id,
          projectSlug: project.slug,
          phoneNumberId: created.id,
        },
      },
    });

    return crmOkJson(
      {
        number: mapNumber(created),
      },
      201,
    );
  } catch (error) {
    return crmErrorJson(error);
  }
}

