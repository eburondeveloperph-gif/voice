import { subMinutes } from "date-fns";

import { prisma } from "@/lib/db";
import { env } from "@/lib/env";

export type RateLimitVerdict =
  | { allowed: true }
  | { allowed: false; status: number; message: string };

export async function checkRateLimit(orgId: string, userId: string): Promise<RateLimitVerdict> {
  const now = new Date();
  const minuteAgo = subMinutes(now, 1);
  const tenMinutesAgo = subMinutes(now, 10);

  const [userPerMinute, orgPerMinute, userFailedRecent, orgFailedRecent] = await Promise.all([
    prisma.gatewayAuditLog.count({
      where: {
        orgId,
        userId,
        createdAt: { gte: minuteAgo },
      },
    }),
    prisma.gatewayAuditLog.count({
      where: {
        orgId,
        createdAt: { gte: minuteAgo },
      },
    }),
    prisma.gatewayAuditLog.count({
      where: {
        orgId,
        userId,
        success: false,
        createdAt: { gte: tenMinutesAgo },
      },
    }),
    prisma.gatewayAuditLog.count({
      where: {
        orgId,
        success: false,
        createdAt: { gte: tenMinutesAgo },
      },
    }),
  ]);

  if (userPerMinute >= env.EV_RATE_LIMIT_USER_PER_MINUTE) {
    return { allowed: false, status: 429, message: "User request limit reached." };
  }

  if (orgPerMinute >= env.EV_RATE_LIMIT_ORG_PER_MINUTE) {
    return { allowed: false, status: 429, message: "Org request limit reached." };
  }

  if (
    userFailedRecent >= env.EV_RATE_LIMIT_FAILED_PER_10_MIN ||
    orgFailedRecent >= env.EV_RATE_LIMIT_FAILED_PER_10_MIN * 3
  ) {
    return { allowed: false, status: 403, message: "Suspicious activity detected." };
  }

  return { allowed: true };
}
