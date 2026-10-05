import { ok, parseJson, route } from "@/lib/api";
import { registerSchema } from "@/lib/validation/auth";
import { assertHuman } from "@/lib/captcha";
import { register } from "@/services/auth";
import { setSessionCookie } from "@/lib/auth/cookies";

export const POST = route({ rateLimit: "register" }, async (req, { ip }) => {
  const input = await parseJson(req, registerSchema);
  await assertHuman({ ...input, ip });
  const { user, session } = await register(input, { ip, userAgent: req.headers.get("user-agent") });
  // Response carries only the role and public reference — never PII.
  return setSessionCookie(ok({ role: user.role, publicId: user.publicId }, { status: 201 }), session);
});
