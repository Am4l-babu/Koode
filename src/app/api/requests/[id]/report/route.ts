import { ok, parseJson, route } from "@/lib/api";
import { reportSchema } from "@/lib/validation/admin";
import { reportRequest } from "@/services/requests";

export const POST = route<{ id: string }>({ rateLimit: "report" }, async (req, { user, params }) => {
  const input = await parseJson(req, reportSchema);
  return ok(await reportRequest(user, params.id.toUpperCase(), input), { status: 201 });
});
