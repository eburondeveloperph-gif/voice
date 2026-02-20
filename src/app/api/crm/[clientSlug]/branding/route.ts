import { NextRequest } from "next/server";

import { prisma } from "@/lib/db";
import { authorizeCrmProjectRequest } from "@/lib/crm/api";
import { crmErrorJson, crmOkJson } from "@/lib/crm/http";
import { uploadCrmFileToSupabase } from "@/lib/crm/storage";
import { backupCrmActivity, backupCrmProject } from "@/lib/ev/backup";

export const dynamic = "force-dynamic";

const MAX_LOGO_BYTES = 5 * 1024 * 1024;

export async function POST(req: NextRequest, context: { params: Promise<{ clientSlug: string }> }) {
  try {
    const { clientSlug } = await context.params;
    const { accessToken, project, identity } = await authorizeCrmProjectRequest(req, clientSlug);
    const form = await req.formData();
    const file = form.get("logo");

    if (!(file instanceof File)) {
      throw Object.assign(new Error("Missing logo file in form data."), { status: 400 });
    }

    if (!file.type.toLowerCase().startsWith("image/")) {
      throw Object.assign(new Error("Logo upload must be an image."), { status: 415 });
    }

    if (file.size > MAX_LOGO_BYTES) {
      throw Object.assign(new Error("Logo is too large. Max size is 5MB."), { status: 413 });
    }

    const bytes = await file.arrayBuffer();
    const uploaded = await uploadCrmFileToSupabase({
      projectSlug: project.slug,
      fileName: `logo-${file.name}`,
      contentType: file.type,
      bytes,
      accessToken,
    });

    if (!uploaded.publicUrl) {
      throw Object.assign(new Error("Logo upload succeeded but no public URL was returned."), { status: 502 });
    }

    const updated = await prisma.crmProject.update({
      where: { id: project.id },
      data: {
        logoUrl: uploaded.publicUrl,
      },
      select: {
        id: true,
        orgId: true,
        createdById: true,
        name: true,
        slug: true,
        customDomain: true,
        description: true,
        allowedEmails: true,
        logoUrl: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    const activity = await prisma.crmActivity.create({
      data: {
        orgId: project.orgId,
        projectId: project.id,
        type: "note",
        summary: "Updated company logo",
        createdByEmail: identity.email,
        metadata: {
          logoUrl: uploaded.publicUrl,
          storagePath: uploaded.path,
        },
      },
    });

    void backupCrmProject(updated).catch(() => {
      // ignore backup failures
    });
    void backupCrmActivity(activity).catch(() => {
      // ignore backup failures
    });

    return crmOkJson({
      project: {
        id: updated.id,
        name: updated.name,
        slug: updated.slug,
        logoUrl: updated.logoUrl,
        updatedAt: updated.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    return crmErrorJson(error);
  }
}
