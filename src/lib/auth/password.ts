import "server-only";
import { hash, verify } from "@node-rs/argon2";

// Argon2id parameters (OWASP 2024 recommendation: m=19 MiB, t=2, p=1).
const OPTIONS = { memoryCost: 19456, timeCost: 2, parallelism: 1, outputLen: 32 } as const;

export async function hashPassword(password: string): Promise<string> {
  // algorithm 2 = Argon2id
  return hash(password, { ...OPTIONS, algorithm: 2 });
}

export async function verifyPassword(passwordHash: string, password: string): Promise<boolean> {
  try {
    return await verify(passwordHash, password);
  } catch {
    return false;
  }
}

/** Constant-ish work for unknown accounts to reduce user-enumeration timing signals. */
let dummyHash: Promise<string> | null = null;
export async function burnPasswordCheck(password: string): Promise<void> {
  dummyHash ??= hashPassword("timing-equaliser-not-a-real-password");
  await verifyPassword(await dummyHash, password);
}
