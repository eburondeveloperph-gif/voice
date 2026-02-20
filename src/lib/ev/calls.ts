import { Prisma, type CallSource } from "@prisma/client";

import { prisma } from "@/lib/db";
import { backupCallLog as syncCallToSupabase } from "@/lib/ev/backup";

export function parseCallTimestamp(value: unknown): Date | null {
  if (!value) {
    return null;
  }

  if (typeof value === "string" || typeof value === "number") {
    const date = new Date(value);
    if (!Number.isNaN(date.valueOf())) {
      return date;
    }
  }

  return null;
}

export function callIdFromUpstream(call: Record<string, unknown>): string {
  return String(call.id ?? call.callId ?? "").trim();
}

export async function upsertCallLog(input: {
  orgId: string;
  agentId?: string | null;
  upstreamCall: Record<string, unknown>;
  source: CallSource;
}): Promise<void> {
  const { orgId, agentId, upstreamCall, source } = input;
  const callId = callIdFromUpstream(upstreamCall);

  if (!callId) {
    return;
  }

  const startedAt = parseCallTimestamp(upstreamCall.startedAt);
  const endedAt = parseCallTimestamp(upstreamCall.endedAt);

  const record = await prisma.callLog.upsert({
    where: { vapiCallId: callId },
    update: {
      agentId: agentId ?? undefined,
      fromNumber: extractCustomerNumber(upstreamCall.customer),
      toNumber: asString(upstreamCall.phoneNumberId ?? upstreamCall["to"]),
      startedAt,
      endedAt,
      durationSeconds: asNumber(upstreamCall.durationSeconds ?? upstreamCall.duration),
      costUsd: asNumber(upstreamCall.cost),
      status: asString(upstreamCall.status) ?? "unknown",
      direction: asString(upstreamCall.type),
      transcript: coerceJson(upstreamCall.messages),
      recordingUrl: asString(upstreamCall.recordingUrl),
      metadata: coerceJson(upstreamCall),
      source,
    },
    create: {
      orgId,
      agentId: agentId ?? null,
      vapiCallId: callId,
      fromNumber: extractCustomerNumber(upstreamCall.customer),
      toNumber: asString(upstreamCall.phoneNumberId ?? upstreamCall["to"]),
      startedAt,
      endedAt,
      durationSeconds: asNumber(upstreamCall.durationSeconds ?? upstreamCall.duration),
      costUsd: asNumber(upstreamCall.cost),
      status: asString(upstreamCall.status) ?? "unknown",
      direction: asString(upstreamCall.type),
      transcript: coerceJson(upstreamCall.messages),
      recordingUrl: asString(upstreamCall.recordingUrl),
      metadata: coerceJson(upstreamCall),
      source,
    },
  });

  // Fire-and-forget Supabase backup
  void syncCallToSupabase(record).catch(() => { });
}

function extractCustomerNumber(value: unknown): string | undefined {
  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "object" && value) {
    const record = value as Record<string, unknown>;
    if (typeof record.number === "string") {
      return record.number;
    }
    if (typeof record.phoneNumber === "string") {
      return record.phoneNumber;
    }
  }

  return undefined;
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function asNumber(value: unknown): number | undefined {
  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "string") {
    const n = Number(value);
    return Number.isFinite(n) ? n : undefined;
  }

  return undefined;
}

function coerceJson(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === null) {
    return undefined;
  }

  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value;
  }

  if (Array.isArray(value) || typeof value === "object") {
    return value as Prisma.InputJsonValue;
  }

  return undefined;
}
