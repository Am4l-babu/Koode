import { ok, parseJson, route } from "@/lib/api";
import { phoneOtpVerifySchema } from "@/lib/validation/auth";
import { verifyPhoneOtp } from "@/services/auth";

export const POST = route({ auth: true, rateLimit: "otp" }, async (req, { user }) => {
  const input = await parseJson(req, phoneOtpVerifySchema);
  await verifyPhoneOtp(user!, input.code);
  return ok({ message: "Phone number verified." });
});
