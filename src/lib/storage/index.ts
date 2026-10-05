import "server-only";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { env } from "../env";
import { hmac, randomToken, safeEqual } from "../crypto";
import { AppError } from "../errors";

/**
 * Private object storage for verification documents.
 * Files are stored OUTSIDE /public under random keys; there is no static URL.
 * Admins receive short-lived HMAC-signed URLs that are additionally checked
 * against their session + VERIFICATION_REVIEW permission.
 */
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
export const SIGNED_URL_TTL_SECONDS = 300;

const ALLOWED: { mime: string; ext: string; match: (b: Buffer) => boolean }[] = [
  { mime: "application/pdf", ext: "pdf", match: (b) => b.subarray(0, 5).toString("latin1") === "%PDF-" },
  { mime: "image/png", ext: "png", match: (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  { mime: "image/jpeg", ext: "jpg", match: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  {
    mime: "image/webp",
    ext: "webp",
    match: (b) => b.subarray(0, 4).toString("latin1") === "RIFF" && b.subarray(8, 12).toString("latin1") === "WEBP",
  },
];

/** Validate by magic bytes — the client-declared MIME type is never trusted. */
export function sniffFile(buffer: Buffer): { mime: string; ext: string } | null {
  const hit = ALLOWED.find((a) => a.match(buffer));
  return hit ? { mime: hit.mime, ext: hit.ext } : null;
}

export function validateUpload(buffer: Buffer): { mime: string; ext: string } {
  if (buffer.length === 0) throw new AppError("BAD_REQUEST", "The file is empty.");
  if (buffer.length > MAX_UPLOAD_BYTES) throw new AppError("BAD_REQUEST", "Files must be 5 MB or smaller.");
  const type = sniffFile(buffer);
  if (!type) throw new AppError("BAD_REQUEST", "Upload a PDF, PNG, JPEG or WEBP file.");
  return type;
}

function root(): string {
  return path.resolve(process.cwd(), env.storageDir);
}

function resolveKey(key: string): string {
  if (!/^[A-Za-z0-9_-]{20,80}\.[a-z0-9]{3,4}$/.test(key)) throw new AppError("BAD_REQUEST", "Invalid storage key.");
  const full = path.resolve(root(), key);
  if (!full.startsWith(root() + path.sep)) throw new AppError("BAD_REQUEST", "Invalid storage key.");
  return full;
}

export async function putPrivateObject(buffer: Buffer, ext: string) {
  const key = `${randomToken(24)}.${ext}`;
  await mkdir(root(), { recursive: true, mode: 0o700 });
  await writeFile(resolveKey(key), buffer, { mode: 0o600 });
  return { key, sha256: createHash("sha256").update(buffer).digest("hex") };
}

export async function getPrivateObject(key: string): Promise<Buffer> {
  return readFile(resolveKey(key));
}

export async function deletePrivateObject(key: string) {
  await unlink(resolveKey(key)).catch(() => undefined);
}

export function signDocumentUrl(documentId: string, now = Date.now()): string {
  const exp = Math.floor(now / 1000) + SIGNED_URL_TTL_SECONDS;
  const sig = hmac(`${documentId}:${exp}`, "document-url");
  return `/api/admin/documents/${documentId}?exp=${exp}&sig=${sig}`;
}

export function verifyDocumentSignature(documentId: string, exp: string | null, sig: string | null, now = Date.now()): boolean {
  if (!exp || !sig || !/^\d+$/.test(exp)) return false;
  if (Number(exp) * 1000 < now) return false;
  return safeEqual(hmac(`${documentId}:${exp}`, "document-url"), sig);
}
