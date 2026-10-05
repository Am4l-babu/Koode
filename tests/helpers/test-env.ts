/**
 * Test-only environment. These keys exist solely for the local test database
 * and are never used outside automated tests.
 */
export const TEST_ENV = {
  DATABASE_URL: process.env.TEST_DATABASE_URL || "postgresql://donation:donation@localhost:5432/donation_test?schema=public",
  DATA_ENCRYPTION_KEY: "dGVzdC1vbmx5LWtleS1kby1ub3QtdXNlLWluLXByb2Q=",
  APP_SECRET: "test-only-app-secret-0123456789abcdefghijklmnop",
  APP_URL: "http://localhost:3000",
  EMAIL_DRIVER: "console",
  SMS_DRIVER: "console",
  STORAGE_DIR: "./storage/test-private",
  DISABLE_RATE_LIMIT: "true",
  NODE_ENV: "test",
};
