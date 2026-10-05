import { ok, parseJson, route } from "@/lib/api";
import { updateUser, userActivity } from "@/services/admin";
import { userUpdateSchema } from "@/lib/validation/admin";
import { uuidSchema } from "@/lib/validation/common";

export const GET = route<{ id: string }>({ permission: "USER_MANAGEMENT" }, async (_req, { params }) =>
  ok(await userActivity(uuidSchema.parse(params.id))),
);

export const PATCH = route<{ id: string }>({ permission: "USER_MANAGEMENT", rateLimit: "mutation" }, async (req, { user, params, ip }) => {
  const input = await parseJson(req, userUpdateSchema);
  await updateUser(user!, uuidSchema.parse(params.id), input, ip);
  return ok({ ok: true });
});
