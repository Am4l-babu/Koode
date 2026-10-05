import { z } from "zod";
import { ok, parseJson, route } from "@/lib/api";
import { listNotifications, markNotificationsRead } from "@/services/notifications";

export const GET = route({ auth: true }, async (_req, { user }) => ok(await listNotifications(user!)));

const schema = z.object({ ids: z.array(z.string().uuid()).max(100).optional(), all: z.boolean().optional() });

export const PATCH = route({ auth: true, rateLimit: "mutation" }, async (req, { user }) => {
  const input = await parseJson(req, schema);
  return ok(await markNotificationsRead(user!, input.all ? undefined : input.ids));
});
