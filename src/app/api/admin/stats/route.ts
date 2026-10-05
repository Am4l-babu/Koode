import { ok, route } from "@/lib/api";
import { dashboardStats, recentActivity } from "@/services/admin";

export const GET = route({ roles: ["ADMIN", "SUPER_ADMIN"] }, async () => {
  const [stats, activity] = await Promise.all([dashboardStats(), recentActivity()]);
  return ok({ stats, activity });
});
