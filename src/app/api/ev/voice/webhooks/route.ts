import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { callIdFromUpstream, upsertCallLog } from "@/lib/ev/calls";

export const dynamic = "force-dynamic";

type WebhookPayload = {
  type?: string;
  message?: {
    type?: string;
  };
  call?: Record<string, unknown>;
  data?: Record<string, unknown>;
};

function extractCall(payload: WebhookPayload): Record<string, unknown> | null {
  if (payload.call && typeof payload.call === "object") {
    return payload.call;
  }

  if (payload.data && typeof payload.data["call"] === "object") {
    return payload.data["call"] as Record<string, unknown>;
  }

  if (payload.data && payload.data.id) {
    return payload.data;
  }

  return null;
}

export async function POST(req: NextRequest) {
  try {
    const secretHeader = req.headers.get("x-ev-webhook-secret") ?? req.headers.get("x-vapi-secret") ?? undefined;

    if (env.EV_WEBHOOK_SECRET && secretHeader !== env.EV_WEBHOOK_SECRET) {
      return NextResponse.json({ error: "Invalid webhook secret." }, { status: 401 });
    }

    const payload = (await req.json()) as WebhookPayload;
    const call = extractCall(payload);

    if (!call) {
      return NextResponse.json({ received: true, ignored: true });
    }

    const metadata = (call.metadata ?? {}) as Record<string, unknown>;
    const orgIdFromMetadata = typeof metadata.orgId === "string" ? metadata.orgId : null;
    const agentId = typeof metadata.agentId === "string" ? metadata.agentId : null;

    let orgId = orgIdFromMetadata;
    if (!orgId) {
      const fallbackOrg = await prisma.org.findUnique({ where: { slug: env.EV_DEFAULT_ORG_SLUG } });
      orgId = fallbackOrg?.id ?? null;
    }

    if (!orgId) {
      return NextResponse.json({ received: true, ignored: true, reason: "No org context" });
    }

    await upsertCallLog({
      orgId,
      agentId,
      upstreamCall: call,
      source: "sync",
    });

    await prisma.gatewayAuditLog.create({
      data: {
        orgId,
        requestType: "webhooks.receive",
        method: req.method,
        path: req.nextUrl.pathname,
        statusCode: 200,
        success: true,
        resourceId: callIdFromUpstream(call) || null,
        ipAddress: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
        userAgent: req.headers.get("user-agent") ?? null,
      },
    });

    return NextResponse.json({ received: true, callId: callIdFromUpstream(call) });
  } catch (error) {
    return NextResponse.json(
      {
        error: (error as Error).message,
      },
      { status: 500 },
    );
  }
}
