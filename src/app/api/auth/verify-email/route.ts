import { ok, parseJson, route } from "@/lib/api";
import { verifyEmailSchema } from "@/lib/validation/auth";
import { sendVerificationEmail, verifyEmail } from "@/services/auth";
import { AppError } from "@/lib/errors";

export const POST = route({ rateLimit: "otp" }, async (req, { user }) => {
  const body = await req.clone().json().catch(() => ({}));
  if (body?.resend) {
    if (!user) throw new AppError("UNAUTHENTICATED", "Please sign in to continue.");
    await sendVerificationEmail(user.id, user.email);
    return ok({ message: "We've sent a new confirmation link." });
  }
  const input = await parseJson(req, verifyEmailSchema);
  await verifyEmail(input.token);
  return ok({ message: "Email confirmed. Thank you!" });
});
