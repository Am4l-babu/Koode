import { ok, route } from "@/lib/api";
import { analytics } from "@/services/admin";

export const GET = route({ permission: "ANALYTICS_VIEW" }, async () => ok(await analytics()));
