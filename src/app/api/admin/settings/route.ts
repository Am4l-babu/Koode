import { ok, parseJson, route } from "@/lib/api";
import { getSettings, updateSettings } from "@/services/settings";
import { settingsSchema } from "@/lib/validation/admin";

export const GET = route({ roles: ["ADMIN", "SUPER_ADMIN"] }, async () => ok(await getSettings()));

export const PATCH = route({ permission: "SYSTEM_SETTINGS", rateLimit: "mutation" }, async (req, { user, ip }) => {
  const input = await parseJson(req, settingsSchema);
  return ok(await updateSettings(user!, input, ip));
});
