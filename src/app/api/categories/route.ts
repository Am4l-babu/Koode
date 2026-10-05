import { ok, route } from "@/lib/api";
import { listCategories } from "@/services/requests";

export const GET = route({}, async () => ok(await listCategories()));
