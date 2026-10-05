import { ok, route } from "@/lib/api";
import { getDonationIdentity } from "@/services/admin";
import { uuidSchema } from "@/lib/validation/common";

/**
 * 🔒 Identity resolution — requires VIEW_PRIVATE_IDENTITY and is audited.
 * This is the only endpoint that links a donor to a recipient.
 */
export const GET = route<{ id: string }>({ permission: "VIEW_PRIVATE_IDENTITY" }, async (_req, { user, params, ip }) =>
  ok(await getDonationIdentity(user!, uuidSchema.parse(params.id), ip)),
);
