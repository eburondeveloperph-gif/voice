import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// Ensure this route is always dynamically rendered
export const dynamic = "force-dynamic";

// Basic auth validation on the endpoint level as an extra safeguard
function isAuthenticated(req: NextRequest) {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) return false;

    const authValue = authHeader.split(" ")[1] ?? "";
    try {
        const [user, pwd] = atob(authValue).split(":");
        return user === "master@eburon.ai" && pwd === "120221";
    } catch {
        return false;
    }
}

export async function GET(req: NextRequest) {
    if (!isAuthenticated(req)) {
        return new NextResponse("Unauthorized", { status: 401 });
    }

    try {
        // Fetch all CRM projects that have requested embed access
        const requests = await prisma.crmProject.findMany({
            where: {
                embedStatus: {
                    in: ["requested", "approved"],
                },
            },
            select: {
                id: true,
                name: true,
                slug: true,
                embedStatus: true,
                customDomain: true,
                createdAt: true,
                org: {
                    select: {
                        name: true,
                    }
                }
            },
            orderBy: {
                updatedAt: "desc"
            }
        });

        return NextResponse.json({ requests });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Internal server error";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

export async function PATCH(req: NextRequest) {
    if (!isAuthenticated(req)) {
        return new NextResponse("Unauthorized", { status: 401 });
    }

    try {
        const { projectId, status } = await req.json();

        if (!projectId || !["approved", "disabled"].includes(status)) {
            return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
        }

        const updated = await prisma.crmProject.update({
            where: { id: projectId },
            data: { embedStatus: status },
            select: { id: true, embedStatus: true }
        });

        return NextResponse.json({ success: true, project: updated });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Internal server error";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
