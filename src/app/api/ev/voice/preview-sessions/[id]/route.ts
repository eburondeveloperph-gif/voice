import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";

import { prisma } from "@/lib/db";
import { runGatewayHandler, runGatewayOptions } from "@/lib/ev/handler";

export const dynamic = "force-dynamic";

const patchSchema = z.object({
  status: z.string().min(2).max(40),
  transcript: z.array(z.record(z.string(), z.unknown())).optional(),
  ended: z.boolean().optional(),
});

export async function OPTIONS(req: NextRequest) {
  return runGatewayOptions(req);
}

export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  return runGatewayHandler(req, "preview.update", async ({ tenant }) => {
    const { id } = await context.params;
    const parsed = patchSchema.parse(await req.json());

    const session = await prisma.previewSession.findFirst({
      where: {
        id,
        orgId: tenant.org.id,
      },
    });

    if (!session) {
      throw Object.assign(new Error("Preview session not found."), { status: 404 });
    }

    const updated = await prisma.previewSession.update({
      where: { id: session.id },
      data: {
        status: parsed.status,
        transcript: parsed.transcript as Prisma.InputJsonValue | undefined,
        endedAt: parsed.ended ? new Date() : session.endedAt,
      },
    });

    return {
      payload: {
        previewSession: updated,
      },
      resourceId: updated.id,
    };
  });
}
