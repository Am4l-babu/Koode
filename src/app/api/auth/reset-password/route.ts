import { ok, parseJson, route } from "@/lib/api";
import { resetPasswordSchema } from "@/lib/validation/auth";
import { resetPassword } from "@/services/auth";

export const POST = route({ rateLimit: "passwordReset" }, async (req, { ip }) => {
  const input = await parseJson(req, resetPasswordSchema);
  await resetPassword(input.token, input.password, { ip });
  return ok({ message: "Password updated. Please sign in with your new password." });
});
