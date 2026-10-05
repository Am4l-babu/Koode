import { ok, route } from "@/lib/api";
import { deleteOwnAccount } from "@/services/admin";
import { clearSessionCookie } from "@/lib/auth/cookies";

/** The caller's own session summary. Role is resolved server-side from the DB. */
export const GET = route({ auth: true }, async (_req, { user }) => {
  const u = user!;
  return ok({ publicId: u.publicId, role: u.role, emailVerified: u.emailVerified, permissions: u.permissions });
});

export const DELETE = route({ auth: true, rateLimit: "mutation" }, async (_req, { user }) => {
  await deleteOwnAccount(user!);
  return clearSessionCookie(ok({ ok: true }));
});
