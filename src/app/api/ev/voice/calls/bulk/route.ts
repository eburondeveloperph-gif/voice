import { NextRequest } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/db";
import { DEFAULT_AGENT_PHONE_ID } from "@/lib/defaultAgent";
import { runGatewayHandler, runGatewayOptions } from "@/lib/ev/handler";
import { callIdFromUpstream, upsertCallLog } from "@/lib/ev/calls";
import { upstream } from "@/lib/ev/vapi-client";

export const dynamic = "force-dynamic";

const bulkJobSchema = z.object({
  number: z.string().trim().min(5),
  name: z.string().trim().min(1).optional(),
  assistantId: z.string().trim().min(1).optional(),
});

const bulkCallSchema = z.object({
  phoneNumberId: z.string().trim().min(1).optional(),
  defaultAssistantId: z.string().trim().min(1).optional(),
  jobs: z.array(bulkJobSchema).min(1).max(500),
});

type ResolvedAssistant = {
  assistantId: string;
  localAgentId: string | null;
};

async function resolveAssistantForCall(
  orgId: string,
  requestedAssistantId: string,
  cache: Map<string, ResolvedAssistant>,
): Promise<ResolvedAssistant> {
  const cached = cache.get(requestedAssistantId);
  if (cached) {
    return cached;
  }

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

  let resolved: ResolvedAssistant;
  if (!agent) {
    resolved = {
      assistantId: requestedAssistantId,
      localAgentId: null,
    };
  } else if (!agent.vapiAssistantId) {
    throw Object.assign(new Error(`Deploy agent ${agent.id} before running bulk calls.`), { status: 409 });
  } else {
    resolved = {
      assistantId: agent.vapiAssistantId,
      localAgentId: agent.id,
    };
  }

  cache.set(requestedAssistantId, resolved);
  return resolved;
}

export async function OPTIONS(req: NextRequest) {
  return runGatewayOptions(req);
}

export async function POST(req: NextRequest) {
  return runGatewayHandler(req, "calls.bulk", async ({ tenant }) => {
    const parsed = bulkCallSchema.parse(await req.json());
    const outboundPhoneNumberId = parsed.phoneNumberId || DEFAULT_AGENT_PHONE_ID;
    const assistantResolutionCache = new Map<string, ResolvedAssistant>();

    let defaultAssistant: ResolvedAssistant | null = null;
    if (parsed.defaultAssistantId) {
      defaultAssistant = await resolveAssistantForCall(
        tenant.org.id,
        parsed.defaultAssistantId,
        assistantResolutionCache,
      );
    }

    const results: Array<{
      number: string;
      success: boolean;
      id?: string;
      status?: string;
      error?: string;
    }> = [];

    // Keep calls sequential to avoid overwhelming upstream rate limits.
    for (const job of parsed.jobs) {
      const requestedAssistantId = job.assistantId || defaultAssistant?.assistantId;
      if (!requestedAssistantId) {
        results.push({
          number: job.number,
          success: false,
          error: "Missing assistantId for job and no defaultAssistantId provided.",
        });
        continue;
      }

      try {
        const resolved = await resolveAssistantForCall(
          tenant.org.id,
          requestedAssistantId,
          assistantResolutionCache,
        );
        const callResult = await upstream.createCall({
          assistantId: resolved.assistantId,
          phoneNumberId: outboundPhoneNumberId,
          customer: {
            number: job.number,
            ...(job.name ? { name: job.name } : {}),
          },
          metadata: {
            orgId: tenant.org.id,
            source: "eburon-dashboard-bulk",
            ...(resolved.localAgentId ? { agentId: resolved.localAgentId } : {}),
          },
        });

        await upsertCallLog({
          orgId: tenant.org.id,
          agentId: resolved.localAgentId ?? undefined,
          upstreamCall: callResult,
          source: "production",
        });

        results.push({
          number: job.number,
          success: true,
          id: callIdFromUpstream(callResult) ?? "",
          status: String(callResult.status ?? "queued"),
        });
      } catch (error) {
        results.push({
          number: job.number,
          success: false,
          error: (error as Error).message,
        });
      }
    }

    return {
      payload: {
        success: true,
        processed: results.length,
        succeeded: results.filter((result) => result.success).length,
        failed: results.filter((result) => !result.success).length,
        results,
      },
    };
  });
}
