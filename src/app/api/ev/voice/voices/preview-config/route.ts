import { NextRequest } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/db";
import { DEFAULT_AGENT_ID } from "@/lib/defaultAgent";
import { env } from "@/lib/env";
import { runGatewayHandler, runGatewayOptions } from "@/lib/ev/handler";
import { normalizeVoiceSelection } from "@/lib/ev/vapi-voice";

export const dynamic = "force-dynamic";

const querySchema = z.object({
  voiceId: z.string().trim().min(1),
});

export async function OPTIONS(req: NextRequest) {
  return runGatewayOptions(req);
}

export async function GET(req: NextRequest) {
  return runGatewayHandler(req, "voices.preview", async ({ tenant }) => {
    if (!env.NEXT_PUBLIC_EV_WEB_KEY) {
      throw Object.assign(new Error("Public web key is not configured."), { status: 500 });
    }

    const parsed = querySchema.parse({
      voiceId: req.nextUrl.searchParams.get("voiceId"),
    });

    const voice = await prisma.voiceCatalog.findFirst({
      where: {
        id: parsed.voiceId,
        isApproved: true,
      },
    });

    if (!voice) {
      throw Object.assign(new Error("Voice is not available for preview."), { status: 404 });
    }

    const assistantId = env.VAPI_DEFAULT_AGENT_ID || DEFAULT_AGENT_ID;
    const timeoutSeconds = Math.min(env.EV_PREVIEW_TIMEOUT_SECONDS, 40);
    const voiceSelection = normalizeVoiceSelection(
      voice.upstreamProvider,
      voice.upstreamVoiceId,
      voice.label,
    );

    return {
      payload: {
        orgId: tenant.org.id,
        voice: {
          id: voice.id,
          label: voice.label,
        },
        preview: {
          assistantId,
          publicKey: env.NEXT_PUBLIC_EV_WEB_KEY,
          timeoutSeconds,
          assistantOverrides: {
            voice: {
              provider: voiceSelection.provider,
              voiceId: voiceSelection.voiceId,
            },
            firstMessage: `Hi, this is ${voice.label}. This is a preview from Eburon Voice.`,
            firstMessageMode: "assistant-speaks-first",
            maxDurationSeconds: timeoutSeconds,
          },
        },
      },
      resourceId: voice.id,
    };
  });
}
