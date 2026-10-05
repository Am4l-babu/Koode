import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.E2E_PORT || 3100);
const DATABASE_URL = process.env.E2E_DATABASE_URL || "postgresql://donation:donation@localhost:5432/donation_e2e?schema=public";

/** E2E-only secrets for the throwaway e2e database. */
export const E2E_ENV = {
  DATABASE_URL,
  DATA_ENCRYPTION_KEY: "ZTJlLW9ubHkta2V5LWRvLW5vdC11c2UtaW4tcHJvZCE=",
  APP_SECRET: "e2e-only-app-secret-0123456789abcdefghijklmnop",
  APP_URL: `http://localhost:${PORT}`,
  COOKIE_SECURE: "false",
  ADMIN_EMAIL: "admin@koode.local",
  ADMIN_PASSWORD: "E2E!AdminPass2026",
  DEMO_PASSWORD: "E2E!DemoPass2026",
  STORAGE_DIR: "./storage/e2e-private",
  DISABLE_RATE_LIMIT: "true",
};

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH } : undefined,
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] }, testIgnore: /mobile\.spec\.ts/ },
    { name: "mobile", use: { ...devices["Pixel 7"] }, testMatch: /mobile\.spec\.ts/ },
  ],
  webServer: {
    // Playwright launches the web server before any global setup, so the
    // throwaway e2e database is migrated and seeded as part of this command.
    command: `npx prisma migrate deploy && node --conditions=react-server --import tsx prisma/seed.ts && npx next build && npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    timeout: 400_000,
    reuseExistingServer: !process.env.CI,
    env: E2E_ENV,
  },
});
