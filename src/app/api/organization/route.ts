import { ok, route } from "@/lib/api";
import { getOwnOrganization } from "@/services/organizations";

export const GET = route({ roles: ["RECIPIENT"] }, async (_req, { user }) => ok(await getOwnOrganization(user!)));
