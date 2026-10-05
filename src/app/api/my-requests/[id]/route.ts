import { ok, parseJson, route } from "@/lib/api";
import { getOwnRequest, recipientRequestAction } from "@/services/requests";
import { recipientRequestStatusSchema } from "@/lib/validation/request";

export const GET = route<{ id: string }>({ roles: ["RECIPIENT"] }, async (_req, { user, params }) =>
  ok(await getOwnRequest(user!, params.id.toUpperCase())),
);

export const PATCH = route<{ id: string }>({ roles: ["RECIPIENT"], rateLimit: "mutation" }, async (req, { user, params }) => {
  const input = await parseJson(req, recipientRequestStatusSchema);
  return ok(await recipientRequestAction(user!, params.id.toUpperCase(), input.action));
});
