import "server-only";
import type { MediaKind, MediaStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { AppError, forbidden, notFound } from "@/lib/errors";
import { audit } from "@/lib/audit";
import { hasPermission } from "@/lib/permissions";
import { templates } from "@/lib/notifications/templates";
import { deletePrivateObject, putPrivateObject, statPrivateObject } from "@/lib/storage";
import { MAX_IMAGES_PER_DONATION, MAX_VIDEOS_PER_DONATION, processMedia } from "@/lib/storage/media";
import type { SessionUser } from "@/lib/auth/session";
import { notify, notifyAdmins } from "./notifications";

export interface MediaDTO {
  id: string;
  kind: MediaKind;
  status: MediaStatus;
  url: string;
  createdAt: string;
}

/** Donations still in progress may have media added or removed. */
const EDITABLE = ["CONFIRMED", "PREPARING", "IN_TRANSIT"] as const;

export const mediaSelect = { id: true, kind: true, status: true, createdAt: true } as const;

export function toMediaDTO(m: { id: string; kind: MediaKind; status: MediaStatus; createdAt: Date }): MediaDTO {
  return { id: m.id, kind: m.kind, status: m.status, url: `/api/media/${m.id}`, createdAt: m.createdAt.toISOString() };
}

// ───────────────────────── Donor ─────────────────────────

export async function addDonationMedia(actor: SessionUser, donationPublicId: string, input: Buffer): Promise<MediaDTO> {
  if (actor.role !== "DONOR") throw forbidden();
  // Ownership is part of the query — someone else's donation is simply "not found".
  const donation = await db.donation.findFirst({
    where: { publicId: donationPublicId, donorId: actor.id },
    select: { id: true, publicId: true, status: true },
  });
  if (!donation) throw notFound("This donation");
  if (!(EDITABLE as readonly string[]).includes(donation.status)) {
    throw new AppError("CONFLICT", "Photos and videos can only be added while a donation is still in progress.");
  }

  const processed = await processMedia(input);
  const stored = await putPrivateObject(processed.buffer, processed.ext);
  let row;
  try {
    row = await db.$transaction(async (tx) => {
      // Serialise concurrent uploads for the same donation so the limits cannot be raced.
      await tx.$queryRaw`SELECT "id" FROM "donations" WHERE "id" = ${donation.id}::uuid FOR UPDATE`;
      const existing = await tx.donationMedia.groupBy({
        by: ["kind"],
        where: { donationId: donation.id, status: { not: "REJECTED" } },
        _count: true,
      });
      const count = (k: MediaKind) => existing.find((e) => e.kind === k)?._count ?? 0;
      if (processed.kind === "IMAGE" && count("IMAGE") >= MAX_IMAGES_PER_DONATION) {
        throw new AppError("CONFLICT", `You can add up to ${MAX_IMAGES_PER_DONATION} photos to a donation.`);
      }
      if (processed.kind === "VIDEO" && count("VIDEO") >= MAX_VIDEOS_PER_DONATION) {
        throw new AppError("CONFLICT", `You can add ${MAX_VIDEOS_PER_DONATION} video to a donation.`);
      }
      return tx.donationMedia.create({
        data: {
          donationId: donation.id,
          kind: processed.kind,
          // Metadata-stripped photos are visible straight away; videos wait for a moderator.
          status: processed.kind === "IMAGE" ? "APPROVED" : "PENDING",
          storageKey: stored.key,
          mimeType: processed.mime,
          sizeBytes: processed.buffer.length,
          sha256: stored.sha256,
        },
        select: mediaSelect,
      });
    });
  } catch (error) {
    // Nothing was recorded, so the stored file would be an orphan.
    await deletePrivateObject(stored.key);
    throw error;
  }
  // The upload is saved; a failed alert must not undo it.
  if (processed.kind === "VIDEO") {
    await notifyAdmins("DONATION_MANAGEMENT", templates.adminMediaAwaiting(donation.publicId)).catch((error) => console.error("media review alert failed", error));
  }
  return toMediaDTO(row);
}

export async function deleteDonationMedia(actor: SessionUser, donationPublicId: string, mediaId: string) {
  if (actor.role !== "DONOR") throw forbidden();
  const media = await db.donationMedia.findFirst({
    where: { id: mediaId, donation: { publicId: donationPublicId, donorId: actor.id } },
    select: { id: true, storageKey: true, donation: { select: { status: true } } },
  });
  if (!media) throw notFound("This file");
  if (!(EDITABLE as readonly string[]).includes(media.donation.status)) {
    throw new AppError("CONFLICT", "Files can only be removed while a donation is still in progress.");
  }
  await db.donationMedia.delete({ where: { id: media.id } });
  await deletePrivateObject(media.storageKey);
}

export async function listDonorMedia(actor: SessionUser, donationPublicId: string): Promise<MediaDTO[]> {
  if (actor.role !== "DONOR") throw forbidden();
  const rows = await db.donationMedia.findMany({
    where: { donation: { publicId: donationPublicId, donorId: actor.id } },
    orderBy: { createdAt: "asc" },
    select: mediaSelect,
  });
  return rows.map(toMediaDTO);
}

// ───────────────────────── Serving files ─────────────────────────

/**
 * Who may open a file:
 *  - the donor who uploaded it (any status),
 *  - the recipient organisation the donation is addressed to (APPROVED only),
 *  - administrators with DONATION_MANAGEMENT (any status, to moderate).
 * Everyone else — including other donors and organisations — gets "not found".
 */
export async function getMediaFile(actor: SessionUser, mediaId: string) {
  const media = await db.donationMedia.findUnique({
    where: { id: mediaId },
    select: {
      storageKey: true,
      mimeType: true,
      status: true,
      donation: { select: { donorId: true, organizationId: true } },
    },
  });
  if (!media) throw notFound("This file");
  const allowed =
    (actor.role === "DONOR" && media.donation.donorId === actor.id) ||
    (actor.role === "RECIPIENT" && actor.organizationId === media.donation.organizationId && media.status === "APPROVED") ||
    ((actor.role === "ADMIN" || actor.role === "SUPER_ADMIN") && hasPermission(actor, "DONATION_MANAGEMENT"));
  if (!allowed) throw notFound("This file");
  const size = await statPrivateObject(media.storageKey);
  if (size === null) throw notFound("This file");
  return { storageKey: media.storageKey, size, mimeType: media.mimeType };
}

// ───────────────────────── Admin ─────────────────────────

export async function listMediaForAdmin(donationId: string) {
  const rows = await db.donationMedia.findMany({
    where: { donationId },
    orderBy: { createdAt: "asc" },
    select: { ...mediaSelect, sizeBytes: true },
  });
  return rows.map((r) => ({ ...toMediaDTO(r), sizeBytes: r.sizeBytes }));
}

export async function moderateMedia(actor: SessionUser, mediaId: string, decision: "APPROVED" | "REJECTED", ip?: string) {
  const media = await db.donationMedia.findUnique({
    where: { id: mediaId },
    select: { id: true, kind: true, status: true, donationId: true, donation: { select: { publicId: true, donorId: true } } },
  });
  if (!media) throw notFound("This file");
  if (media.status === decision) return; // already decided — no duplicate notice

  await db.$transaction(async (tx) => {
    if (decision === "APPROVED" && media.status === "REJECTED") {
      // A rejected file doesn't count toward the limits, so the donor may have replaced it since.
      await tx.$queryRaw`SELECT "id" FROM "donations" WHERE "id" = ${media.donationId}::uuid FOR UPDATE`;
      const others = await tx.donationMedia.count({ where: { donationId: media.donationId, kind: media.kind, status: { not: "REJECTED" }, id: { not: media.id } } });
      const limit = media.kind === "VIDEO" ? MAX_VIDEOS_PER_DONATION : MAX_IMAGES_PER_DONATION;
      if (others >= limit) {
        throw new AppError("CONFLICT", `The donor has since added other ${media.kind === "VIDEO" ? "videos" : "photos"}, so this one can't be approved without going over the limit.`);
      }
    }
    await tx.donationMedia.update({ where: { id: media.id }, data: { status: decision, reviewedAt: new Date() } });
  });
  await audit(actor, "MEDIA_MODERATED", { type: "donation", id: media.donation.publicId }, { mediaKind: media.kind, decision }, ip);
  await notify(media.donation.donorId, templates.mediaDecisionDonor(media.donation.publicId, decision === "APPROVED", media.kind === "VIDEO" ? "video" : "photo"));
}
