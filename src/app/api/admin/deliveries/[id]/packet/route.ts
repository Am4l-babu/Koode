import { ok, route } from "@/lib/api";
import { getDeliveryPacket } from "@/services/admin";
import { uuidSchema } from "@/lib/validation/common";

/** Least-privilege logistics packet for one leg (?leg=pickup|dropoff). Addresses only, no names. Audited. */
export const GET = route<{ id: string }>({ permission: "DELIVERY_MANAGEMENT" }, async (req, { user, params, ip }) => {
  const leg = req.nextUrl.searchParams.get("leg") === "dropoff" ? "dropoff" : "pickup";
  return ok(await getDeliveryPacket(user!, uuidSchema.parse(params.id), leg, ip));
});
