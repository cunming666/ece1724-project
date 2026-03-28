import { defineConfig } from "@playwright/test";

const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:4173";
const apiURL = process.env.E2E_API_URL ?? "http://localhost:4000";
const e2eDatabaseUrl = process.env.E2E_DATABASE_URL ?? "file:./e2e.db";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 90_000,
  expect: {
    timeout: 10_000,
  },
  retries: process.env.CI ? 1 : 0,
  globalSetup: "./tests/e2e/global-setup.ts",
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  webServer: [
    {
      command: "npm run build -w @checkin/api && npm run start -w @checkin/api",
      port: 4000,
      reuseExistingServer: false,
      timeout: 180_000,
      env: {
        ...process.env,
        DATABASE_URL: e2eDatabaseUrl,
        API_PORT: "4000",
        WEB_ORIGIN: baseURL,
        NODE_ENV: "test",
      },
    },
    {
      command: "npm run build -w @checkin/web && npm run preview -w @checkin/web -- --host localhost --port 4173",
      port: 4173,
      reuseExistingServer: false,
      timeout: 180_000,
      env: {
        ...process.env,
        VITE_API_URL: apiURL,
      },
    },
  ],
});
