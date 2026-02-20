import { NextRequest } from "next/server";

import { prisma } from "@/lib/db";
import { authorizeCrmProjectRequest } from "@/lib/crm/api";
import { crmErrorJson, crmOkJson } from "@/lib/crm/http";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, context: { params: Promise<{ clientSlug: string }> }) {
  try {
    const { clientSlug } = await context.params;
    const { project } = await authorizeCrmProjectRequest(req, clientSlug);

    const [leads, activities, files] = await Promise.all([
      prisma.crmLead.findMany({
        where: { projectId: project.id },
        orderBy: { updatedAt: "desc" },
        take: 400,
      }),
      prisma.crmActivity.findMany({
        where: { projectId: project.id },
        orderBy: { createdAt: "desc" },
        take: 200,
      }),
      prisma.crmFile.findMany({
        where: { projectId: project.id },
        orderBy: { createdAt: "desc" },
        take: 200,
      }),
    ]);

    return crmOkJson({
      project: {
        id: project.id,
        name: project.name,
        slug: project.slug,
        customDomain: project.customDomain,
        description: project.description,
        logoUrl: project.logoUrl,
      },
      leads: leads.map((lead) => ({
        ...lead,
        createdAt: lead.createdAt.toISOString(),
        updatedAt: lead.updatedAt.toISOString(),
      })),
      activities: activities.map((activity) => ({
        ...activity,
        createdAt: activity.createdAt.toISOString(),
      })),
      files: files.map((file) => ({
        ...file,
        createdAt: file.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    return crmErrorJson(error);
  }
}
