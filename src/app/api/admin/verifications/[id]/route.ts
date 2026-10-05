import { ok, parseJson, route } from "@/lib/api";
import { decideVerification, getVerificationDossier } from "@/services/organizations";
import { verificationDecisionSchema } from "@/lib/validation/admin";
import { uuidSchema } from "@/lib/validation/common";

export const GET = route<{ id: string }>({ permission: "VERIFICATION_REVIEW" }, async (_req, { user, params, ip }) =>
  ok(await getVerificationDossier(user!, uuidSchema.parse(params.id), ip)),
);

export const PATCH = route<{ id: string }>({ permission: "VERIFICATION_REVIEW", rateLimit: "mutation" }, async (req, { user, params, ip }) => {
  const input = await parseJson(req, verificationDecisionSchema);
  await decideVerification(user!, uuidSchema.parse(params.id), input, ip);
  return ok({ ok: true });
});
