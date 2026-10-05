import "server-only";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import type { Permission, Role } from "@prisma/client";
import { resolveSession, sessionCookieName, type SessionUser } from "./session";
import { hasPermission } from "../permissions";
import { AppError, forbidden, unauthenticated } from "../errors";

/** Current user for Server Components (memoised per request). */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const store = await cookies();
  return resolveSession(store.get(sessionCookieName())?.value);
});

async function currentPath(): Promise<string> {
  const h = await headers();
  return h.get("x-pathname") || "/dashboard";
}

/** Page guard: redirects to login, or to the user's dashboard on role mismatch. */
export async function requirePageUser(roles?: Role[]): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(await currentPath())}`);
  if (roles && !roles.includes(user.role)) redirect("/dashboard");
  return user;
}

export async function requirePagePermission(permission: Permission): Promise<SessionUser> {
  const user = await requirePageUser(["ADMIN", "SUPER_ADMIN"]);
  if (!hasPermission(user, permission)) redirect(`/admin?denied=${permission}`);
  return user;
}

// ─── Service-level assertions (throw AppError; used by API + services) ───

export function assertAuthenticated(user: SessionUser | null): asserts user is SessionUser {
  if (!user) throw unauthenticated();
}

export function assertRole(user: SessionUser | null, roles: Role[]): asserts user is SessionUser {
  assertAuthenticated(user);
  if (!roles.includes(user.role)) throw forbidden();
}

export function assertPermission(user: SessionUser | null, permission: Permission): asserts user is SessionUser {
  assertAuthenticated(user);
  if (!hasPermission(user, permission)) {
    throw new AppError("FORBIDDEN", "Your administrator account does not have permission for this action.", {
      permission,
    });
  }
}
