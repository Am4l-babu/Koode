import { ok, route } from "@/lib/api";
import { listRequestsForModeration } from "@/services/admin";
import type { RequestStatus } from "@prisma/client";

const STATUSES = ["DRAFT", "PENDING_VERIFICATION", "NEEDS_INFO", "ACTIVE", "FULFILLED", "CLOSED", "REJECTED"];

export const GET = route({ permission: "REQUEST_REVIEW" }, async (req) => {
  const status = req.nextUrl.searchParams.get("status") ?? "";
  return ok(await listRequestsForModeration(STATUSES.includes(status) ? (status as RequestStatus) : undefined, Number(req.nextUrl.searchParams.get("page")) || 1));
});
