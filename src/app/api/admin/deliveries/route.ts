import { ok, route } from "@/lib/api";
import { listDeliveries } from "@/services/admin";

export const GET = route({ permission: "DELIVERY_MANAGEMENT" }, async (req) => {
  const s = req.nextUrl.searchParams.get("status") ?? "";
  return ok(await listDeliveries(["UNASSIGNED", "SCHEDULED", "PICKED_UP", "DELIVERED", "FAILED"].includes(s) ? s : undefined));
});
