import { PrismaClient } from "@prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { env } from "@/lib/env";

declare global {
  var __prisma: PrismaClient | undefined;
}

const adapter = new PrismaBetterSqlite3({ url: env.DATABASE_URL });

export const prisma =
  global.__prisma ??
  new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  global.__prisma = prisma;
}
