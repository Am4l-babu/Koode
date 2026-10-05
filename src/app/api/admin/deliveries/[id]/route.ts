import { ok, parseJson, route } from "@/lib/api";
import { updateDelivery } from "@/services/admin";
import { adminUpdateDonationStatus } from "@/services/donations";
import { deliveryUpdateSchema } from "@/lib/validation/admin";
import { uuidSchema } from "@/lib/validation/common";
import { canTransition } from "@/lib/donation-status";

export const PATCH = route<{ id: string }>({ permission: "DELIVERY_MANAGEMENT", rateLimit: "mutation" }, async (req, { user, params, ip }) => {
  const input = await parseJson(req, deliveryUpdateSchema);
  const { donationId, donationStatus } = await updateDelivery(user!, uuidSchema.parse(params.id), input, ip);
  // Keep the donation timeline in step with logistics.
  if (input.status === "PICKED_UP" && canTransition(donationStatus, "IN_TRANSIT")) {
    await adminUpdateDonationStatus(user!, donationId, "IN_TRANSIT", "Picked up by platform logistics.", ip);
  }
  return ok({ ok: true });
});
