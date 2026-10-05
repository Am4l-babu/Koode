import { ok, route } from "@/lib/api";
import { runRetention } from "@/services/admin";

export const POST = route({ permission: "SYSTEM_SETTINGS", rateLimit: "mutation" }, async (_req, { user, ip }) => ok(await runRetention(user!, ip)));
