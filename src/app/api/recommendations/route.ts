import { ok, route } from "@/lib/api";
import { recommendationsFor } from "@/services/requests";

export const GET = route({ roles: ["DONOR"] }, async (_req, { user }) => ok(await recommendationsFor(user!)));
