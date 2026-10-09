import "server-only";
import { Prisma, type DonationStatus, type Role } from "@prisma/client";
import { db } from "@/lib/db";
import { AppError, forbidden, notFound } from "@/lib/errors";
import { encrypt } from "@/lib/crypto";
import { generatePublicId, withUniqueRetry } from "@/lib/ids";
import { audit } from "@/lib/audit";
import { canActorTransition, holdsQuantity } from "@/lib/donation-status";
import { CONDITION_LABELS, DONATION_STATUS_LABELS } from "@/lib/descriptors";
import { donorFieldsFor, requiresNew, resolveCategorySchema, validateAttributes } from "@/lib/categories";
import { requestPercent } from "@/lib/fulfillment";
import { publishRequestProgress } from "@/lib/realtime";
import { templates } from "@/lib/notifications/templates";
import {
  donorDonationSelect,
  recipientDonationSelect,
  toDonorDonation,
  toRecipientDonation,
  type DonorDonationDTO,
} from "@/lib/dto/donations";
import type { SessionUser } from "@/lib/auth/session";
import { CONDITIONS, type CreateDonationInput } from "@/lib/validation/donation";
import { findCourier, type CourierTrackingInput } from "@/lib/couriers";
import { notify, notifyAdmins } from "./notifications";
import { getSettings } from "./settings";

type Tx = Prisma.TransactionClient;

/** Recompute denormalised request progress inside the same transaction. */
async function refreshRequestProgress(tx: Tx, requestId: string) {
  const items = await tx.requestItem.findMany({
    where: { requestId },
    select: { id: true, quantityRequired: true, quantityCommitted: true },
  });
  const percent = requestPercent(items);
  const remaining = items.reduce((s, i) => s + (i.quantityRequired - i.quantityCommitted), 0);
  const request = await tx.request.findUniqueOrThrow({ where: { id: requestId }, select: { status: true, publicId: true } });
  let status = request.status;
  if (remaining === 0 && status === "ACTIVE") status = "FULFILLED";
  if (remaining > 0 && status === "FULFILLED") status = "ACTIVE";
  await tx.request.update({
    where: { id: requestId },
    data: {
      percentFulfilled: percent,
      quantityRemaining: remaining,
      status,
      fulfilledAt: status === "FULFILLED" && request.status !== "FULFILLED" ? new Date() : undefined,
    },
  });
  return {
    publicId: request.publicId,
    becameFulfilled: status === "FULFILLED" && request.status !== "FULFILLED",
    event: {
      type: "progress" as const,
      requestId: request.publicId,
      percent,
      items: items.map((i) => ({ id: i.id, committed: i.quantityCommitted, remaining: i.quantityRequired - i.quantityCommitted })),
    },
  };
}

/** The least-new condition among the items — what the donation as a whole is described as. */
function leastNew(conditions: (typeof CONDITIONS)[number][]): (typeof CONDITIONS)[number] {
  return conditions.reduce((worst, c) => (CONDITIONS.indexOf(c) > CONDITIONS.indexOf(worst) ? c : worst));
}

/**
 * Commit to a donation.
 *
 * Concurrency: each item is reserved with a single conditional UPDATE
 *   SET committed = committed + q WHERE committed + q <= required
 * which Postgres executes atomically under a row lock. If two donors race
 * for the last 2 units, exactly one UPDATE matches; the other affects 0 rows
 * and its whole transaction rolls back. A CHECK constraint is the final guard.
 */
