import type { GatewayAction, TenantContext } from "@/lib/ev/types";
import { prisma } from "@/lib/db";

export async function writeAuditLog(input: {
  context: TenantContext;
  action: GatewayAction;
  method: string;
  path: string;
  statusCode: number;
  resourceId?: string;
  ipAddress?: string;
  userAgent?: string;
}): Promise<void> {
  const { context, action, method, path, statusCode, resourceId, ipAddress, userAgent } = input;
  await prisma.gatewayAuditLog.create({
    data: {
      orgId: context.org.id,
      userId: context.user.id,
      requestType: action,
      method,
      path,
      statusCode,
      success: statusCode >= 200 && statusCode < 400,
      resourceId,
      ipAddress,
      userAgent,
    },
  });
}
