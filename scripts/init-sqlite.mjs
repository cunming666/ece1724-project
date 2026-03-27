import { execSync } from "node:child_process";

function main() {
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


