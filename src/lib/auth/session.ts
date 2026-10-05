import "server-only";
import type { AccountStatus, Permission, Role } from "@prisma/client";
import { db } from "../db";
import { hmac, randomToken } from "../crypto";
import { env } from "../env";

export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export function sessionCookieName(): string {
  // __Host- prefix forces Secure, Path=/ and no Domain when served over HTTPS.
  return env.cookieSecure ? "__Host-sb_session" : "sb_session";
}

export function sessionCookieOptions(expires: Date) {
  return {
    httpOnly: true,
    secure: env.cookieSecure,
    sameSite: "lax" as const,
    path: "/",
    expires,
  };
}

/** The authenticated principal. Always loaded from the database. */
export interface SessionUser {
  id: string;
  publicId: string;
  email: string;
  role: Role;
  permissions: Permission[];
  status: AccountStatus;
  emailVerified: boolean;
  locale: string;
  organizationId: string | null;
}

export function hashSessionToken(token: string): string {
  return hmac(token, "session");
}

export async function createSession(userId: string, meta: { ip?: string | null; userAgent?: string | null } = {}) {
  const token = randomToken(32);
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await db.session.create({
    data: {
      tokenHash: hashSessionToken(token),
      userId,
      expiresAt,
      ipHash: meta.ip ? hmac(meta.ip, "ip") : null,
      userAgent: meta.userAgent?.slice(0, 200) ?? null,
    },
  });
  return { token, expiresAt };
}

export async function resolveSession(token: string | undefined | null): Promise<SessionUser | null> {
  if (!token || token.length > 200) return null;
  const session = await db.session.findUnique({
    where: { tokenHash: hashSessionToken(token) },
    select: {
      id: true,
      expiresAt: true,
      user: {
        select: {
          id: true,
          publicId: true,
          email: true,
          role: true,
          permissions: true,
          status: true,
          emailVerifiedAt: true,
          locale: true,
          organization: { select: { id: true } },
        },
      },
    },
  });
  if (!session) return null;
  if (session.expiresAt.getTime() <= Date.now()) {
    await db.session.delete({ where: { id: session.id } }).catch(() => undefined);
    return null;
  }
  const u = session.user;
  // Suspended / disabled accounts lose access immediately.
  if (u.status !== "ACTIVE") return null;
  return {
    id: u.id,
    publicId: u.publicId,
    email: u.email,
    role: u.role,
    permissions: u.permissions,
    status: u.status,
    emailVerified: Boolean(u.emailVerifiedAt),
    locale: u.locale,
    organizationId: u.organization?.id ?? null,
  };
}

export async function destroySession(token: string | undefined | null) {
  if (!token) return;
  await db.session.deleteMany({ where: { tokenHash: hashSessionToken(token) } });
}

export async function destroyAllSessionsForUser(userId: string) {
  await db.session.deleteMany({ where: { userId } });
}
