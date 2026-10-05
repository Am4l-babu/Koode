import { ok, parseJson, route } from "@/lib/api";
import { createAdmin, listUsers } from "@/services/admin";
import { createAdminSchema } from "@/lib/validation/admin";
import type { Role } from "@prisma/client";

export const GET = route({ permission: "USER_MANAGEMENT" }, async (req, { user }) => {
  const sp = req.nextUrl.searchParams;
  const role = sp.get("role");
  return ok(
    await listUsers(user!, {
      role: role && ["DONOR", "RECIPIENT", "ADMIN", "SUPER_ADMIN"].includes(role) ? (role as Role) : undefined,
      status: ["ACTIVE", "SUSPENDED", "DISABLED"].includes(sp.get("status") ?? "") ? sp.get("status")! : undefined,
      q: sp.get("q")?.slice(0, 80) || undefined,
      page: Number(sp.get("page")) || 1,
    }),
  );
});

export const POST = route({ permission: "ADMIN_MANAGEMENT", rateLimit: "mutation" }, async (req, { user, ip }) => {
  const input = await parseJson(req, createAdminSchema);
  return ok(await createAdmin(user!, input, ip), { status: 201 });
});