export async function createDonation(actor: SessionUser, input: CreateDonationInput): Promise<DonorDonationDTO> {
  if (actor.role !== "DONOR") throw forbidden("Only donor accounts can make donations.");
  const settings = await getSettings();
  if (settings.security.requireEmailVerificationToDonate && !actor.emailVerified) {
    throw new AppError("FORBIDDEN", "Please verify your email address before donating.");
  }
  if (input.groupType !== "INDIVIDUAL" && !settings.features.groupDonations) {
    throw new AppError("VALIDATION_FAILED", "Group donations are currently disabled.");
  }

  const request = await db.request.findFirst({
    where: { publicId: input.requestId, status: "ACTIVE", organization: { verificationStatus: "VERIFIED" } },
    select: {
      id: true,
      publicId: true,
      organizationId: true,
      neededBy: true,
      deliveryMethods: true,
      organization: { select: { userId: true } },
      category: { select: { slug: true, fieldSchema: true } },
      items: { select: { id: true, name: true, estimatedUnitValue: true, quantityRequired: true, quantityCommitted: true, attributes: true } },
    },
  });
  if (!request) throw notFound("This request is no longer accepting donations, or it");
  if (request.organization.userId === actor.id) throw forbidden("You cannot donate to your own request.");
  if (!request.deliveryMethods.includes(input.deliveryMethod)) {
    throw new AppError("VALIDATION_FAILED", "This delivery method isn't available for this request.", {
      fields: { deliveryMethod: "Choose one of the available delivery methods." },
    });
  }
  const itemById = new Map(request.items.map((i) => [i.id, i]));
  for (const line of input.items) {
    if (!itemById.has(line.requestItemId)) throw new AppError("VALIDATION_FAILED", "One of the selected items doesn't belong to this request.");
  }

  // What the donor says about each item is checked against that product's questions.
  const schema = resolveCategorySchema(request.category.slug, request.category.fieldSchema);
  const fieldErrors: Record<string, string> = {};
  const variants = input.items.map((line, index) => {
    const attributes = (itemById.get(line.requestItemId)!.attributes ?? {}) as Record<string, unknown>;
    if (requiresNew(schema, attributes) && (line.condition ?? input.condition) !== "NEW") {
      fieldErrors[`items.${index}.condition`] = `Only new ${itemById.get(line.requestItemId)!.name.toLowerCase()} can be accepted.`;
    }
    const result = validateAttributes({ fields: donorFieldsFor(schema, attributes) }, line.variant ?? {});
    if (!result.ok) {
      for (const [k, v] of Object.entries(result.errors)) fieldErrors[`items.${index}.variant.${k}`] = v;
      return {};
    }
    return line.condition ? { condition: CONDITION_LABELS[line.condition], ...result.attributes } : result.attributes;
  });
  if (Object.keys(fieldErrors).length) throw new AppError("VALIDATION_FAILED", "Some item details need attention.", { fields: fieldErrors });
  const itemConditions = input.items.map((l) => l.condition).filter((c) => c !== undefined);
  const condition = itemConditions.length ? leastNew(itemConditions) : input.condition;

  const estimatedValue = input.items.reduce((sum, l) => sum + l.quantity * (itemById.get(l.requestItemId)!.estimatedUnitValue ?? 0), 0) || null;
  const expectedBy = request.neededBy ?? new Date(Date.now() + 7 * 86_400_000);

  const result = await withUniqueRetry(() =>
    db.$transaction(
      async (tx) => {
        for (const line of input.items) {
          const updated = await tx.$executeRaw`
            UPDATE "request_items"
               SET "quantityCommitted" = "quantityCommitted" + ${line.quantity}
             WHERE "id" = ${line.requestItemId}::uuid
               AND "requestId" = ${request.id}::uuid
               AND "quantityCommitted" + ${line.quantity} <= "quantityRequired"`;
          if (updated !== 1) {
            const current = await tx.requestItem.findUnique({
              where: { id: line.requestItemId },
              select: { name: true, quantityRequired: true, quantityCommitted: true },
            });
            const left = current ? current.quantityRequired - current.quantityCommitted : 0;
            throw new AppError(
              "INSUFFICIENT_QUANTITY",
              left > 0
                ? `Only ${left} more ${current!.name.toLowerCase()} ${left === 1 ? "is" : "are"} needed now — someone just donated. Please adjust the quantity.`
                : `${current?.name ?? "This item"} has just been fully committed by another donor.`,
              { requestItemId: line.requestItemId, remaining: left },
            );
          }
        }

        const donation = await tx.donation.create({
          data: {
            publicId: generatePublicId("donation"),
            donorId: actor.id,
            requestId: request.id,
            organizationId: request.organizationId,
            status: "CONFIRMED",
            deliveryMethod: input.deliveryMethod,
            condition,
            groupType: input.groupType,
            description: input.description ?? null,
            estimatedValue,
            expectedBy,
            items: {
              create: input.items.map((l, index) => ({ requestItemId: l.requestItemId, quantity: l.quantity, variant: variants[index]! })),
            },
            events: {
              create: [
                { status: "CREATED", actorRole: "DONOR" },
                { status: "CONFIRMED", actorRole: "ADMIN", note: "Automatically confirmed — quantities reserved." },
              ],
            },
            delivery: {
              create: {
                status: "UNASSIGNED",
                private:
                  input.pickupAddress || input.pickupPhone
                    ? {
                        create: {
                          pickupAddressEnc: input.pickupAddress ? encrypt(input.pickupAddress) : null,
                          pickupPhoneEnc: input.pickupPhone ? encrypt(input.pickupPhone) : null,
                        },
                      }
                    : undefined,
              },
            },
          },
          select: { id: true, publicId: true },
        });
        await tx.request.update({ where: { id: request.id }, data: { popularity: { increment: 3 } } });
        const progress = await refreshRequestProgress(tx, request.id);
        return { donation, progress };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted, timeout: 15_000 },
    ),
  );

  publishRequestProgress(result.progress.event);
  const lines = input.items.map((l) => ({ quantity: l.quantity, name: itemById.get(l.requestItemId)!.name }));
  await Promise.all([
    notify(actor.id, templates.donationCreatedDonor(result.donation.publicId), { email: true }),
    notify(request.organization.userId, templates.donationCommittedRecipient(request.publicId, lines), { email: true }),
    result.progress.becameFulfilled ? notify(request.organization.userId, templates.requestFulfilled(request.publicId)) : null,
  ]);
  await detectSuspiciousActivity(actor, result.donation.publicId, input, request.items);

  const row = await db.donation.findUniqueOrThrow({ where: { id: result.donation.id }, select: donorDonationSelect });
  return toDonorDonation(row);
}

