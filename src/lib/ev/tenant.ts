import { type NextRequest } from "next/server";

import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import type { TenantContext } from "@/lib/ev/types";

export async function resolveTenant(req: NextRequest): Promise<TenantContext> {
  const headerOrgId = req.headers.get("x-org-id")?.trim();
  const headerUserId = req.headers.get("x-user-id")?.trim();

  let org = null;
  let user = null;
  
  try {
    org = headerOrgId
      ? await prisma.org.findUnique({ where: { id: headerOrgId } })
      : await prisma.org.findUnique({ where: { slug: env.EV_DEFAULT_ORG_SLUG } });

    if (!org) {
      org = await prisma.org.create({
        data: {
          id: headerOrgId || undefined,
          slug: env.EV_DEFAULT_ORG_SLUG,
          name: env.EV_DEFAULT_ORG_NAME,
        },
      });
    }

    user = headerUserId
      ? await prisma.user.findUnique({ where: { id: headerUserId } })
      : await prisma.user.findFirst({ where: { orgId: org.id, email: env.EV_DEFAULT_USER_EMAIL } });

    if (!user) {
      user = await prisma.user.create({
        data: {
          id: headerUserId || undefined,
          orgId: org.id,
          email: env.EV_DEFAULT_USER_EMAIL,
          displayName: "Workspace Owner",
        },
      });
    }
  } catch (error) {
    console.error('Tenant resolution error:', error);
    // Create fallback tenant for production
    org = {
      id: env.EV_DEFAULT_ORG_SLUG,
      name: env.EV_DEFAULT_ORG_NAME,
      slug: env.EV_DEFAULT_ORG_SLUG,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    
    user = {
      id: "default-user",
      orgId: env.EV_DEFAULT_ORG_SLUG,
      email: env.EV_DEFAULT_USER_EMAIL,
      displayName: "Workspace Owner",
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  if (!org || !user) {
    throw Object.assign(new Error("Failed to resolve tenant"), { status: 500 });
  }

  if (user.orgId !== org.id) {
    throw Object.assign(new Error("User does not belong to this org."), { status: 403 });
  }

  return { org, user };
}
