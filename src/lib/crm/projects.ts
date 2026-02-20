import { prisma } from "@/lib/db";

type ProjectRef = {
  id: string;
  orgId: string;
  name: string;
  slug: string;
  customDomain: string | null;
  description: string | null;
  logoUrl: string | null;
  allowedEmails: string | null;
  isActive: boolean;
};

const RESERVED_TOP_LEVEL_PATHS = new Set([
  "dashboard",
  "create",
  "agents",
  "voices",
  "dialer",
  "calls",
  "call-logs",
  "contacts",
  "numbers",
  "settings",
  "crm",
  "api",
  "_next",
]);

export function sanitizeProjectSlug(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export function assertProjectSlugAllowed(slug: string): void {
  if (!slug || slug.length < 3) {
    throw Object.assign(new Error("Project slug must be at least 3 characters."), { status: 400 });
  }
  if (RESERVED_TOP_LEVEL_PATHS.has(slug)) {
    throw Object.assign(new Error("This project slug is reserved by the app."), { status: 409 });
  }
}

export function normalizeCustomDomain(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }
  const cleaned = value.trim().toLowerCase();
  if (!cleaned) {
    return null;
  }
  return cleaned.replace(/^https?:\/\//, "").replace(/\/+$/, "");
}

export async function findCrmProjectBySlug(slug: string): Promise<ProjectRef | null> {
  return prisma.crmProject.findUnique({
    where: { slug },
    select: {
      id: true,
      orgId: true,
      name: true,
      slug: true,
      customDomain: true,
      description: true,
      logoUrl: true,
      allowedEmails: true,
      isActive: true,
    },
  });
}

export async function findCrmProjectByHost(host: string | null): Promise<ProjectRef | null> {
  if (!host) {
    return null;
  }
  const normalized = host.trim().toLowerCase().split(":")[0];
  if (!normalized || normalized === "localhost" || normalized.endsWith(".localhost")) {
    return null;
  }

  return prisma.crmProject.findFirst({
    where: {
      customDomain: normalized,
      isActive: true,
    },
    select: {
      id: true,
      orgId: true,
      name: true,
      slug: true,
      customDomain: true,
      description: true,
      logoUrl: true,
      allowedEmails: true,
      isActive: true,
    },
  });
}
