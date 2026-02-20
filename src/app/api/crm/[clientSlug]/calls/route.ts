import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db";
import { authorizeCrmProjectRequest } from "@/lib/crm/api";
import { crmProjectAgentMarker } from "@/lib/crm/agent-scope";
import { crmErrorJson, crmOkJson } from "@/lib/crm/http";
import { upsertCallLog } from "@/lib/ev/calls";
import { upstream } from "@/lib/ev/vapi-client";

export const dynamic = "force-dynamic";

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function callAgentIdFromMetadata(call: Record<string, unknown>): string | null {
  const metadata = asRecord(call.metadata);
  if (!metadata) {
    return null;
  }
  return typeof metadata.agentId === "string" ? metadata.agentId : null;
}

function serializeCall(call: {
  id: string;
  vapiCallId: string;
  status: string;
  fromNumber: string | null;
  toNumber: string | null;
  durationSeconds: number | null;
  costUsd: number | null;
  startedAt: Date | null;
  recordingUrl: string | null;
  agent: { id: string; name: string } | null;
}) {
  return {
    id: call.id,
    vapiCallId: call.vapiCallId,
    status: call.status,
    fromNumber: call.fromNumber,
    toNumber: call.toNumber,
    durationSeconds: call.durationSeconds,
    costUsd: call.costUsd,
    startedAt: call.startedAt?.toISOString() ?? null,
    recordingUrl: call.recordingUrl,
    agent: call.agent,
  };
}

export async function GET(req: NextRequest, context: { params: Promise<{ clientSlug: string }> }) {
  try {
    const { clientSlug } = await context.params;
    const { project } = await authorizeCrmProjectRequest(req, clientSlug);
    const marker = crmProjectAgentMarker(project.id);
    const sync = req.nextUrl.searchParams.get("sync") === "true";
    const query = req.nextUrl.searchParams.get("q")?.trim();
    const statusFilter = req.nextUrl.searchParams.get("status")?.trim();

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
            displayNumber: true,
            vapiPhoneNumberId: true,
          },
        })
      : [];
    const projectPhoneKeys = Array.from(
      new Set(
        projectNumbers
          .flatMap((num) => [num.displayNumber, num.vapiPhoneNumberId])
          .filter((value): value is string => typeof value === "string" && value.trim().length > 0),
      ),
    );

    if (sync) {
      const upstreamCalls = await upstream.listCalls();
      await Promise.all(
        upstreamCalls.map((upstreamCall) =>
          upsertCallLog({
            orgId: project.orgId,
            agentId: callAgentIdFromMetadata(upstreamCall),
            upstreamCall,
            source: "sync",
          }),
        ),
      );
    }

    if (!projectAgentIds.length && !projectPhoneKeys.length) {
      return crmOkJson({ calls: [] });
    }

    const visibilityScope: Prisma.CallLogWhereInput = {
      OR: [
        ...(projectAgentIds.length
          ? [
              {
                agentId: {
                  in: projectAgentIds,
                },
              },
            ]
          : []),
        ...(projectPhoneKeys.length
          ? [
              {
                AND: [
                  { agentId: null },
                  {
                    toNumber: {
                      in: projectPhoneKeys,
                    },
                  },
                ],
              },
            ]
          : []),
      ],
    };

    const whereClauses: Prisma.CallLogWhereInput[] = [visibilityScope];
    if (statusFilter) {
      whereClauses.push({ status: statusFilter });
    }
    if (query) {
      whereClauses.push({
        OR: [
          { fromNumber: { contains: query } },
          { toNumber: { contains: query } },
          { vapiCallId: { contains: query } },
        ],
      });
    }

    const calls = await prisma.callLog.findMany({
      where: {
        orgId: project.orgId,
        AND: whereClauses,
      },
      include: {
        agent: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { startedAt: "desc" },
      take: 250,
    });

    return crmOkJson({
      calls: calls.map(serializeCall),
    });
  } catch (error) {
    return crmErrorJson(error);
  }
}
