import { NextRequest } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/db";
import { authorizeCrmProjectRequest } from "@/lib/crm/api";
import { crmErrorJson, crmOkJson } from "@/lib/crm/http";
import { backupCrmProject } from "@/lib/ev/backup";

export const dynamic = "force-dynamic";

const updateProjectSchema = z.object({
  embedStatus: z.enum(["disabled", "requested"]).optional(),
  logoUrl: z.string().url().nullable().optional(),
});

function serializeProject(project: {
  id: string;
  name: string;
  slug: string;
  customDomain: string | null;
  description: string | null;
  logoUrl: string | null;
  embedStatus: string;
  updatedAt: Date;
}) {
  return {
    id: project.id,
    name: project.name,
    slug: project.slug,
    customDomain: project.customDomain,
    description: project.description,
    logoUrl: project.logoUrl,
    embedStatus: project.embedStatus,
    updatedAt: project.updatedAt.toISOString(),
  };
}

export async function GET(req: NextRequest, context: { params: Promise<{ clientSlug: string }> }) {
  try {
    const { clientSlug } = await context.params;
    const { project } = await authorizeCrmProjectRequest(req, clientSlug);

    const freshProject = await prisma.crmProject.findUnique({
      where: { id: project.id },
      select: {
        id: true,
        name: true,
        slug: true,
        customDomain: true,
        description: true,
        logoUrl: true,
        embedStatus: true,
        updatedAt: true,
      },
    });

    if (!freshProject) {
      throw Object.assign(new Error("CRM project not found."), { status: 404 });
    }

    return crmOkJson({ project: serializeProject(freshProject) });
  } catch (error) {
    return crmErrorJson(error);
  }
}

export async function PATCH(req: NextRequest, context: { params: Promise<{ clientSlug: string }> }) {
  try {
    const { clientSlug } = await context.params;
    const { project } = await authorizeCrmProjectRequest(req, clientSlug);
    const parsed = updateProjectSchema.parse(await req.json());

    const updated = await prisma.crmProject.update({
      where: { id: project.id },
      data: {
        embedStatus: parsed.embedStatus,
        logoUrl: parsed.logoUrl === undefined ? undefined : parsed.logoUrl,
      },
      select: {
        id: true,
        name: true,
        slug: true,
        customDomain: true,
        description: true,
        logoUrl: true,
        embedStatus: true,
        orgId: true,
        createdById: true,
        allowedEmails: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    void backupCrmProject(updated).catch(() => {
      // ignore backup failures
    });

    return crmOkJson({
      project: serializeProject(updated),
    });
  } catch (error) {
    return crmErrorJson(error);
  }
}

