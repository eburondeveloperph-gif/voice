import { NextRequest } from "next/server";
import { Prisma, CrmProject } from "@prisma/client";
import { z } from "zod";

import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { normalizeCustomDomain } from "@/lib/crm/projects";
import { runGatewayHandler, runGatewayOptions } from "@/lib/ev/handler";
import { backupCrmProject } from "@/lib/ev/backup";

export const dynamic = "force-dynamic";

const updateSchema = z.object({
  name: z.string().min(2).max(120).optional(),
  description: z.string().max(800).nullable().optional(),
  customDomain: z.string().max(255).nullable().optional(),
  allowedEmails: z.array(z.string().email()).max(100).optional(),
  logoUrl: z.string().url().nullable().optional(),
  embedStatus: z.string().optional(),
  isActive: z.boolean().optional(),
});

function appBaseUrl(): string {
  return env.NEXT_PUBLIC_APP_URL.replace(/\/+$/, "");
}

function serializeAllowedEmails(value: string | null): string[] {
  if (!value?.trim()) {
    return [];
  }
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function formatProject(project: CrmProject & { _count?: { leads: number; files: number } | null }) {
  return {
    id: project.id,
    name: project.name,
    slug: project.slug,
    description: project.description,
    customDomain: project.customDomain,
    allowedEmails: serializeAllowedEmails(project.allowedEmails),
    logoUrl: project.logoUrl,
    embedStatus: (project as CrmProject & { embedStatus: string }).embedStatus,
    isActive: project.isActive,
    portalUrl: `${appBaseUrl()}/portal/${project.slug}`,
    leadCount: project._count?.leads ?? 0,
    fileCount: project._count?.files ?? 0,
    createdAt: project.createdAt.toISOString(),
    updatedAt: project.updatedAt.toISOString(),
  };
}

export async function OPTIONS(req: NextRequest) {
  return runGatewayOptions(req);
}

export async function GET(req: NextRequest, context: { params: Promise<{ slug: string }> }) {
  return runGatewayHandler(req, "crm.projects.get", async ({ tenant }) => {
    const { slug } = await context.params;
    const project = await prisma.crmProject.findFirst({
      where: { orgId: tenant.org.id, slug },
      include: {
        _count: {
          select: {
            leads: true,
            files: true,
          },
        },
      },
    });

    if (!project) {
      throw Object.assign(new Error("CRM project not found."), { status: 404 });
    }

    return {
      payload: {
        project: formatProject(project),
      },
      resourceId: project.id,
    };
  });
}

export async function PATCH(req: NextRequest, context: { params: Promise<{ slug: string }> }) {
  return runGatewayHandler(req, "crm.projects.update", async ({ tenant }) => {
    const { slug } = await context.params;
    const parsed = updateSchema.parse(await req.json());

    const existing = await prisma.crmProject.findFirst({
      where: { orgId: tenant.org.id, slug },
    });
    if (!existing) {
      throw Object.assign(new Error("CRM project not found."), { status: 404 });
    }

    const customDomain =
      parsed.customDomain === undefined ? undefined : normalizeCustomDomain(parsed.customDomain ?? null);
    const allowedEmails =
      parsed.allowedEmails === undefined
        ? undefined
        : parsed.allowedEmails.map((email) => email.toLowerCase().trim()).join(",");

    try {
      const updated = await prisma.crmProject.update({
        where: { id: existing.id },
        data: {
          name: parsed.name?.trim(),
          description:
            parsed.description === undefined ? undefined : parsed.description ? parsed.description.trim() : null,
          customDomain,
          allowedEmails,
          logoUrl: parsed.logoUrl === undefined ? undefined : parsed.logoUrl ? parsed.logoUrl.trim() : null,
          isActive: parsed.isActive,
          ...({ embedStatus: parsed.embedStatus } as Record<string, unknown>),
        },
      });

      void backupCrmProject(updated).catch(() => {
        // do not fail primary request if Supabase backup is unavailable
      });

      return {
        payload: { project: formatProject(updated) },
        resourceId: updated.id,
      };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw Object.assign(new Error("Custom domain already exists."), { status: 409 });
      }
      throw error;
    }
  });
}
