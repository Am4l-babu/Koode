import { randomInt } from "node:crypto";

/**
 * Random public identifiers. Never sequential, so they do not reveal row counts.
 * Alphabet excludes ambiguous characters (0/O, 1/I/L).
 */
export const PUBLIC_ID_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

export type PublicIdKind = "donor" | "recipient" | "admin" | "request" | "donation";

const PREFIX: Record<PublicIdKind, string> = {
  donor: "D",
  recipient: "R",
  admin: "A",
  request: "NR",
  donation: "DN",
};

export function randomCode(length = 6): string {
  let out = "";
  for (let i = 0; i < length; i++) out += PUBLIC_ID_ALPHABET[randomInt(PUBLIC_ID_ALPHABET.length)];
  return out;
}

export function generatePublicId(kind: PublicIdKind, length = 6): string {
  return `${PREFIX[kind]}-${randomCode(length)}`;
}

export function publicIdPrefixForRole(role: "DONOR" | "RECIPIENT" | "ADMIN" | "SUPER_ADMIN"): PublicIdKind {
  if (role === "RECIPIENT") return "recipient";
  if (role === "ADMIN" || role === "SUPER_ADMIN") return "admin";
  return "donor";
}

const PUBLIC_ID_RE = /^(D|R|A|NR|DN)-[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{6,10}$/;

export function isPublicId(value: string, kind?: PublicIdKind): boolean {
  if (!PUBLIC_ID_RE.test(value)) return false;
  return kind ? value.startsWith(`${PREFIX[kind]}-`) : true;
}

/** Retry wrapper for unique-collision on random ids (P2002). */
export async function withUniqueRetry<T>(fn: () => Promise<T>, attempts = 5): Promise<T> {
  let lastError: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      const code = (error as { code?: string })?.code;
      const target = JSON.stringify((error as { meta?: unknown })?.meta ?? "");
      if (code !== "P2002" || !target.includes("publicId")) throw error;
    }
  }
  throw lastError;
}
