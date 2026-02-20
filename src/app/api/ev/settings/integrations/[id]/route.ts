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

const updateSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  status: z.string().optional(),
  config: z.record(z.string(), z.unknown()).optional(),
});

export async function OPTIONS(req: NextRequest) {
  return runGatewayOptions(req);
}

export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  return runGatewayHandler(req, "settings.integrations.update", async ({ tenant }) => {
    const { id } = await context.params;
    const parsed = updateSchema.parse(await req.json());

    const existing = await prisma.integration.findFirst({
      where: { id, orgId: tenant.org.id },
    });

    if (!existing) {
      throw Object.assign(new Error("Integration not found."), { status: 404 });
    }

    const provider = getProviderDefinition(existing.providerKey);
    if (!provider) {
      throw Object.assign(new Error("Integration provider is no longer supported."), { status: 400 });
    }

    const nextName = parsed.name?.trim() || existing.name;
    const nextStatus = parsed.status ? parseIntegrationStatus(parsed.status) : existing.status;
    const shouldSyncUpstream =
      (existing.mode === "eburon_credential" as any) && // eslint-disable-line @typescript-eslint/no-explicit-any
      Boolean(existing.upstreamCredentialId) &&
      Boolean(parsed.name || parsed.config);
    const shouldUpdateConfig = Boolean(parsed.config);

    let normalizedConfig: Record<string, unknown> | null = null;

    if (shouldSyncUpstream || shouldUpdateConfig) {
      const existingConfig = asRecord(existing.config);
      const mergedConfigInput = parsed.config
        ? {
            ...existingConfig,
            ...parsed.config,
          }
        : existingConfig;
      normalizedConfig = normalizeIntegrationConfig(provider, mergedConfigInput);
    }

    if (shouldSyncUpstream && existing.upstreamCredentialId) {
      const payload = buildEburonCredentialPayload(provider, nextName, normalizedConfig ?? {});
      await upstream.updateCredential(existing.upstreamCredentialId, payload);
    }

    const data: Prisma.IntegrationUpdateInput = {
      name: nextName,
      status: nextStatus,
    };

    if (shouldUpdateConfig && normalizedConfig) {
      data.config = normalizedConfig as Prisma.InputJsonValue;
    }

    const updated = await prisma.integration.update({
      where: { id: existing.id },
      data,
    });

    return {
      payload: {
        integration: serializeIntegrationRecord(updated),
      },
      resourceId: updated.id,
    };
  });
}

export async function DELETE(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  return runGatewayHandler(req, "settings.integrations.delete", async ({ tenant }) => {
    const { id } = await context.params;

    const existing = await prisma.integration.findFirst({
      where: { id, orgId: tenant.org.id },
    });

    if (!existing) {
      throw Object.assign(new Error("Integration not found."), { status: 404 });
    }

    const provider = getProviderDefinition(existing.providerKey);
    if (provider?.mode === "eburon_credential" as any && existing.upstreamCredentialId) { // eslint-disable-line @typescript-eslint/no-explicit-any
      await upstream.deleteCredential(existing.upstreamCredentialId);
    }

    await prisma.integration.delete({ where: { id: existing.id } });

    return {
      payload: {
        ok: true,
      },
      resourceId: existing.id,
    };
  });
}

function asRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return {};
  }
  return value as Record<string, unknown>;
}
