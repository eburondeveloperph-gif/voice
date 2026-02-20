import { NextRequest } from "next/server";

import { prisma } from "@/lib/db";
import { runGatewayHandler, runGatewayOptions } from "@/lib/ev/handler";
import { syncVoicesFromUpstream } from "@/lib/ev/voices";

export const dynamic = "force-dynamic";

export async function OPTIONS(req: NextRequest) {
  return runGatewayOptions(req);
}

export async function GET(req: NextRequest) {
  return runGatewayHandler(req, "voices.list", async ({ tenant }) => {
    const shouldSync = req.nextUrl.searchParams.get("sync") === "true";
    if (shouldSync) {
      await syncVoicesFromUpstream("vapi");
    }

    const voices = await prisma.voiceCatalog.findMany({
      where: { isApproved: true },
      orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
    });

    return {
      payload: {
        voices: voices.map((voice) => ({
          id: voice.id,
          label: voice.label,
          locale: voice.locale,
          previewSampleUrl: voice.previewSampleUrl,
        })),
        orgId: tenant.org.id,
        syncedFromGateway: shouldSync,
      },
    };
  });
}
