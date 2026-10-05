import { ok, parseJson, route } from "@/lib/api";
import { updateReport } from "@/services/admin";
import { reportUpdateSchema } from "@/lib/validation/admin";
import { uuidSchema } from "@/lib/validation/common";

export const PATCH = route<{ id: string }>({ permission: "REQUEST_REVIEW", rateLimit: "mutation" }, async (req, { user, params, ip }) => {
  const input = await parseJson(req, reportUpdateSchema);
  await updateReport(user!, uuidSchema.parse(params.id), input.status, input.resolution, ip);
  return ok({ ok: true });
});
