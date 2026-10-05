import { ok, route } from "@/lib/api";
import { listOwnRequests } from "@/services/requests";

export const GET = route({ roles: ["RECIPIENT"] }, async (_req, { user }) => ok(await listOwnRequests(user!)));
