import "server-only";

/**
 * Server-side environment access. Secrets are read lazily so that `next build`
 * can run without them, but any code path that needs a secret fails loudly
 * instead of silently falling back to an insecure default.
 */
function required(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === "") {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const env = {
  get databaseUrl() {
    return required("DATABASE_URL");
  },
  get dataEncryptionKey(): Buffer {
    const key = Buffer.from(required("DATA_ENCRYPTION_KEY"), "base64");
    if (key.length !== 32) {
      throw new Error("DATA_ENCRYPTION_KEY must be 32 bytes, base64 encoded (openssl rand -base64 32)");
    }
    return key;
  },
  get appSecret(): string {
    const secret = required("APP_SECRET");
    if (secret.length < 32) throw new Error("APP_SECRET must be at least 32 characters");
    return secret;
  },
  get appUrl(): string {
    return process.env.APP_URL || "http://localhost:3000";
  },
  get cookieSecure(): boolean {
    if (process.env.COOKIE_SECURE === "true") return true;
    if (process.env.COOKIE_SECURE === "false") return false;
    return process.env.NODE_ENV === "production";
  },
  get isProduction(): boolean {
    return process.env.NODE_ENV === "production";
  },
  get turnstileSecret(): string | undefined {
    return process.env.TURNSTILE_SECRET_KEY || undefined;
  },
  get emailDriver(): string {
    return process.env.EMAIL_DRIVER || "console";
  },
  get smsDriver(): string {
    return process.env.SMS_DRIVER || "console";
  },
  get whatsappDriver(): string {
    return process.env.WHATSAPP_DRIVER || "disabled";
  },
  get storageDir(): string {
    return process.env.STORAGE_DIR || "./storage/private";
  },
};
