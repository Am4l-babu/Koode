import { ok, parseJson, route } from "@/lib/api";
import { courierTrackingSchema } from "@/lib/couriers";
import { donorSetTracking } from "@/services/donations";

/** Add or correct the courier and tracking number for a donation sent by courier. */
export const PUT = route<{ id: string }>({ roles: ["DONOR"], rateLimit: "mutation" }, async (req, { user, params }) => {
  const input = await parseJson(req, courierTrackingSchema);
  return ok(await donorSetTracking(user!, params.id.toUpperCase(), input));
});
