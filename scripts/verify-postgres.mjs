import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

function loadEnvFile(filename = ".env") {
  const envPath = resolve(process.cwd(), filename);
  if (!existsSync(envPath)) {
    return;
  }

  const content = readFileSync(envPath, "utf8");
  const lines = content.split(/\r?\n/);
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    const separatorIndex = line.indexOf("=");
    if (separatorIndex <= 0) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    if (!key || key in process.env) {
      continue;
    }

    let value = line.slice(separatorIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    process.env[key] = value;
  }
}

function run(step, command, args) {
  console.log(`\n[postgres-verify] ${step}`);
  const commandLine = [command, ...args].join(" ");
  const result = spawnSync(commandLine, {
    stdio: "inherit",
    shell: true,
    env: process.env,
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(`${step} failed with exit code ${result.status}`);
  }
}

function sleep(ms) {
  const start = Date.now();
  while (Date.now() - start < ms) {
    // busy wait for short retry delay
  }
}

function runWithRetry(step, command, args, retries = 3, delayMs = 1200) {
  let lastError = null;
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      run(`${step} (attempt ${attempt}/${retries})`, command, args);
      return;
    } catch (error) {
      lastError = error;
      if (attempt < retries) {
        console.warn(`[postgres-verify] ${step} failed, retrying in ${delayMs}ms...`);
        sleep(delayMs);
      }
    }
  }

  throw lastError ?? new Error(`${step} failed`);
}

function assertPostgresUrl(url) {
  const normalized = (url || "").trim().toLowerCase();
  if (!normalized.startsWith("postgresql://") && !normalized.startsWith("postgres://")) {
    throw new Error("DATABASE_URL must be a PostgreSQL connection string before running verify:postgres.");
  }
}

const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";
let failed = false;

try {
  loadEnvFile();
  console.log("[postgres-verify] Tip: close any running dev servers before verification to avoid Prisma engine file locks.");
  assertPostgresUrl(process.env.DATABASE_URL);

  runWithRetry("Generate Prisma client for PostgreSQL", npmCmd, ["run", "prisma:generate:postgres"]);
  runWithRetry("Push PostgreSQL schema", npmCmd, ["run", "db:push:postgres"]);
  runWithRetry("Run PostgreSQL smoke check", "node", ["scripts/postgres-smoke-check.mjs"], 1, 0);
  console.log("\n[postgres-verify] Verification passed.");
} catch (error) {
  failed = true;
  console.error(`\n[postgres-verify] Verification failed: ${error instanceof Error ? error.message : String(error)}`);
} finally {
  try {
    runWithRetry("Restore Prisma client to SQLite", npmCmd, ["run", "prisma:generate:sqlite"]);
  } catch (restoreError) {
    failed = true;
    console.error(`\n[postgres-verify] Failed to restore SQLite client: ${restoreError instanceof Error ? restoreError.message : String(restoreError)}`);
  }
}

if (failed) {
  process.exitCode = 1;
}
