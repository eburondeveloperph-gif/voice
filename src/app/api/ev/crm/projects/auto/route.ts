import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";

import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { runGatewayHandler, runGatewayOptions } from "@/lib/ev/handler";
import { backupCrmProject } from "@/lib/ev/backup";
import { assertProjectSlugAllowed, sanitizeProjectSlug } from "@/lib/crm/projects";
import { uploadCrmFileToSupabase } from "@/lib/crm/storage";

export const dynamic = "force-dynamic";

const autoProvisionSchema = z.object({
  companyName: z.string().trim().min(2).max(120),
  companySlug: z.string().trim().min(2).max(80).optional(),
  companyDescription: z.string().trim().max(800).optional(),
  ownerEmail: z.string().trim().email(),
});
const MAX_LOGO_BYTES = 5 * 1024 * 1024;

type AutoProvisionInput = z.infer<typeof autoProvisionSchema> & {
  companyLogo: File | null;
};

function appBaseUrl(): string {
  return env.NEXT_PUBLIC_APP_URL.replace(/\/+$/, "");
}

function toPayload(project: {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  logoUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: project.id,
    name: project.name,
    slug: project.slug,
    description: project.description,
    logoUrl: project.logoUrl,
    portalUrl: `${appBaseUrl()}/portal/${project.slug}`,
    createdAt: project.createdAt.toISOString(),
    updatedAt: project.updatedAt.toISOString(),
  };
}

function uniqueSlug(baseSlug: string): string {
  const suffix = Math.floor(Date.now() / 1000).toString(36).slice(-4);
  return `${baseSlug}-${suffix}`;
}

function formValueAsString(value: FormDataEntryValue | null): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function readBearerToken(req: NextRequest): string | undefined {
  const header = req.headers.get("authorization") ?? "";
  const [scheme, token] = header.split(/\s+/, 2);
  if (!/^Bearer$/i.test(scheme) || !token?.trim()) {
    return undefined;
  }
  return token.trim();
}

async function parseAutoProvisionInput(req: NextRequest): Promise<AutoProvisionInput> {
  const contentType = req.headers.get("content-type")?.toLowerCase() ?? "";
  if (!contentType.includes("multipart/form-data")) {
    const parsed = autoProvisionSchema.parse(await req.json());
    return {
      ...parsed,
      companyLogo: null,
    };
  }

  const form = await req.formData();
  const parsed = autoProvisionSchema.parse({
    companyName: formValueAsString(form.get("companyName")),
    companySlug: formValueAsString(form.get("companySlug")),
    companyDescription: formValueAsString(form.get("companyDescription")),
    ownerEmail: formValueAsString(form.get("ownerEmail")),
  });

  const logoEntry = form.get("companyLogo");
  let companyLogo: File | null = null;
  if (logoEntry instanceof File && logoEntry.size > 0) {
    if (!logoEntry.type.toLowerCase().startsWith("image/")) {
      throw Object.assign(new Error("Company logo must be an image file."), { status: 415 });
    }
    if (logoEntry.size > MAX_LOGO_BYTES) {
      throw Object.assign(new Error("Company logo is too large. Max size is 5MB."), { status: 413 });
    }
    companyLogo = logoEntry;
  }

  return {
    ...parsed,
    companyLogo,
  };
}

async function uploadCompanyLogo(input: {
  projectSlug: string;
  file: File;
  accessToken?: string;
}): Promise<string> {
  const uploaded = await uploadCrmFileToSupabase({
    projectSlug: input.projectSlug,
    fileName: `logo-${input.file.name}`,
    contentType: input.file.type || "application/octet-stream",
    bytes: await input.file.arrayBuffer(),
    accessToken: input.accessToken,
  });

  if (!uploaded.publicUrl) {
    throw Object.assign(new Error("Company logo upload succeeded but no public URL was returned."), { status: 502 });
  }

  return uploaded.publicUrl;
}

export async function OPTIONS(req: NextRequest) {
  return runGatewayOptions(req);
}

export async function POST(req: NextRequest) {
  return runGatewayHandler(req, "crm.projects.create", async ({ tenant }) => {
    const parsed = await parseAutoProvisionInput(req);
    const ownerEmail = parsed.ownerEmail.trim().toLowerCase();
    const requestAccessToken = readBearerToken(req);

    const existing = await prisma.crmProject.findFirst({
      where: {
        orgId: tenant.org.id,
        OR: [
          { allowedEmails: ownerEmail },
          { allowedEmails: { startsWith: `${ownerEmail},` } },
          { allowedEmails: { endsWith: `,${ownerEmail}` } },
          { allowedEmails: { contains: `,${ownerEmail},` } },
        ],
      },
      orderBy: { updatedAt: "desc" },
    });

    if (existing) {
      let resolvedProject = existing;
      if (parsed.companyLogo) {
        const logoUrl = await uploadCompanyLogo({
          projectSlug: existing.slug,
          file: parsed.companyLogo,
          accessToken: requestAccessToken,
        });
        resolvedProject = await prisma.crmProject.update({
          where: { id: existing.id },
          data: { logoUrl },
        });
        void backupCrmProject(resolvedProject).catch(() => {
          // do not fail primary request if backup is unavailable
        });
      }

      return {
        payload: {
          project: toPayload(resolvedProject),
          created: false,
          reason: "existing_for_owner",
        },
      };
    }

    const requestedSlug = sanitizeProjectSlug(parsed.companySlug ?? parsed.companyName);
    assertProjectSlugAllowed(requestedSlug);
    let slugToUse = requestedSlug;
    const createProject = (slug: string) =>
      prisma.crmProject.create({
        data: {
          orgId: tenant.org.id,
          createdById: tenant.user.id,
          name: parsed.companyName.trim(),
          slug,
          description: parsed.companyDescription?.trim() ?? null,
          allowedEmails: ownerEmail,
        },
      });

    try {
      let project = await createProject(slugToUse);

      if (parsed.companyLogo) {
        try {
          const logoUrl = await uploadCompanyLogo({
            projectSlug: project.slug,
            file: parsed.companyLogo,
            accessToken: requestAccessToken,
          });
          project = await prisma.crmProject.update({
            where: { id: project.id },
            data: { logoUrl },
          });
        } catch (error) {
          await prisma.crmProject.delete({ where: { id: project.id } }).catch(() => {
            // best effort cleanup if logo upload fails
          });
          throw error;
        }
      }

      void backupCrmProject(project).catch(() => {
        // do not fail primary request if backup is unavailable
      });

      return {
        payload: {
          project: toPayload(project),
          created: true,
        },
        status: 201,
        resourceId: project.id,
      };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        slugToUse = uniqueSlug(requestedSlug);
        let retry = await createProject(slugToUse);

        if (parsed.companyLogo) {
          try {
            const logoUrl = await uploadCompanyLogo({
              projectSlug: retry.slug,
              file: parsed.companyLogo,
              accessToken: requestAccessToken,
            });
            retry = await prisma.crmProject.update({
              where: { id: retry.id },
              data: { logoUrl },
            });
          } catch (logoError) {
            await prisma.crmProject.delete({ where: { id: retry.id } }).catch(() => {
              // best effort cleanup if logo upload fails
            });
            throw logoError;
          }
        }

        void backupCrmProject(retry).catch(() => {
          // do not fail primary request if backup is unavailable
        });

        return {
          payload: {
            project: toPayload(retry),
            created: true,
          },
          status: 201,
          resourceId: retry.id,
        };
      }
      throw error;
    }
  });
}
