import { ok, parseJson, route } from "@/lib/api";
import { getDonationAdmin } from "@/services/admin";
import { adminUpdateDonationStatus } from "@/services/donations";
import { adminDonationUpdateSchema } from "@/lib/validation/admin";
import { uuidSchema } from "@/lib/validation/common";

/** Admin "public view" of a donation: references only, no identities. */
export const GET = route<{ id: string }>({ permission: "DONATION_MANAGEMENT" }, async (_req, { params }) =>
  ok(await getDonationAdmin(uuidSchema.parse(params.id))),
);

export const PATCH = route<{ id: string }>({ permission: "DONATION_MANAGEMENT", rateLimit: "mutation" }, async (req, { user, params, ip }) => {
  const input = await parseJson(req, adminDonationUpdateSchema);
  await adminUpdateDonationStatus(user!, uuidSchema.parse(params.id), input.status, input.note, ip);
  return ok({ ok: true });
});
