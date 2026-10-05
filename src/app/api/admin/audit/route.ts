import { ok, route } from "@/lib/api";
import { listAuditLogs } from "@/services/admin";
import { AUDIT_ACTIONS } from "@/lib/audit";

export const GET = route({ permission: "AUDIT_LOG_VIEW" }, async (req) => {
  const sp = req.nextUrl.searchParams;
  const action = sp.get("action") ?? "";
  return ok(await listAuditLogs({ action: (AUDIT_ACTIONS as readonly string[]).includes(action) ? action : undefined, page: Number(sp.get("page")) || 1 }));
});
