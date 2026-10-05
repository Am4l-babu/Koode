import { ok, route } from "@/lib/api";
import { donorImpact, listDonorDonations } from "@/services/donations";

export const GET = route({ roles: ["DONOR"] }, async (_req, { user }) => {
  const [donations, impact] = await Promise.all([listDonorDonations(user!), donorImpact(user!)]);
  return ok({ donations, impact });
});
