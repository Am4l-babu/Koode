import { ok, route } from "@/lib/api";
import { resolveUserIdentity } from "@/services/admin";
import { uuidSchema } from "@/lib/validation/common";

export const GET = route<{ id: string }>({ permission: "VIEW_PRIVATE_IDENTITY" }, async (_req, { user, params, ip }) =>
  ok(await resolveUserIdentity(user!, uuidSchema.parse(params.id), ip)),
);
