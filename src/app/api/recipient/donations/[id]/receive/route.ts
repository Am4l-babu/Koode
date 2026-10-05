import { ok, route } from "@/lib/api";
import { recipientConfirmReceipt } from "@/services/donations";

export const POST = route<{ id: string }>({ roles: ["RECIPIENT"], rateLimit: "mutation" }, async (_req, { user, params }) =>
  ok(await recipientConfirmReceipt(user!, params.id.toUpperCase())),
);
