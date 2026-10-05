import { ok, parseJson, route } from "@/lib/api";
import { decideRequest, getModerationDetail } from "@/services/admin";
import { requestDecisionSchema } from "@/lib/validation/admin";
import { uuidSchema } from "@/lib/validation/common";

export const GET = route<{ id: string }>({ permission: "REQUEST_REVIEW" }, async (_req, { params }) =>
  ok(await getModerationDetail(uuidSchema.parse(params.id))),
);

export const PATCH = route<{ id: string }>({ permission: "REQUEST_REVIEW", rateLimit: "mutation" }, async (req, { user, params, ip }) => {
  const input = await parseJson(req, requestDecisionSchema);
  await decideRequest(user!, uuidSchema.parse(params.id), input, ip);
  return ok({ ok: true });
});
