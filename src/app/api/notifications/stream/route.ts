import { route } from "@/lib/api";
import { sseResponse } from "@/lib/realtime";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Per-user stream (channel keyed by the authenticated user's id only). */
export const GET = route({ auth: true }, async (req, { user }) => {
  const unread = await db.notification.count({ where: { userId: user!.id, readAt: null } });
  return sseResponse(`user:${user!.id}`, req.signal, { type: "notification", unread });
});
