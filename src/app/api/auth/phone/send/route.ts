import { ok, route } from "@/lib/api";
import { sendPhoneOtp } from "@/services/auth";

export const POST = route({ auth: true, rateLimit: "otp" }, async (_req, { user }) => {
  await sendPhoneOtp(user!);
  return ok({ message: "We've sent a 6-digit code to your phone." });
});