/**
 * Lightweight fraud heuristics. Flags are sent to admins for review; they
 * never block a legitimate donor automatically.
 */
async function detectSuspiciousActivity(
  actor: SessionUser,
  donationPublicId: string,
  input: CreateDonationInput,
  items: { id: string; quantityRequired: number }[],
) {
  const reasons: string[] = [];
  const hourAgo = new Date(Date.now() - 3600_000);
  const recent = await db.donation.count({ where: { donorId: actor.id, createdAt: { gte: hourAgo } } });
  if (recent > 8) reasons.push(`${recent} donations within an hour`);
  const user = await db.user.findUnique({ where: { id: actor.id }, select: { createdAt: true } });
  const accountAgeMin = user ? (Date.now() - user.createdAt.getTime()) / 60_000 : 0;
  const total = input.items.reduce((s, l) => s + l.quantity, 0);
  const required = items.reduce((s, i) => s + i.quantityRequired, 0);
  if (accountAgeMin < 10 && total >= 50) reasons.push("large commitment from a brand-new account");
  if (required > 20 && total === required) reasons.push("entire request committed in one donation");
  const cancelled = await db.donation.count({ where: { donorId: actor.id, status: "CANCELLED", updatedAt: { gte: new Date(Date.now() - 86_400_000) } } });
  if (cancelled >= 3) reasons.push(`${cancelled} cancellations in 24h`);
  if (reasons.length) await notifyAdmins("DONATION_MANAGEMENT", templates.adminSuspicious(donationPublicId, reasons.join("; ")));
}

// ───────────────────────── Donor side ─────────────────────────

export async function listDonorDonations(actor: SessionUser) {
  if (actor.role !== "DONOR") throw forbidden();
  const rows = await db.donation.findMany({
    where: { donorId: actor.id },
    orderBy: { createdAt: "desc" },
    select: donorDonationSelect,
    take: 200,
  });
  return rows.map(toDonorDonation);
}

export async function getDonorDonation(actor: SessionUser, publicId: string) {
  if (actor.role !== "DONOR") throw forbidden();
  // Ownership is part of the query — someone else's donation is simply "not found".
  const row = await db.donation.findFirst({ where: { publicId, donorId: actor.id }, select: donorDonationSelect });
  if (!row) throw notFound("This donation");
  return toDonorDonation(row);
}

async function releaseQuantities(tx: Tx, donationId: string) {
  const items = await tx.donationItem.findMany({ where: { donationId }, select: { requestItemId: true, quantity: true } });
  for (const item of items) {
    await tx.$executeRaw`
      UPDATE "request_items"
         SET "quantityCommitted" = GREATEST(0, "quantityCommitted" - ${item.quantity})
       WHERE "id" = ${item.requestItemId}::uuid`;
  }
}

async function transition(
  actorRole: Role,
  donation: { id: string; status: DonationStatus; requestId: string },
  to: DonationStatus,
  note?: string,
) {
  return db.$transaction((tx) => applyTransition(tx, actorRole, donation, to, note));
}

