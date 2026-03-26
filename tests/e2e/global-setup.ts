import { execSync } from "node:child_process";

async function globalSetup() {
  const env = {
    ...process.env,
    DATABASE_URL: process.env.E2E_DATABASE_URL ?? "file:./e2e.db",
  };

  execSync("npm run db:init", {
    stdio: "inherit",
    env,
  });
}

export default globalSetup;
