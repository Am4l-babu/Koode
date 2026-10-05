import { ok, route } from "@/lib/api";
import { listDonationsAdmin } from "@/services/admin";
import type { DonationStatus } from "@prisma/client";

const STATUSES = ["CREATED", "CONFIRMED", "PREPARING", "IN_TRANSIT", "RECEIVED", "COMPLETED", "CANCELLED"];

export const GET = route({ permission: "DONATION_MANAGEMENT" }, async (req) => {
  const sp = req.nextUrl.searchParams;
  const status = sp.get("status") ?? "";
  return ok(
    await listDonationsAdmin({
      status: STATUSES.includes(status) ? (status as DonationStatus) : undefined,
      q: sp.get("q")?.slice(0, 20) || undefined,
      page: Number(sp.get("page")) || 1,
    }),
  );
});
