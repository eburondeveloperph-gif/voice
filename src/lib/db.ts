import { PrismaClient } from "@prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { env } from "@/lib/env";

declare global {
  var __prisma: PrismaClient | undefined;
}

let prisma: PrismaClient;

try {
  const adapter = new PrismaBetterSqlite3({ url: env.DATABASE_URL });
  prisma = global.__prisma ?? new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
} catch (error) {
  console.error('Failed to initialize Prisma client:', error);
  // Create a mock Prisma client for production without database
  prisma = {
    $disconnect: async () => {},
    $connect: async () => {},
    $queryRaw: async () => [],
    $executeRaw: async () => 0,
    // Add mock methods for common operations
    org: {
      findUnique: async () => null,
      findFirst: async () => null,
      create: async () => null,
      count: async () => 0,
    },
    user: {
      findUnique: async () => null,
      findFirst: async () => null,
      create: async () => null,
      count: async () => 0,
    },
    agent: {
      count: async () => 0,
      findMany: async () => [],
    },
    callLog: {
      count: async () => 0,
      findMany: async () => [],
    },
    contact: {
      count: async () => 0,
      findMany: async () => [],
    },
    phoneNumber: {
      count: async () => 0,
      findMany: async () => [],
    },
    billingLedger: {
      aggregate: async () => ({ _sum: { amountCents: 0 } }),
    },
    integration: {
      findMany: async () => [],
      create: async () => null,
      update: async () => null,
      delete: async () => null,
      findUnique: async () => null,
    },
    crmProject: {
      findUnique: async () => null,
      findFirst: async () => null,
      findMany: async () => [],
      update: async () => null,
    },
    voiceCatalog: {
      findFirst: async () => null,
      findMany: async () => [],
      updateMany: async () => 0,
      upsert: async () => null,
    },
    gatewayAuditLog: {
      count: async () => 0,
      create: async () => null,
    },
  } as unknown as PrismaClient;
}

export { prisma };
