import { ok, route } from "@/lib/api";
import { AppError } from "@/lib/errors";
import { MAX_UPLOAD_BYTES } from "@/lib/storage";
import { uploadVerificationDocument } from "@/services/organizations";

const KINDS = ["REGISTRATION_CERTIFICATE", "AUTHORIZATION", "PROOF_OF_OPERATION", "SUPPORTING_EVIDENCE"] as const;

export const POST = route({ roles: ["RECIPIENT"], rateLimit: "upload" }, async (req, { user }) => {
  const length = Number(req.headers.get("content-length") || 0);
  if (length > MAX_UPLOAD_BYTES + 64 * 1024) throw new AppError("BAD_REQUEST", "Files must be 5 MB or smaller.");
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  const kind = String(form?.get("kind") ?? "");
  if (!(file instanceof File)) throw new AppError("BAD_REQUEST", "Choose a file to upload.");
  if (!KINDS.includes(kind as (typeof KINDS)[number])) throw new AppError("BAD_REQUEST", "Choose a document type.");
  const buffer = Buffer.from(await file.arrayBuffer());
  return ok(await uploadVerificationDocument(user!, kind as (typeof KINDS)[number], buffer, file.name), { status: 201 });
});
