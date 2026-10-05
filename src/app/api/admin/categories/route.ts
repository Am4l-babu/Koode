import { ok, parseJson, route } from "@/lib/api";
import { upsertCategory } from "@/services/admin";
import { listCategories } from "@/services/requests";
import { categoryUpsertSchema } from "@/lib/validation/admin";

export const GET = route({ roles: ["ADMIN", "SUPER_ADMIN"] }, async () => ok(await listCategories(true)));

/** Dynamic categories — schema-driven, no code change needed. */
export const POST = route({ permission: "SYSTEM_SETTINGS", rateLimit: "mutation" }, async (req, { user, ip }) => {
  const input = await parseJson(req, categoryUpsertSchema);
  return ok(await upsertCategory(user!, input, ip), { status: 201 });
});
