import { route } from "@/lib/api";
import { exportData } from "@/services/admin";

export const GET = route({ permission: "SYSTEM_SETTINGS" }, async (_req, { user, ip }) => {
  const data = await exportData(user!, ip);
  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="koode-export-${new Date().toISOString().slice(0, 10)}.json"`,
    },
  });
});