/** The body of `transition`, for callers that need it inside a larger transaction. */
async function applyTransition(
  tx: Tx,
  actorRole: Role,
  donation: { id: string; status: DonationStatus; requestId: string },
  to: DonationStatus,
  note?: string,
) {
  if (!canActorTransition(actorRole, donation.status, to)) {
    throw new AppError(
      "CONFLICT",
      `A donation that is "${DONATION_STATUS_LABELS[donation.status].toLowerCase()}" can't be moved to "${DONATION_STATUS_LABELS[to].toLowerCase()}".`,
    );
  }
  // Optimistic guard against concurrent transitions.
  const updated = await tx.donation.updateMany({ where: { id: donation.id, status: donation.status }, data: { status: to } });
  if (updated.count !== 1) throw new AppError("CONFLICT", "This donation was just updated by someone else. Please refresh.");
  await tx.donationEvent.create({ data: { donationId: donation.id, status: to, actorRole, note: note ?? null } });
  let progress = null;
  if (to === "CANCELLED" && holdsQuantity(donation.status)) {
    await releaseQuantities(tx, donation.id);
    progress = await refreshRequestProgress(tx, donation.requestId);
  }
  if (to === "RECEIVED") {
    const items = await tx.donationItem.findMany({ where: { donationId: donation.id }, select: { requestItemId: true, quantity: true } });
    for (const item of items) {
      await tx.$executeRaw`
        UPDATE "request_items"
           SET "quantityReceived" = LEAST("quantityRequired", "quantityReceived" + ${item.quantity})
         WHERE "id" = ${item.requestItemId}::uuid`;
    }
    await tx.delivery.updateMany({ where: { donationId: donation.id, status: { not: "DELIVERED" } }, data: { status: "DELIVERED", deliveredAt: new Date() } });
  }
  return progress;
}

export async function donorUpdateDonation(actor: SessionUser, publicId: string, action: "PREPARING" | "HANDED_OVER" | "CANCEL") {
  if (actor.role !== "DONOR") throw forbidden();
  const donation = await db.donation.findFirst({
    where: { publicId, donorId: actor.id },
    select: { id: true, status: true, requestId: true, organization: { select: { userId: true } } },
  });
  if (!donation) throw notFound("This donation");
  const to: DonationStatus = action === "PREPARING" ? "PREPARING" : action === "HANDED_OVER" ? "IN_TRANSIT" : "CANCELLED";
  const note = action === "HANDED_OVER" ? "Donor confirmed handover." : undefined;
  const progress = await transition("DONOR", donation, to, note);
  if (progress) publishRequestProgress(progress.event);
  if (to === "CANCELLED") await notify(donation.organization.userId, templates.donationCancelledRecipient(publicId));
  else await notify(donation.organization.userId, templates.donationStatusRecipient(publicId, DONATION_STATUS_LABELS[to]));
  return getDonorDonation(actor, publicId);
}

/** Donation statuses in which a donor may add or correct courier tracking. */
const TRACKABLE: DonationStatus[] = ["CONFIRMED", "PREPARING", "IN_TRANSIT"];

/**
 * The donor records the courier and tracking number for a courier donation.
 * Adding it marks the donation as sent (in transit); later saves correct it.
 */
export async function donorSetTracking(actor: SessionUser, publicId: string, input: CourierTrackingInput) {
  if (actor.role !== "DONOR") throw forbidden();
  const donation = await db.donation.findFirst({
    where: { publicId, donorId: actor.id },
    select: { id: true, status: true, requestId: true, deliveryMethod: true, organization: { select: { userId: true } }, delivery: { select: { trackingNumber: true } } },
  });
  if (!donation) throw notFound("This donation");
  if (donation.deliveryMethod !== "DELIVERY") throw new AppError("CONFLICT", "Courier tracking is only for donations sent by courier.");
  if (!TRACKABLE.includes(donation.status)) throw new AppError("CONFLICT", "Tracking can only be added or changed until the items are received.");

  const courier = findCourier(input.courier);
  const courierName = courier?.name ?? input.courierName!;
  const tracking = { courier: input.courier, courierName: courier ? null : courierName, trackingNumber: input.trackingNumber, trackingAddedAt: new Date() };
  const updated = !!donation.delivery?.trackingNumber;
  await db.$transaction(async (tx) => {
    // Only while the donation is still in a trackable state — it may have changed since it was read.
    const saved = await tx.delivery.updateMany({ where: { donationId: donation.id, donation: { status: { in: TRACKABLE } } }, data: tracking });
    if (saved.count === 0) {
      const exists = await tx.delivery.count({ where: { donationId: donation.id } });
      if (exists) throw new AppError("CONFLICT", "This donation was just updated by someone else. Please refresh.");
      await tx.delivery.create({ data: { donationId: donation.id, ...tracking } });
    }
    // The courier has it now — but never undo a delivered/failed outcome an admin recorded.
    await tx.delivery.updateMany({ where: { donationId: donation.id, status: { in: ["UNASSIGNED", "SCHEDULED"] } }, data: { status: "PICKED_UP" } });
    if (donation.status !== "IN_TRANSIT") await applyTransition(tx, "DONOR", donation, "IN_TRANSIT", `Sent by ${courierName}.`);
  });
  await notify(donation.organization.userId, templates.donationShippedRecipient(publicId, courierName, updated));
  return getDonorDonation(actor, publicId);
}

