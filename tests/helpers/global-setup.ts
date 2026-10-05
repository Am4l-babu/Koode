import { execSync } from "node:child_process";
import { TEST_ENV } from "./test-env";

/** Apply migrations to the dedicated test database once per run. */
export default function setup() {
  execSync("npx prisma migrate deploy", {
    stdio: "pipe",
    env: { ...process.env, DATABASE_URL: TEST_ENV.DATABASE_URL },
  });
}
