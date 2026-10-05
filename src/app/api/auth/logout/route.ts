import { ok, route } from "@/lib/api";
import { destroySession, sessionCookieName } from "@/lib/auth/session";
import { clearSessionCookie } from "@/lib/auth/cookies";
import { audit } from "@/lib/audit";

export const POST = route({}, async (req, { user, ip }) => {
  await destroySession(req.cookies.get(sessionCookieName())?.value);
  if (user) await audit(user, "LOGOUT", { type: "user", id: user.publicId }, {}, ip);
  return clearSessionCookie(ok({ ok: true }));
});
