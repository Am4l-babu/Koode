import "server-only";
import { env } from "./env";
import { AppError } from "./errors";

const MIN_FORM_FILL_MS = 1500;

/**
 * Bot protection: honeypot + minimum fill time always; Cloudflare Turnstile
 * verification when TURNSTILE_SECRET_KEY is configured.
 */
export async function assertHuman(input: {
  website?: string;
  formStartedAt?: number;
  captchaToken?: string;
  ip?: string;
}) {
  if (input.website) throw new AppError("BAD_REQUEST", "We couldn't verify this submission. Please try again.");
  if (input.formStartedAt && Date.now() - input.formStartedAt < MIN_FORM_FILL_MS) {
    throw new AppError("BAD_REQUEST", "That was quick! Please review the form and submit again.");
  }
  const secret = env.turnstileSecret;
  if (!secret) return;
  if (!input.captchaToken) throw new AppError("BAD_REQUEST", "Please complete the human verification check.");
  const body = new URLSearchParams({ secret, response: input.captchaToken });
  if (input.ip && input.ip !== "unknown") body.set("remoteip", input.ip);
  const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body });
  const data = (await res.json().catch(() => ({}))) as { success?: boolean };
  if (!data.success) throw new AppError("BAD_REQUEST", "Human verification failed. Please try again.");
}
