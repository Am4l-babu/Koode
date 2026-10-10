import { ok, parseJson, route } from "@/lib/api";
import { notFound } from "@/lib/errors";
import { getCategoryForEditing, setCategoryProductTypes } from "@/services/admin";
import { productTypesUpdateSchema } from "@/lib/validation/admin";

export const GET = route<{ slug: string }>({ permission: "SYSTEM_SETTINGS" }, async (_req, { params }) => {
  const category = await getCategoryForEditing(params.slug);
  if (!category) throw notFound("This category");
  return ok(category);
});

/** Replace a category's product types; `{ productTypes: null }` restores the built-in list. */
export const PUT = route<{ slug: string }>({ permission: "SYSTEM_SETTINGS", rateLimit: "mutation" }, async (req, { user, params, ip }) => {
  const input = await parseJson(req, productTypesUpdateSchema);
  return ok(await setCategoryProductTypes(user!, params.slug, input.productTypes, ip));
});
