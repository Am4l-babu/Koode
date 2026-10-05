import { ok, route } from "@/lib/api";
import { uuidSchema } from "@/lib/validation/common";
import { deleteDonationMedia } from "@/services/donation-media";

export const DELETE = route<{ id: string; mediaId: string }>({ roles: ["DONOR"], rateLimit: "mutation" }, async (_req, { user, params }) => {
  await deleteDonationMedia(user!, params.id.toUpperCase(), uuidSchema.parse(params.mediaId));
  return ok({ ok: true });
});
