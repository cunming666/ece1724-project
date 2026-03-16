export type PrismaClientLike = {
  $connect?: () => Promise<void>;
  $disconnect?: () => Promise<void>;
};

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClientLike };

// Runtime persistence is still backed by the in-memory store. Keep a lightweight
// placeholder here so the TypeScript build does not depend on generated Prisma
// client artifacts before the Prisma migration task is completed.
export const prisma = globalForPrisma.prisma ?? {};

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}