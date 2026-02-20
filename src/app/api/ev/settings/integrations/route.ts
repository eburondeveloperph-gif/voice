import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";

import { prisma } from "@/lib/db";
import { runGatewayHandler, runGatewayOptions } from "@/lib/ev/handler";
import {
  buildEburonCredentialPayload,
  getProviderDefinition,
  normalizeIntegrationConfig,
  parseIntegrationStatus,
  serializeIntegrationRecord,
} from "@/lib/ev/integrations";
import { upstream } from "@/lib/ev/vapi-client";

export const dynamic = "force-dynamic";

const createSchema = z.object({
  providerKey: z.string().trim().min(1),
  name: z.string().trim().min(2).max(120).optional(),
  config: z.record(z.string(), z.unknown()).optional(),
  status: z.string().optional(),
});

export async function OPTIONS(req: NextRequest) {
  return runGatewayOptions(req);
}

export async function GET(req: NextRequest) {
  return runGatewayHandler(req, "settings.integrations.list", async ({ tenant }) => {
    const integrations = await prisma.integration.findMany({
      where: { orgId: tenant.org.id },
      orderBy: { updatedAt: "desc" },
    });

    return {
      payload: {
        integrations: integrations.map((integration) => serializeIntegrationRecord(integration)),
      },
    };
  });
}

export async function POST(req: NextRequest) {
  return runGatewayHandler(req, "settings.integrations.create", async ({ tenant }) => {
    const parsed = createSchema.parse(await req.json());
    const provider = getProviderDefinition(parsed.providerKey);

    if (!provider) {
      throw Object.assign(new Error("Unknown provider key."), { status: 400 });
    }

    const config = normalizeIntegrationConfig(provider, parsed.config ?? {});
    const name = parsed.name?.trim() || provider.label;
    const status = parsed.status ? parseIntegrationStatus(parsed.status) : "active";

    let upstreamCredentialId: string | null = null;
    if ((provider as any).mode === "eburon_credential") {
      const payload = (buildEburonCredentialPayload as any)(provider, name, config);
      const remoteCredential = await upstream.createCredential(payload);
      upstreamCredentialId = extractCredentialId(remoteCredential);

      if (!upstreamCredentialId) {
        throw Object.assign(new Error("Created credential but did not receive an upstream id."), { status: 502 });
      }
    }

    const created = await prisma.integration.create({
      data: {
        orgId: tenant.org.id,
        name,
        category: provider.category,
        providerKey: provider.key,
        mode: provider.mode,
        upstreamCredentialId,
        config: config as Prisma.InputJsonValue,
        status,
      } as Prisma.IntegrationUncheckedCreateInput,
    });

    return {
      payload: {
        integration: serializeIntegrationRecord(created),
      },
      status: 201,
      resourceId: created.id,
    };
  });
}

function extractCredentialId(value: unknown): string | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }

  const record = value as Record<string, unknown>;
  const id = record.id ?? record.credentialId;
  if (typeof id !== "string") {
    return null;
  }

  const trimmed = id.trim();
  return trimmed.length > 0 ? trimmed : null;
}
