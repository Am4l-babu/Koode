import "server-only";
import type { DocumentKind, VerificationStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { decrypt, decryptOptional, encrypt } from "@/lib/crypto";
import { AppError, forbidden, notFound } from "@/lib/errors";
import { audit } from "@/lib/audit";
import { putPrivateObject, signDocumentUrl, validateUpload } from "@/lib/storage";
import { templates } from "@/lib/notifications/templates";
import type { SessionUser } from "@/lib/auth/session";
import { notify, notifyAdmins } from "./notifications";
import { getSettings } from "./settings";

function requireOrg(actor: SessionUser): string {
  if (actor.role !== "RECIPIENT" || !actor.organizationId) throw forbidden();
  return actor.organizationId;
}

/** The recipient's view of its OWN organisation (its own private data included). */
export async function getOwnOrganization(actor: SessionUser) {
  const organizationId = requireOrg(actor);
  const org = await db.recipientOrganization.findUniqueOrThrow({
    where: { id: organizationId },
    select: {
      publicId: true,
      orgType: true,
      publicDescriptor: true,
      focusArea: true,
      district: true,
      city: true,
      state: true,
      verificationStatus: true,
      verifiedAt: true,
      createdAt: true,
      private: true,
      documents: { select: { id: true, kind: true, mimeType: true, sizeBytes: true, uploadedAt: true }, orderBy: { uploadedAt: "desc" } },
      verifications: {
        orderBy: { submittedAt: "desc" },
        take: 5,
        select: { status: true, submittedAt: true, reviewedAt: true, reviewNote: true, applicantNote: true },
      },
      _count: { select: { requests: true, donations: true } },
    },
  });
  const p = org.private;
  return {
    publicId: org.publicId,
    orgType: org.orgType,
    publicDescriptor: org.publicDescriptor,
    focusArea: org.focusArea,
    district: org.district,
    city: org.city,
    state: org.state,
    verificationStatus: org.verificationStatus,
    verifiedAt: org.verifiedAt?.toISOString() ?? null,
    createdAt: org.createdAt.toISOString(),
    private: p
      ? {
          legalName: decrypt(p.legalNameEnc),
          contactPerson: decrypt(p.contactPersonEnc),
          phone: decrypt(p.phoneEnc),
          address: decrypt(p.addressEnc),
          pinCode: decryptOptional(p.pinCodeEnc),
          registrationNumber: decryptOptional(p.registrationNumberEnc),
        }
      : null,
    documents: org.documents.map((d) => ({ ...d, uploadedAt: d.uploadedAt.toISOString() })),
    verifications: org.verifications.map((v) => ({
      ...v,
      submittedAt: v.submittedAt.toISOString(),
      reviewedAt: v.reviewedAt?.toISOString() ?? null,
    })),
    counts: org._count,
  };
}

export async function uploadVerificationDocument(actor: SessionUser, kind: DocumentKind, buffer: Buffer, originalName: string) {
  const organizationId = requireOrg(actor);
  const count = await db.verificationDocument.count({ where: { organizationId } });
  if (count >= 10) throw new AppError("BAD_REQUEST", "You can upload up to 10 documents. Remove older ones by contacting the platform team.");
  const type = validateUpload(buffer);
  const stored = await putPrivateObject(buffer, type.ext);
  const settings = await getSettings();
  const doc = await db.verificationDocument.create({
    data: {
      organizationId,
      kind,
      storageKey: stored.key,
      originalNameEnc: encrypt(originalName.slice(0, 120)),
      mimeType: type.mime,
      sizeBytes: buffer.length,
      sha256: stored.sha256,
      retainUntil: new Date(Date.now() + settings.retention.documentDays * 86_400_000),
    },
    select: { id: true, kind: true, mimeType: true, sizeBytes: true, uploadedAt: true },
  });
  return { ...doc, uploadedAt: doc.uploadedAt.toISOString() };
}

export async function submitVerification(actor: SessionUser, applicantNote?: string) {
  const organizationId = requireOrg(actor);
  const [org, docs, settings] = await Promise.all([
    db.recipientOrganization.findUniqueOrThrow({ where: { id: organizationId }, select: { publicId: true, verificationStatus: true } }),
    db.verificationDocument.count({ where: { organizationId } }),
    getSettings(),
  ]);
  if (org.verificationStatus === "VERIFIED") throw new AppError("CONFLICT", "Your organisation is already verified.");
  if (org.verificationStatus === "SUSPENDED") throw forbidden("This organisation is suspended. Please contact the platform team.");
  if (settings.verificationPolicy.requireDocuments && docs < settings.verificationPolicy.minDocuments) {
    throw new AppError("VALIDATION_FAILED", `Please upload at least ${settings.verificationPolicy.minDocuments} supporting document(s) first.`);
  }
  await db.$transaction([
    db.verification.create({ data: { organizationId, status: "PENDING", applicantNote: applicantNote ?? null } }),
    db.recipientOrganization.update({ where: { id: organizationId }, data: { verificationStatus: "PENDING" } }),
  ]);
  await notifyAdmins("VERIFICATION_REVIEW", templates.adminNewVerification(org.publicId));
  return { ok: true };
}

// ───────────────────────── Admin: verification queue ─────────────────────────

export async function listVerificationQueue(status?: VerificationStatus) {
  const orgs = await db.recipientOrganization.findMany({
    where: status ? { verificationStatus: status } : {},
    orderBy: { updatedAt: "desc" },
    take: 200,
    select: {
      id: true,
      publicId: true,
      orgType: true,
      publicDescriptor: true,
      district: true,
      city: true,
      verificationStatus: true,
      verifiedAt: true,
      createdAt: true,
      _count: { select: { documents: true, requests: true } },
      verifications: { orderBy: { submittedAt: "desc" }, take: 1, select: { submittedAt: true, status: true } },
    },
  });
  return orgs.map((o) => ({
    ...o,
    createdAt: o.createdAt.toISOString(),
    verifiedAt: o.verifiedAt?.toISOString() ?? null,
    lastSubmittedAt: o.verifications[0]?.submittedAt.toISOString() ?? null,
  }));
}

/**
 * Full verification dossier. Reviewers need the organisation's real details
 * to verify it, so this is audited as a private-identity access. It never
 * includes donor information.
 */
export async function getVerificationDossier(actor: SessionUser, organizationId: string, ip?: string) {
  const org = await db.recipientOrganization.findUnique({
    where: { id: organizationId },
    select: {
      id: true,
      publicId: true,
      orgType: true,
      publicDescriptor: true,
      focusArea: true,
      district: true,
      city: true,
      state: true,
      verificationStatus: true,
      verifiedAt: true,
      createdAt: true,
      private: true,
      user: { select: { email: true, emailVerifiedAt: true, private: { select: { phoneVerifiedAt: true } } } },
      documents: { select: { id: true, kind: true, mimeType: true, sizeBytes: true, uploadedAt: true, originalNameEnc: true } },
      verifications: {
        orderBy: { submittedAt: "desc" },
        select: { id: true, status: true, checklist: true, applicantNote: true, reviewNote: true, submittedAt: true, reviewedAt: true },
      },
      requests: { select: { status: true } },
      _count: { select: { donations: true } },
    },
  });
  if (!org) throw notFound("This organisation");
  await audit(actor, "VIEW_PRIVATE_IDENTITY", { type: "organization", id: org.publicId }, { context: "verification" }, ip);
  const p = org.private;
  return {
    id: org.id,
    publicId: org.publicId,
    orgType: org.orgType,
    publicDescriptor: org.publicDescriptor,
    focusArea: org.focusArea,
    district: org.district,
    city: org.city,
    state: org.state,
    verificationStatus: org.verificationStatus,
    verifiedAt: org.verifiedAt?.toISOString() ?? null,
    createdAt: org.createdAt.toISOString(),
    private: p
      ? {
          legalName: decrypt(p.legalNameEnc),
          contactPerson: decrypt(p.contactPersonEnc),
          phone: decrypt(p.phoneEnc),
          address: decrypt(p.addressEnc),
          pinCode: decryptOptional(p.pinCodeEnc),
          registrationNumber: decryptOptional(p.registrationNumberEnc),
          email: org.user.email,
          emailVerified: Boolean(org.user.emailVerifiedAt),
          phoneVerified: Boolean(org.user.private?.phoneVerifiedAt),
        }
      : null,
    documents: org.documents.map((d) => ({
      id: d.id,
      kind: d.kind,
      mimeType: d.mimeType,
      sizeBytes: d.sizeBytes,
      uploadedAt: d.uploadedAt.toISOString(),
      name: decrypt(d.originalNameEnc),
      url: signDocumentUrl(d.id),
    })),
    verifications: org.verifications.map((v) => ({
      ...v,
      submittedAt: v.submittedAt.toISOString(),
      reviewedAt: v.reviewedAt?.toISOString() ?? null,
    })),
    previousActivity: {
      requests: org.requests.length,
      fulfilled: org.requests.filter((r) => r.status === "FULFILLED").length,
      donations: org._count.donations,
    },
  };
}

export async function decideVerification(
  actor: SessionUser,
  organizationId: string,
  input: { status: Exclude<VerificationStatus, "PENDING">; note?: string; checklist: Record<string, boolean | undefined> },
  ip?: string,
) {
  const org = await db.recipientOrganization.findUnique({
    where: { id: organizationId },
    select: { id: true, publicId: true, userId: true, verificationStatus: true, verifiedAt: true },
  });
  if (!org) throw notFound("This organisation");
  const open = await db.verification.findFirst({ where: { organizationId }, orderBy: { submittedAt: "desc" }, select: { id: true } });
  await db.$transaction(async (tx) => {
    if (open) {
      await tx.verification.update({
        where: { id: open.id },
        data: { status: input.status, reviewNote: input.note ?? null, checklist: input.checklist, reviewerId: actor.id, reviewedAt: new Date() },
      });
    } else {
      await tx.verification.create({
        data: { organizationId, status: input.status, reviewNote: input.note ?? null, checklist: input.checklist, reviewerId: actor.id, reviewedAt: new Date() },
      });
    }
    await tx.recipientOrganization.update({
      where: { id: organizationId },
      data: {
        verificationStatus: input.status,
        verifiedAt: input.status === "VERIFIED" ? (org.verifiedAt ?? new Date()) : org.verifiedAt,
      },
    });
  });
  await audit(actor, "VERIFICATION_DECISION", { type: "organization", id: org.publicId }, { from: org.verificationStatus, to: input.status }, ip);
  await notify(org.userId, templates.verificationDecision(input.status), { email: true });
}
