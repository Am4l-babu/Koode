import { TEST_ENV } from "./test-env";

for (const [k, v] of Object.entries(TEST_ENV)) {
  if (k === "DATABASE_URL" || !process.env[k] || k === "DISABLE_RATE_LIMIT") (process.env as Record<string, string>)[k] = v;
}
