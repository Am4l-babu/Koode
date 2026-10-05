import { ok, route } from "@/lib/api";
import { getPublicRequest } from "@/services/requests";

export const GET = route<{ id: string }>({}, async (_req, { params }) => ok(await getPublicRequest(params.id.toUpperCase())));
