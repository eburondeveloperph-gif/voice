import { prisma } from "@/lib/db";

export async function getActiveAssistantCredentialIds(orgId: string): Promise<string[]> {
  const integrations = await prisma.integration.findMany({
    where: {
      orgId,
      mode: "eburon_credential" as any,
      status: "active",
      upstreamCredentialId: { not: null },
    },
    select: {
      upstreamCredentialId: true,
    },
    orderBy: {
      createdAt: "asc",
    },
  });

  const unique = new Set<string>();

  for (const item of integrations) {
    const credentialId = item.upstreamCredentialId?.trim();
    if (credentialId) {
      unique.add(credentialId);
    }
  }

  return Array.from(unique);
}