// ───────────────────────── Recipient side ─────────────────────────

export async function listRecipientDonations(actor: SessionUser, requestPublicId?: string) {
  if (actor.role !== "RECIPIENT" || !actor.organizationId) throw forbidden();
  const rows = await db.donation.findMany({
    where: { organizationId: actor.organizationId, ...(requestPublicId ? { request: { publicId: requestPublicId } } : {}) },
    orderBy: { createdAt: "desc" },
    select: recipientDonationSelect,
    take: 300,
  });
  return rows.map(toRecipientDonation);
}

export async function recipientConfirmReceipt(actor: SessionUser, publicId: string) {
  if (actor.role !== "RECIPIENT" || !actor.organizationId) throw forbidden();
  const donation = await db.donation.findFirst({
    where: { publicId, organizationId: actor.organizationId },
    select: { id: true, status: true, requestId: true, donorId: true },
  });
  if (!donation) throw notFound("This donation");
  await transition("RECIPIENT", donation, "RECEIVED", "Recipient confirmed receipt.");
  await notify(donation.donorId, templates.donationReceivedDonor(publicId), { email: true });
  const row = await db.donation.findUniqueOrThrow({ where: { id: donation.id }, select: recipientDonationSelect });
  return toRecipientDonation(row);
}

// ───────────────────────── Admin side ─────────────────────────

export async function adminUpdateDonationStatus(actor: SessionUser, donationId: string, to: DonationStatus, note?: string, ip?: string) {
  const donation = await db.donation.findUnique({
    where: { id: donationId },
    select: { id: true, publicId: true, status: true, requestId: true, donorId: true, organization: { select: { userId: true } } },
  });
  if (!donation) throw notFound("This donation");
  const progress = await transition(actor.role, donation, to, note);
  if (progress) publishRequestProgress(progress.event);
  await audit(actor, "DONATION_STATUS_CHANGED", { type: "donation", id: donation.publicId }, { from: donation.status, to }, ip);
  const label = DONATION_STATUS_LABELS[to];
  await Promise.all([
    notify(donation.donorId, to === "RECEIVED" ? templates.donationReceivedDonor(donation.publicId) : templates.donationStatusDonor(donation.publicId, label)),
    notify(donation.organization.userId, templates.donationStatusRecipient(donation.publicId, label)),
  ]);
}

/** Personal impact for a donor — aggregate only. */
export async function donorImpact(actor: SessionUser) {
  const donations = await db.donation.findMany({
    where: { donorId: actor.id, status: { not: "CANCELLED" } },
    select: {
      requestId: true,
      organizationId: true,
      request: { select: { category: { select: { slug: true, name: true } } } },
      items: { select: { quantity: true } },
    },
  });
  const items = donations.reduce((s, d) => s + d.items.reduce((a, i) => a + i.quantity, 0), 0);
  const requests = new Set(donations.map((d) => d.requestId)).size;
  const organizations = new Set(donations.map((d) => d.organizationId)).size;
  const byCategory: Record<string, number> = {};
  for (const d of donations) byCategory[d.request.category.name] = (byCategory[d.request.category.name] ?? 0) + 1;

  const milestones = [
    { key: "first", label: "First Contribution", achieved: donations.length >= 1 },
    { key: "helper", label: "Community Helper", achieved: donations.length >= 5 },
    { key: "ten", label: "10 Needs Supported", achieved: requests >= 10 },
    { key: "education", label: "Education Supporter", achieved: donations.some((d) => d.request.category.slug === "education") },
  ];
  return { donations: donations.length, items, requests, organizations, byCategory, milestones };
}
