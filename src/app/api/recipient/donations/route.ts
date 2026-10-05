import { ok, route } from "@/lib/api";
import { listRecipientDonations } from "@/services/donations";

/** Recipient view: donations arrive with an anonymous donor alias only. */
export const GET = route({ roles: ["RECIPIENT"] }, async (req, { user }) =>
  ok(await listRecipientDonations(user!, req.nextUrl.searchParams.get("request")?.toUpperCase() || undefined)),
);
