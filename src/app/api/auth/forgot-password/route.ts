import { ok, parseJson, route } from "@/lib/api";
import { forgotPasswordSchema } from "@/lib/validation/auth";
import { assertHuman } from "@/lib/captcha";
import { requestPasswordReset } from "@/services/auth";

export const POST = route({ rateLimit: "passwordReset" }, async (req, { ip }) => {
  const input = await parseJson(req, forgotPasswordSchema);
  await assertHuman({ captchaToken: input.captchaToken, ip });
  await requestPasswordReset(input.email);
  // Identical response whether or not the account exists (no enumeration).
  return ok({ message: "If an account exists for that email, a reset link is on its way." });
});
