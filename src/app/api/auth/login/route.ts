import { ok, parseJson, route } from "@/lib/api";
import { loginSchema } from "@/lib/validation/auth";
import { assertHuman } from "@/lib/captcha";
import { login } from "@/services/auth";
import { setSessionCookie } from "@/lib/auth/cookies";

export const POST = route({ rateLimit: "login" }, async (req, { ip }) => {
  const input = await parseJson(req, loginSchema);
  await assertHuman({ captchaToken: input.captchaToken, ip });
  const { user, session } = await login(input.email, input.password, { ip, userAgent: req.headers.get("user-agent") });
  return setSessionCookie(ok({ role: user.role, publicId: user.publicId }), session);
});
