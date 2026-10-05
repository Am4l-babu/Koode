import { ok, parseJson, route } from "@/lib/api";
import { createDonationSchema } from "@/lib/validation/donation";
import { createDonation } from "@/services/donations";

export const POST = route({ roles: ["DONOR"], rateLimit: "donation" }, async (req, { user }) => {
  const input = await parseJson(req, createDonationSchema);
  return ok(await createDonation(user!, input), { status: 201 });
});
