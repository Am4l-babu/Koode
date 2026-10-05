import "server-only";
import type { Permission } from "@prisma/client";
import { db } from "@/lib/db";
import { publishUserEvent } from "@/lib/realtime";
import { emailChannel } from "@/lib/notifications/channels";
import type { NotificationTemplate } from "@/lib/notifications/templates";
import { effectivePermissions } from "@/lib/permissions";
import type { SessionUser } from "@/lib/auth/session";

interface NotifyOptions {
  email?: boolean;
}

/**
 * Create an in-app notification (and optionally email it). Content always
 * comes from privacy-safe templates (src/lib/notifications/templates.ts).
 */
export async function notify(userId: string, template: NotificationTemplate, options: NotifyOptions = {}) {
  await db.notification.create({
    data: { userId, type: template.type, title: template.title, body: template.body, link: template.link },
  });
  const unread = await db.notification.count({ where: { userId, readAt: null } });
  publishUserEvent(userId, { type: "notification", unread });

  if (options.email) {
    const user = await db.user.findUnique({ where: { id: userId }, select: { email: true, status: true } });
    if (user && user.status === "ACTIVE") {
      await emailChannel()
        .send({ to: user.email, subject: template.title, text: `${template.body}\n\n${process.env.APP_URL ?? ""}${template.link ?? ""}` })
        .catch((error) => console.error("email delivery failed", error));
    }
  }
}

/** Notify every active admin holding `permission`. */
export async function notifyAdmins(permission: Permission, template: NotificationTemplate) {
  const admins = await db.user.findMany({
    where: { role: { in: ["ADMIN", "SUPER_ADMIN"] }, status: "ACTIVE" },
    select: { id: true, role: true, permissions: true, status: true },
  });
  const targets = admins.filter((a) => effectivePermissions(a).has(permission));
  await Promise.all(targets.map((a) => notify(a.id, template)));
}

export async function listNotifications(user: SessionUser, limit = 30) {
  const rows = await db.notification.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: Math.min(limit, 100),
    select: { id: true, type: true, title: true, body: true, link: true, readAt: true, createdAt: true },
  });
  const unread = await db.notification.count({ where: { userId: user.id, readAt: null } });
  return {
    unread,
    items: rows.map((n) => ({ ...n, readAt: n.readAt?.toISOString() ?? null, createdAt: n.createdAt.toISOString() })),
  };
}

export async function markNotificationsRead(user: SessionUser, ids?: string[]) {
  await db.notification.updateMany({
    // Scoped to the caller — a user can never touch another user's notifications.
    where: { userId: user.id, readAt: null, ...(ids?.length ? { id: { in: ids } } : {}) },
    data: { readAt: new Date() },
  });
  const unread = await db.notification.count({ where: { userId: user.id, readAt: null } });
  publishUserEvent(user.id, { type: "notification", unread });
  return { unread };
}

