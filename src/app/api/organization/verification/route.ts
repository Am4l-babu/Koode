import { z } from "zod";
import { ok, parseJson, route } from "@/lib/api";
import { submitVerification } from "@/services/organizations";

const schema = z.object({ note: z.string().trim().max(500).optional() });

export const POST = route({ roles: ["RECIPIENT"], rateLimit: "mutation" }, async (req, { user }) => {
  const input = await parseJson(req, schema);
  return ok(await submitVerification(user!, input.note));
});
