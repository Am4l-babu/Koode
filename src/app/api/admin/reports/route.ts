import { ok, route } from "@/lib/api";
import { listReports } from "@/services/admin";
import type { ReportStatus } from "@prisma/client";

export const GET = route({ permission: "REQUEST_REVIEW" }, async (req) => {
  const s = req.nextUrl.searchParams.get("status") ?? "";
  return ok(await listReports(["OPEN", "INVESTIGATING", "RESOLVED", "DISMISSED"].includes(s) ? (s as ReportStatus) : undefined));
});
