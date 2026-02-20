import { NextRequest } from "next/server";

import { prisma } from "@/lib/db";
import { authorizeCrmProjectRequest } from "@/lib/crm/api";
import { crmErrorJson, crmOkJson } from "@/lib/crm/http";
import { uploadCrmFileToSupabase } from "@/lib/crm/storage";
import { backupCrmActivity, backupCrmFile } from "@/lib/ev/backup";

export const dynamic = "force-dynamic";

const MAX_FILE_BYTES = 25 * 1024 * 1024;

export async function POST(req: NextRequest, context: { params: Promise<{ clientSlug: string }> }) {
  try {
    const { clientSlug } = await context.params;
    const { accessToken, project, identity } = await authorizeCrmProjectRequest(req, clientSlug);
    const form = await req.formData();
    const file = form.get("file");
    const leadIdRaw = form.get("leadId");
    const leadId = typeof leadIdRaw === "string" && leadIdRaw.trim().length > 0 ? leadIdRaw.trim() : null;

    if (!(file instanceof File)) {
      throw Object.assign(new Error("Missing file in form data."), { status: 400 });
    }

    if (file.size > MAX_FILE_BYTES) {
      throw Object.assign(new Error("File is too large. Max size is 25MB."), { status: 413 });
    }

    if (leadId) {
      const lead = await prisma.crmLead.findFirst({
        where: {
          id: leadId,
          projectId: project.id,
        },
      });
      if (!lead) {
        throw Object.assign(new Error("Lead not found for file attachment."), { status: 404 });
      }
    }

    const bytes = await file.arrayBuffer();
    const uploaded = await uploadCrmFileToSupabase({
      projectSlug: project.slug,
      fileName: file.name,
      contentType: file.type || "application/octet-stream",
      bytes,
      accessToken,
    });

    const crmFile = await prisma.crmFile.create({
      data: {
        orgId: project.orgId,
        projectId: project.id,
        leadId,
        fileName: file.name,
        contentType: file.type || null,
        sizeBytes: file.size,
        storagePath: uploaded.path,
        publicUrl: uploaded.publicUrl,
        uploadedByEmail: identity.email,
      },
    });

    const activity = await prisma.crmActivity.create({
      data: {
        orgId: project.orgId,
        projectId: project.id,
        leadId,
        type: "file",
        summary: `Uploaded file ${file.name}`,
        createdByEmail: identity.email,
        metadata: {
          path: uploaded.path,
          publicUrl: uploaded.publicUrl,
          sizeBytes: file.size,
        },
      },
    });

    void backupCrmFile(crmFile).catch(() => {
      // ignore backup failures
    });
    void backupCrmActivity(activity).catch(() => {
      // ignore backup failures
    });

    return crmOkJson(
      {
        file: {
          ...crmFile,
          createdAt: crmFile.createdAt.toISOString(),
        },
      },
      201,
    );
  } catch (error) {
    return crmErrorJson(error);
  }
}
