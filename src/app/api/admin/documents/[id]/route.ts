import { route } from "@/lib/api";
import { db } from "@/lib/db";
import { AppError, notFound } from "@/lib/errors";
import { getPrivateObject, verifyDocumentSignature } from "@/lib/storage";
import { audit } from "@/lib/audit";
import { uuidSchema } from "@/lib/validation/common";

/**
 * Private document download. Requires BOTH a valid short-lived signature and
 * an authenticated admin session with VERIFICATION_REVIEW. Every access is audited.
 */
export const GET = route<{ id: string }>({ permission: "VERIFICATION_REVIEW" }, async (req, { user, params, ip }) => {
  const id = uuidSchema.parse(params.id);
  const sp = req.nextUrl.searchParams;
  if (!verifyDocumentSignature(id, sp.get("exp"), sp.get("sig"))) {
    throw new AppError("FORBIDDEN", "This document link has expired. Reopen it from the verification page.");
  }
  const doc = await db.verificationDocument.findUnique({
    where: { id },
    select: { storageKey: true, mimeType: true, organization: { select: { publicId: true } } },
  });
  if (!doc) throw notFound("This document");
  const file = await getPrivateObject(doc.storageKey);
  await audit(user!, "VIEW_VERIFICATION_DOCUMENT", { type: "organization", id: doc.organization.publicId }, { document: id }, ip);
  return new Response(new Uint8Array(file), {
    headers: {
      "Content-Type": doc.mimeType,
      "Content-Disposition": "inline",
      "Cache-Control": "no-store, private",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox",
    },
  });
});
