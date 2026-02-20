import { NextRequest } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/db";
import { DEFAULT_AGENT_PHONE, DEFAULT_AGENT_PHONE_ID } from "@/lib/defaultAgent";
import { runGatewayHandler, runGatewayOptions } from "@/lib/ev/handler";
import { upstream } from "@/lib/ev/vapi-client";

export const dynamic = "force-dynamic";

const purchaseSchema = z.object({
  country: z.string().default("US"),
  areaCode: z.string().optional(),
  assignAgentId: z.string().optional(),
  upstreamPayload: z.record(z.string(), z.unknown()).optional(),
});

export async function OPTIONS(req: NextRequest) {
  return runGatewayOptions(req);
}

export async function GET(req: NextRequest) {
  return runGatewayHandler(req, "phone-numbers.list", async ({ tenant }) => {
    await prisma.phoneNumber.upsert({
      where: {
        vapiPhoneNumberId: DEFAULT_AGENT_PHONE_ID,
      },
      update: {
        displayNumber: DEFAULT_AGENT_PHONE,
        status: "active",
      },
      create: {
        orgId: tenant.org.id,
        displayNumber: DEFAULT_AGENT_PHONE,
        status: "active",
        vapiPhoneNumberId: DEFAULT_AGENT_PHONE_ID,
        monthlyPriceCents: 1500,
      },
    });

    const sync = req.nextUrl.searchParams.get("sync") === "true";

    if (sync) {
      const upstreamNumbers = await upstream.listPhoneNumbers();
      for (const num of upstreamNumbers) {
        const id = String(num.id ?? num.phoneNumberId ?? "").trim();
        const displayNumber = String(num.number ?? num.phoneNumber ?? "").trim();

        if (!id && !displayNumber) {
          continue;
        }

        if (id) {
          await prisma.phoneNumber.upsert({
            where: {
              vapiPhoneNumberId: id,
            },
            update: {
              displayNumber: displayNumber || "Unknown",
              status: "active",
            },
            create: {
              orgId: tenant.org.id,
              displayNumber: displayNumber || "Unknown",
              status: "active",
              vapiPhoneNumberId: id,
              monthlyPriceCents: 1500,
            },
          });
        } else {
          await prisma.phoneNumber.upsert({
            where: {
              orgId_displayNumber: {
                orgId: tenant.org.id,
                displayNumber: displayNumber || "Unknown",
              },
            },
            update: {
              status: "active",
            },
            create: {
              orgId: tenant.org.id,
              displayNumber: displayNumber || "Unknown",
              status: "active",
              monthlyPriceCents: 1500,
            },
          });
        }
      }
    }

    const numbers = await prisma.phoneNumber.findMany({
      where: { orgId: tenant.org.id },
      include: {
        assignedAgent: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return {
      payload: {
        numbers: numbers.map((num) => ({
          id: num.vapiPhoneNumberId ?? num.id,
          localId: num.id,
          displayNumber: num.displayNumber,
          status: num.status,
          monthlyPriceCents: num.monthlyPriceCents,
          assignedAgent: num.assignedAgent,
        })),
      },
    };
  });
}

export async function POST(req: NextRequest) {
  return runGatewayHandler(req, "phone-numbers.create", async ({ tenant }) => {
    const parsed = purchaseSchema.parse(await req.json());

    let remoteNumberId: string | null = null;
    let displayNumber = `Pending (${parsed.country})`;

    if (parsed.upstreamPayload) {
      const remote = await upstream.createPhoneNumber(parsed.upstreamPayload);
      remoteNumberId = String(remote.id ?? remote.phoneNumberId ?? "").trim() || null;
      displayNumber = String(remote.number ?? remote.phoneNumber ?? displayNumber);
    }

    const created = await prisma.phoneNumber.create({
      data: {
        orgId: tenant.org.id,
        displayNumber,
        status: remoteNumberId ? "active" : "pending",
        vapiPhoneNumberId: remoteNumberId,
        assignedAgentId: parsed.assignAgentId,
        monthlyPriceCents: 1500,
      },
      include: {
        assignedAgent: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    await prisma.billingLedger.create({
      data: {
        orgId: tenant.org.id,
        entryType: "number_purchase",
        amountCents: -1500,
        description: `Monthly number charge for ${created.displayNumber}`,
        referenceId: created.id,
      },
    });

    return {
      status: 201,
      payload: {
        number: {
          id: created.vapiPhoneNumberId ?? created.id,
          localId: created.id,
          displayNumber: created.displayNumber,
          status: created.status,
          monthlyPriceCents: created.monthlyPriceCents,
          assignedAgent: created.assignedAgent,
        },
      },
      resourceId: created.id,
    };
  });
}
