import { NextRequest } from "next/server";
import type { CrmLeadStage } from "@prisma/client";
import { z } from "zod";

import { prisma } from "@/lib/db";
import { authorizeCrmProjectRequest } from "@/lib/crm/api";
import { crmErrorJson, crmOkJson } from "@/lib/crm/http";
import { backupCrmActivity, backupCrmLead } from "@/lib/ev/backup";

export const dynamic = "force-dynamic";

const createLeadSchema = z.object({
  fullName: z.string().min(2).max(160),
  email: z.string().email().optional(),
  phone: z.string().max(40).optional(),
  company: z.string().max(160).optional(),
  source: z.string().max(80).optional(),
  notes: z.string().max(5000).optional(),
});

const CRM_STAGES: ReadonlySet<CrmLeadStage> = new Set([
  "new",
  "contacted",
  "qualified",
  "proposal",
  "won",
  "lost",
]);

export async function GET(req: NextRequest, context: { params: Promise<{ clientSlug: string }> }) {
  try {
    const { clientSlug } = await context.params;
    const { project } = await authorizeCrmProjectRequest(req, clientSlug);
    const rawStage = req.nextUrl.searchParams.get("stage")?.trim().toLowerCase() ?? "";
    const stageFilter = CRM_STAGES.has(rawStage as CrmLeadStage) ? (rawStage as CrmLeadStage) : undefined;

    const leads = await prisma.crmLead.findMany({
      where: {
        projectId: project.id,
        ...(stageFilter ? { stage: stageFilter } : {}),
      },
      orderBy: { updatedAt: "desc" },
      take: 500,
    });

    return crmOkJson({
      leads: leads.map((lead) => ({
        ...lead,
        createdAt: lead.createdAt.toISOString(),
        updatedAt: lead.updatedAt.toISOString(),
      })),
    });
  } catch (error) {
    return crmErrorJson(error);
  }
}

export async function POST(req: NextRequest, context: { params: Promise<{ clientSlug: string }> }) {
  try {
    const { clientSlug } = await context.params;
    const { project, identity } = await authorizeCrmProjectRequest(req, clientSlug);
    const parsed = createLeadSchema.parse(await req.json());

    const lead = await prisma.crmLead.create({
      data: {
        orgId: project.orgId,
        projectId: project.id,
        fullName: parsed.fullName.trim(),
        email: parsed.email?.trim().toLowerCase() ?? null,
        phone: parsed.phone?.trim() ?? null,
        company: parsed.company?.trim() ?? null,
        source: parsed.source?.trim() ?? "manual",
        notes: parsed.notes?.trim() ?? null,
        ownerEmail: identity.email,
      },
    });

    const activity = await prisma.crmActivity.create({
      data: {
        orgId: project.orgId,
        projectId: project.id,
        leadId: lead.id,
        type: "note",
        summary: `Lead created by ${identity.email}`,
        createdByEmail: identity.email,
        metadata: {
          source: parsed.source ?? "manual",
        },
      },
    });

    void backupCrmLead(lead).catch(() => {
      // ignore backup failures
    });
    void backupCrmActivity(activity).catch(() => {
      // ignore backup failures
    });

    return crmOkJson(
      {
        lead: {
          ...lead,
          createdAt: lead.createdAt.toISOString(),
          updatedAt: lead.updatedAt.toISOString(),
        },
      },
      201,
    );
  } catch (error) {
    return crmErrorJson(error);
  }
}
