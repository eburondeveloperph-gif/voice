import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { runGatewayHandler, runGatewayOptions } from "@/lib/ev/handler";
import { syncVoicesFromUpstream } from "@/lib/ev/voices";

export const dynamic = "force-dynamic";

export async function OPTIONS(req: NextRequest) {
    return runGatewayOptions(req);
}

export async function POST(req: NextRequest) {
  return runGatewayHandler(req, "voices.sync", async ({ tenant }) => {
    const synced = await syncVoicesFromUpstream("vapi");
    const voices = await prisma.voiceCatalog.findMany({
      where: { isApproved: true },
      orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
    });

    return {
      payload: {
        count: synced.length,
        orgId: tenant.org.id,
        voices: voices.map((voice) => ({
          id: voice.id,
          label: voice.label,
          locale: voice.locale,
          previewSampleUrl: voice.previewSampleUrl,
        })),
      },
    };
  });
}
