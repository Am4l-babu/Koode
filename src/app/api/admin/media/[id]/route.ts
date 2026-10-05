import { z } from "zod";
import { ok, parseJson, route } from "@/lib/api";
import { uuidSchema } from "@/lib/validation/common";
import { moderateMedia } from "@/services/donation-media";

const schema = z.object({ status: z.enum(["APPROVED", "REJECTED"]) });

/** Approve or reject a donor's photo/video before (or after) the organisation sees it. */
export const PATCH = route<{ id: string }>({ permission: "DONATION_MANAGEMENT", rateLimit: "mutation" }, async (req, { user, params, ip }) => {
  const { status } = await parseJson(req, schema);
  await moderateMedia(user!, uuidSchema.parse(params.id), status, ip);
  return ok({ ok: true });
});
