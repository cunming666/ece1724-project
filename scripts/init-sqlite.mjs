import fs from "node:fs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const migrationPath = "prisma/migrations/20260319205645_init/migration.sql";

async function main() {
  const existing = await prisma.$queryRawUnsafe(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='Event'"
  );

  if (Array.isArray(existing) && existing.length > 0) {
    console.log("SQLite schema already initialized.");
    return;
  }

  const raw = fs.readFileSync(migrationPath, "utf8");
  const statements = raw
    .split(";")
    .map((statement) => statement.trim())
    .filter(Boolean);

  for (const statement of statements) {
    await prisma.$executeRawUnsafe(statement);
  }

  console.log("SQLite schema initialized from migration.sql.");
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });