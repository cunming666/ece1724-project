import { execSync } from "node:child_process";
import { closeSync, existsSync, mkdirSync, openSync } from "node:fs";
import path from "node:path";
import "dotenv/config";

const schemaPath = path.resolve("prisma/schema.prisma");
const schemaDir = path.dirname(schemaPath);

function resolveSqliteFile(databaseUrl) {
  if (!databaseUrl?.startsWith("file:")) {
    return null;
  }

  const rawPath = databaseUrl.slice("file:".length).split("?")[0];
  if (!rawPath || rawPath === ":memory:") {
    return null;
  }

  if (/^\/[A-Za-z]:[\\/]/.test(rawPath)) {
    return rawPath.slice(1);
  }

  if (path.isAbsolute(rawPath)) {
    return rawPath;
  }

  return path.resolve(schemaDir, rawPath);
}

function ensureSqliteDatabaseFile() {
  const databaseFile = resolveSqliteFile(process.env.DATABASE_URL);
  if (!databaseFile || existsSync(databaseFile)) {
    return;
  }

  mkdirSync(path.dirname(databaseFile), { recursive: true });
  closeSync(openSync(databaseFile, "w"));
}

function main() {
  ensureSqliteDatabaseFile();
  execSync("npx prisma db push --schema prisma/schema.prisma --accept-data-loss --skip-generate", {
    stdio: "inherit",
  });
  console.log("SQLite schema synced with prisma/schema.prisma.");
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}


