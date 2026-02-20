import { NextRequest } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/db";
import { authorizeCrmProjectRequest } from "@/lib/crm/api";
import { crmErrorJson, crmOkJson } from "@/lib/crm/http";
import { backupCrmActivity, backupCrmLead } from "@/lib/ev/backup";

export const dynamic = "force-dynamic";

const updateLeadSchema = z.object({
  fullName: z.string().min(2).max(160).optional(),
  email: z.string().email().nullable().optional(),
  phone: z.string().max(40).nullable().optional(),
  company: z.string().max(160).nullable().optional(),
  source: z.string().max(80).nullable().optional(),
  ownerEmail: z.string().email().nullable().optional(),
  notes: z.string().max(5000).nullable().optional(),
  stage: z.enum(["new", "contacted", "qualified", "proposal", "won", "lost"]).optional(),
});

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ clientSlug: string; leadId: string }> },
) {
  try {
    const { clientSlug, leadId } = await context.params;
    const { project, identity } = await authorizeCrmProjectRequest(req, clientSlug);
    const parsed = updateLeadSchema.parse(await req.json());

    const existing = await prisma.crmLead.findFirst({
      where: {
        id: leadId,
        projectId: project.id,
      },
    });

    if (!existing) {
      throw Object.assign(new Error("Lead not found."), { status: 404 });
    }

    const updated = await prisma.crmLead.update({
      where: { id: existing.id },
      data: {
        fullName: parsed.fullName?.trim(),
        email: parsed.email === undefined ? undefined : parsed.email ? parsed.email.trim().toLowerCase() : null,
        phone: parsed.phone === undefined ? undefined : parsed.phone ? parsed.phone.trim() : null,
        company: parsed.company === undefined ? undefined : parsed.company ? parsed.company.trim() : null,
        source: parsed.source === undefined ? undefined : parsed.source ? parsed.source.trim() : null,
        ownerEmail:
          parsed.ownerEmail === undefined
            ? undefined
            : parsed.ownerEmail
              ? parsed.ownerEmail.trim().toLowerCase()
              : null,
        notes: parsed.notes === undefined ? undefined : parsed.notes ? parsed.notes.trim() : null,
        stage: parsed.stage,
      },
    });

    void backupCrmLead(updated).catch(() => {
      // ignore backup failures
    });

    if (parsed.stage && parsed.stage !== existing.stage) {
      const activity = await prisma.crmActivity.create({
        data: {
          orgId: project.orgId,
          projectId: project.id,
          leadId: existing.id,
          type: "status_change",
          summary: `Stage changed from ${existing.stage} to ${parsed.stage}`,
          createdByEmail: identity.email,
        },
      });

      void backupCrmActivity(activity).catch(() => {
        // ignore backup failures
      });
    }

    return crmOkJson({
      lead: {
        ...updated,
        createdAt: updated.createdAt.toISOString(),
        updatedAt: updated.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    return crmErrorJson(error);
  }
}
