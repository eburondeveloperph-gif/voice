import { NextRequest } from "next/server";

import { prisma } from "@/lib/db";
import { authorizeCrmProjectRequest } from "@/lib/crm/api";
import { crmProjectAgentMarker } from "@/lib/crm/agent-scope";
import { crmErrorJson, crmOkJson } from "@/lib/crm/http";

export const dynamic = "force-dynamic";

type JsonRecord = Record<string, unknown>;

function asRecord(value: unknown): JsonRecord | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as JsonRecord;
}

function mapEntry(entry: {
  id: string;
  entryType: string;
  amountCents: number;
  description: string;
  referenceId: string | null;
  metadata: unknown;
  createdAt: Date;
}) {
  return {
    id: entry.id,
    entryType: entry.entryType,
    amountCents: entry.amountCents,
    description: entry.description,
    referenceId: entry.referenceId,
    metadata: entry.metadata ?? null,
    createdAt: entry.createdAt.toISOString(),
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
      select: {
        id: true,
      },
    });
    const projectAgentIds = projectAgents.map((agent) => agent.id);

    const projectNumbers = projectAgentIds.length
      ? await prisma.phoneNumber.findMany({
          where: {
            orgId: project.orgId,
            assignedAgentId: {
              in: projectAgentIds,
            },
          },
          select: {
            id: true,
            displayNumber: true,
            monthlyPriceCents: true,
          },
        })
      : [];

    const projectNumberIds = new Set(projectNumbers.map((num) => num.id));

    const rawEntries = await prisma.billingLedger.findMany({
      where: {
        orgId: project.orgId,
      },
      orderBy: { createdAt: "desc" },
      take: 400,
    });

    const entries = rawEntries.filter((entry) => {
      if (entry.referenceId && projectNumberIds.has(entry.referenceId)) {
        return true;
      }
      const metadata = asRecord(entry.metadata);
      return metadata?.projectId === project.id;
    });

    const balanceCents = entries.reduce((acc, entry) => acc + entry.amountCents, 0);
    const monthlyPhoneCostCents = projectNumbers.reduce((acc, num) => acc + num.monthlyPriceCents, 0);

    return crmOkJson({
      summary: {
        balanceCents,
        monthlyPhoneCostCents,
        entryCount: entries.length,
      },
      entries: entries.map(mapEntry),
      numbers: projectNumbers,
    });
  } catch (error) {
    return crmErrorJson(error);
  }
}

