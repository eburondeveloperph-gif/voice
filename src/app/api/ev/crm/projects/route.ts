import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";

import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { runGatewayHandler, runGatewayOptions } from "@/lib/ev/handler";
import { backupCrmProject } from "@/lib/ev/backup";
import {
  assertProjectSlugAllowed,
  normalizeCustomDomain,
  sanitizeProjectSlug,
} from "@/lib/crm/projects";

export const dynamic = "force-dynamic";

const createProjectSchema = z.object({
  name: z.string().min(2).max(120),
  slug: z.string().min(2).max(80).optional(),
  description: z.string().max(800).optional(),
  customDomain: z.string().max(255).optional(),
  allowedEmails: z.array(z.string().email()).max(100).optional(),
  logoUrl: z.string().url().optional(),
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

function formatProject(project: {
  id: string;
  name: string;
  slug: string;
  customDomain: string | null;
  description: string | null;
  allowedEmails: string | null;
  logoUrl: string | null;
  embedStatus: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  _count?: { leads?: number; files?: number };
}) {
  return {
    id: project.id,
    name: project.name,
    slug: project.slug,
    description: project.description,
    customDomain: project.customDomain,
    allowedEmails: serializeAllowedEmails(project.allowedEmails),
    logoUrl: project.logoUrl,
    embedStatus: project.embedStatus,
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

export async function GET(req: NextRequest) {
  return runGatewayHandler(req, "crm.projects.list", async ({ tenant }) => {
    const projects = await prisma.crmProject.findMany({
      where: { orgId: tenant.org.id },
      orderBy: { updatedAt: "desc" },
      include: {
        _count: {
          select: {
            leads: true,
            files: true,
          },
        },
      },
    });

    return {
      payload: {
        projects: projects.map(formatProject),
      },
    };
  });
}

export async function POST(req: NextRequest) {
  return runGatewayHandler(req, "crm.projects.create", async ({ tenant }) => {
    const parsed = createProjectSchema.parse(await req.json());
    const slug = sanitizeProjectSlug(parsed.slug ?? parsed.name);
    assertProjectSlugAllowed(slug);

    const customDomain = normalizeCustomDomain(parsed.customDomain);
    const allowedEmails = parsed.allowedEmails?.map((email) => email.toLowerCase().trim()).join(",") ?? null;

    const existingProjectCount = await prisma.crmProject.count({
      where: { orgId: tenant.org.id },
    });

    if (existingProjectCount >= 1) {
      throw Object.assign(new Error("Your account is limited to one Main CRM Project."), { status: 403 });
    }

    try {
      const project = await prisma.crmProject.create({
        data: {
          orgId: tenant.org.id,
          createdById: tenant.user.id,
          name: parsed.name.trim(),
          slug,
          customDomain,
          description: parsed.description?.trim() ?? null,
          allowedEmails,
          logoUrl: parsed.logoUrl?.trim() ?? null,
        },
      });

      void backupCrmProject(project).catch(() => {
        // do not fail primary request if Supabase backup is unavailable
      });

      return {
        status: 201,
        resourceId: project.id,
        payload: {
          project: formatProject(project),
        },
      };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw Object.assign(new Error("Project slug or custom domain already exists."), { status: 409 });
      }
      throw error;
    }
  });
}
