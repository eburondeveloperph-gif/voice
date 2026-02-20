import { NextRequest } from "next/server";

import { runGatewayHandler, runGatewayOptions } from "@/lib/ev/handler";
import { callIdFromUpstream, upsertCallLog } from "@/lib/ev/calls";
import { upstream } from "@/lib/ev/vapi-client";

export const dynamic = "force-dynamic";

export async function OPTIONS(req: NextRequest) {
  return runGatewayOptions(req);
}

export async function POST(req: NextRequest) {
  return runGatewayHandler(req, "calls.sync", async ({ tenant }) => {
    const upstreamCalls = await upstream.listCalls();

    await Promise.all(
      upstreamCalls.map((call) =>
        upsertCallLog({
          orgId: tenant.org.id,
          upstreamCall: call,
          source: "sync",
        }),
      ),
    );

    return {
      payload: {
        syncedCount: upstreamCalls.length,
        latestCallId: upstreamCalls.length > 0 ? callIdFromUpstream(upstreamCalls[0]) : null,
      },
    };
  });
}
