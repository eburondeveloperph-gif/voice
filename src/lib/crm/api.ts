import type { NextRequest } from "next/server";

import { prisma } from "@/lib/db";
import { assertProjectEmailAccess, getBearerToken, verifySupabaseIdentityFromToken } from "@/lib/crm/access";

export type AuthorizedCrmContext = {
  accessToken: string;
  project: {
    id: string;
    orgId: string;
    name: string;
    slug: string;
    customDomain: string | null;
    description: string | null;
    allowedEmails: string | null;
    logoUrl: string | null;
    isActive: boolean;
  };
  identity: {
    id: string;
    email: string;
  };
};

export async function authorizeCrmProjectRequest(
  req: NextRequest,
  clientSlug: string,
): Promise<AuthorizedCrmContext> {
  const token = getBearerToken(req);
  const identity = await verifySupabaseIdentityFromToken(token);

  const project = await prisma.crmProject.findUnique({
    where: { slug: clientSlug },
    select: {
      id: true,
      orgId: true,
      name: true,
      slug: true,
      customDomain: true,
      description: true,
      allowedEmails: true,
      logoUrl: true,
      isActive: true,
    },
  });

  if (!project || !project.isActive) {
    throw Object.assign(new Error("CRM project not found or inactive."), { status: 404 });
  }

  assertProjectEmailAccess(project, identity.email);
  return { accessToken: token, project, identity };
}
