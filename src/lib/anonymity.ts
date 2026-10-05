import "server-only";
import { createHmac } from "node:crypto";
import { env } from "./env";
import { PUBLIC_ID_ALPHABET } from "./ids";

/**
 * Per-recipient donor pseudonym.
 *
 * A recipient sees the same alias for repeat donations from the same donor
 * (useful for thank-you acknowledgements through the platform), but the alias
 * is different for every organisation and is not the donor's account publicId,
 * so aliases cannot be correlated across recipients or reversed without the
 * server secret.
 */
export function donorAliasFor(donorUserId: string, organizationId: string): string {
  const digest = createHmac("sha256", `donor-alias:${env.appSecret}`).update(`${donorUserId}:${organizationId}`).digest();
  let code = "";
  for (let i = 0; i < 5; i++) code += PUBLIC_ID_ALPHABET[digest[i]! % PUBLIC_ID_ALPHABET.length];
  return `D${code}`;
}
