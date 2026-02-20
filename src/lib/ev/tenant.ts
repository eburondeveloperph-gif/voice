import { type NextRequest } from "next/server";

import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import type { TenantContext } from "@/lib/ev/types";

export async function resolveTenant(req: NextRequest): Promise<TenantContext> {
  const headerOrgId = req.headers.get("x-org-id")?.trim();
  const headerUserId = req.headers.get("x-user-id")?.trim();

  let org = headerOrgId
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

  let user = headerUserId
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

  if (user.orgId !== org.id) {
    throw Object.assign(new Error("User does not belong to this org."), { status: 403 });
  }

  return { org, user };
}
