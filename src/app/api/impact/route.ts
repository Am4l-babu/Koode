import { ok, route } from "@/lib/api";
import { publicImpact } from "@/services/impact";

export const GET = route({}, async () => ok(await publicImpact()));
