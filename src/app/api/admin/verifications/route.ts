import { ok, route } from "@/lib/api";
import { listVerificationQueue } from "@/services/organizations";
import type { VerificationStatus } from "@prisma/client";

export const GET = route({ permission: "VERIFICATION_REVIEW" }, async (req) => {
  const s = req.nextUrl.searchParams.get("status") ?? "";
  return ok(await listVerificationQueue(["PENDING", "UNDER_REVIEW", "VERIFIED", "REJECTED", "SUSPENDED"].includes(s) ? (s as VerificationStatus) : undefined));
});
