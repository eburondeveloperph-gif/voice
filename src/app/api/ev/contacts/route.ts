import { NextRequest } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/db";
import { runGatewayHandler, runGatewayOptions } from "@/lib/ev/handler";

export const dynamic = "force-dynamic";

const createContactSchema = z.object({
  fullName: z.string().min(2).max(120),
  phoneNumber: z.string().min(5).max(40),
  email: z.string().email().optional(),
  tags: z.array(z.string().max(30)).optional(),
});

export async function OPTIONS(req: NextRequest) {
  return runGatewayOptions(req);
}

export async function GET(req: NextRequest) {
  return runGatewayHandler(req, "contacts.list", async ({ tenant }) => {
    const q = req.nextUrl.searchParams.get("q")?.trim();

    const contacts = await prisma.contact.findMany({
      where: {
        orgId: tenant.org.id,
        ...(q
          ? {
              OR: [
                { fullName: { contains: q } },
                { phoneNumber: { contains: q } },
                { email: { contains: q } },
              ],
            }
          : {}),
      },
      orderBy: {
        updatedAt: "desc",
      },
      take: 500,
    });

    return {
      payload: { contacts },
    };
  });
}

export async function POST(req: NextRequest) {
  return runGatewayHandler(req, "contacts.create", async ({ tenant }) => {
    const parsed = createContactSchema.parse(await req.json());

    const contact = await prisma.contact.upsert({
      where: {
        orgId_phoneNumber: {
          orgId: tenant.org.id,
          phoneNumber: parsed.phoneNumber,
        },
      },
      update: {
        fullName: parsed.fullName,
        email: parsed.email,
        tags: parsed.tags?.join(",") ?? null,
      },
      create: {
        orgId: tenant.org.id,
        fullName: parsed.fullName,
        phoneNumber: parsed.phoneNumber,
        email: parsed.email,
        tags: parsed.tags?.join(",") ?? null,
      },
    });

    return {
      status: 201,
      resourceId: contact.id,
      payload: { contact },
    };
  });
}
