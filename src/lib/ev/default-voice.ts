import { prisma } from "@/lib/db";

const PREFERRED_DEFAULT_VOICE_ID = "orbit-elliot";
const PREFERRED_DEFAULT_VOICE_PROVIDER = "vapi";
const PREFERRED_DEFAULT_UPSTREAM_VOICE_ID = "elliot";

export async function resolveDefaultApprovedVoice(requestedVoiceId?: string | null) {
  const normalizedRequestedVoiceId = requestedVoiceId?.trim();

  if (normalizedRequestedVoiceId) {
    const requestedVoice = await prisma.voiceCatalog.findFirst({
      where: {
        id: normalizedRequestedVoiceId,
        isApproved: true,
      },
    });
    if (requestedVoice) {
      return requestedVoice;
    }
  }

  const preferredDefaultVoice = await prisma.voiceCatalog.findFirst({
    where: {
      isApproved: true,
      OR: [
        { id: PREFERRED_DEFAULT_VOICE_ID },
        {
          upstreamProvider: PREFERRED_DEFAULT_VOICE_PROVIDER,
          upstreamVoiceId: PREFERRED_DEFAULT_UPSTREAM_VOICE_ID,
        },
      ],
    },
    orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
  });
  if (preferredDefaultVoice) {
    return preferredDefaultVoice;
  }

  const firstApprovedVapiVoice = await prisma.voiceCatalog.findFirst({
    where: {
      isApproved: true,
      upstreamProvider: "vapi",
    },
    orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
  });
  if (firstApprovedVapiVoice) {
    return firstApprovedVapiVoice;
  }

  return prisma.voiceCatalog.findFirst({
    where: { isApproved: true },
    orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
  });
}
