import { ok, parseJson, route } from "@/lib/api";
import { donorDonationUpdateSchema } from "@/lib/validation/donation";
import { donorUpdateDonation, getDonorDonation } from "@/services/donations";

export const GET = route<{ id: string }>({ roles: ["DONOR"] }, async (_req, { user, params }) =>
  ok(await getDonorDonation(user!, params.id.toUpperCase())),
);

export const PATCH = route<{ id: string }>({ roles: ["DONOR"], rateLimit: "mutation" }, async (req, { user, params }) => {
  const input = await parseJson(req, donorDonationUpdateSchema);
  return ok(await donorUpdateDonation(user!, params.id.toUpperCase(), input.action));
});
