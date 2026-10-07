import "server-only";
import type { DonationStatus, Permission, Prisma, ReportStatus, RequestStatus, Role } from "@prisma/client";
import { db } from "@/lib/db";
import { decrypt, decryptOptional, encrypt } from "@/lib/crypto";
import { AppError, forbidden, notFound } from "@/lib/errors";
import { audit } from "@/lib/audit";
import { canAssignRole, canManageUser, DEFAULT_ADMIN_PERMISSIONS, hasPermission, SUPER_ADMIN_ONLY } from "@/lib/permissions";
import { hashPassword } from "@/lib/auth/password";
import { destroyAllSessionsForUser, type SessionUser } from "@/lib/auth/session";
import { generatePublicId, withUniqueRetry } from "@/lib/ids";
import { detectPii } from "@/lib/pii-guard";
import { mask } from "@/lib/notifications/channels";
import { templates } from "@/lib/notifications/templates";
import { deletePrivateObject } from "@/lib/storage";
import { suggestPriority } from "@/lib/priority";
import type { z } from "zod";
import type { categoryUpsertSchema, createAdminSchema, deliveryUpdateSchema, requestDecisionSchema, userUpdateSchema } from "@/lib/validation/admin";
import { notify } from "./notifications";
import { requestPasswordReset } from "./auth";
import { findPossibleDuplicates } from "./requests";
import { getSettings } from "./settings";

const DAY = 86_400_000;

// ───────────────────────── Dashboard & analytics ─────────────────────────

export async function dashboardStats() {
  const [totalDonors, verifiedRecipients, activeRequests, delivered, pendingVerification, pendingRequests, activeDonations, completedDonations, openReports] =
    await Promise.all([
      db.user.count({ where: { role: "DONOR" } }),
      db.recipientOrganization.count({ where: { verificationStatus: "VERIFIED" } }),
      db.request.count({ where: { status: "ACTIVE" } }),
      db.donationItem.aggregate({ _sum: { quantity: true }, where: { donation: { status: { in: ["RECEIVED", "COMPLETED"] } } } }),
      db.recipientOrganization.count({ where: { verificationStatus: { in: ["PENDING", "UNDER_REVIEW"] } } }),
      db.request.count({ where: { status: "PENDING_VERIFICATION" } }),
      db.donation.count({ where: { status: { in: ["CREATED", "CONFIRMED", "PREPARING", "IN_TRANSIT"] } } }),
      db.donation.count({ where: { status: { in: ["RECEIVED", "COMPLETED"] } } }),
      db.report.count({ where: { status: { in: ["OPEN", "INVESTIGATING"] } } }),
    ]);
  return {
    totalDonors,
    verifiedRecipients,
    activeRequests,
    itemsDelivered: delivered._sum.quantity ?? 0,
    pendingVerification,
    pendingRequests,
    activeDonations,
    completedDonations,
    openReports,
  };
}

function monthKey(d: Date) {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export async function analytics(months = 6) {
  const since = new Date();
  since.setUTCDate(1);
  since.setUTCHours(0, 0, 0, 0);
  since.setUTCMonth(since.getUTCMonth() - (months - 1));

  const [donations, requestsByStatus, categories, activeByDistrict, donors, orgStats] = await Promise.all([
    db.donation.findMany({
      where: { createdAt: { gte: since } },
      select: {
        createdAt: true,
        status: true,
        donorId: true,
        organizationId: true,
        items: { select: { quantity: true } },
        request: { select: { district: true, peopleAffected: true, category: { select: { slug: true, name: true } } } },
      },
    }),
    db.request.groupBy({ by: ["status"], _count: true }),
    db.category.findMany({ select: { slug: true, name: true, icon: true } }),
    db.request.groupBy({ by: ["district"], where: { status: { in: ["ACTIVE", "FULFILLED"] } }, _count: true }),
    db.user.findMany({ where: { role: "DONOR" }, select: { createdAt: true, _count: { select: { donations: true } } } }),
    db.recipientOrganization.groupBy({ by: ["verificationStatus"], _count: true }),
  ]);

  // Donations over time (monthly)
  const series: { month: string; donations: number; items: number }[] = [];
  for (let i = 0; i < months; i++) {
    const d = new Date(since);
    d.setUTCMonth(since.getUTCMonth() + i);
    series.push({ month: monthKey(d), donations: 0, items: 0 });
  }
  const live = donations.filter((d) => d.status !== "CANCELLED");
  for (const d of live) {
    const bucket = series.find((s) => s.month === monthKey(d.createdAt));
    if (bucket) {
      bucket.donations += 1;
      bucket.items += d.items.reduce((s, i) => s + i.quantity, 0);
    }
  }

  // By category
  const byCategory = categories
    .map((c) => ({
      slug: c.slug,
      name: c.name,
      icon: c.icon,
      items: live.filter((d) => d.request.category.slug === c.slug).reduce((s, d) => s + d.items.reduce((a, i) => a + i.quantity, 0), 0),
    }))
    .filter((c) => c.items > 0)
    .sort((a, b) => b.items - a.items);

  const statusCounts = Object.fromEntries(requestsByStatus.map((r) => [r.status, r._count])) as Partial<Record<RequestStatus, number>>;
  const approvedTotal = (statusCounts.ACTIVE ?? 0) + (statusCounts.FULFILLED ?? 0) + (statusCounts.CLOSED ?? 0);
  const fulfillmentRate = approvedTotal ? Math.round(((statusCounts.FULFILLED ?? 0) / approvedTotal) * 100) : 0;

  // Monthly impact (current month)
  const thisMonth = monthKey(new Date());
  const monthDonations = live.filter((d) => monthKey(d.createdAt) === thisMonth);
  const sumItems = (list: typeof live, slugs?: string[]) =>
    list.filter((d) => !slugs || slugs.includes(d.request.category.slug)).reduce((s, d) => s + d.items.reduce((a, i) => a + i.quantity, 0), 0);

  const repeatDonors = donors.filter((d) => d._count.donations > 1).length;
  const newDonors30 = donors.filter((d) => d.createdAt.getTime() > Date.now() - 30 * DAY).length;
  const orgCounts = Object.fromEntries(orgStats.map((o) => [o.verificationStatus, o._count])) as Record<string, number>;
  const orgTotal = Object.values(orgCounts).reduce((s, n) => s + n, 0);

  return {
    series,
    byCategory,
    requestsByStatus: statusCounts,
    geographic: activeByDistrict.map((g) => ({ district: g.district, requests: g._count })),
    fulfillmentRate,
    monthlyImpact: {
      itemsDonated: sumItems(monthDonations),
      familiesSupported: monthDonations.reduce((s, d) => s + Math.min(d.request.peopleAffected ?? 0, 50), 0),
      organizationsSupported: new Set(monthDonations.map((d) => d.organizationId)).size,
      childrenReached: sumItems(monthDonations, ["education", "children"]),
      mealsProvided: sumItems(monthDonations, ["food"]),
    },
    donors: {
      total: donors.length,
      newLast30Days: newDonors30,
      returning: repeatDonors,
      averageItemsPerDonation: live.length ? Math.round((sumItems(live) / live.length) * 10) / 10 : 0,
    },
    recipients: {
      total: orgTotal,
      verificationRate: orgTotal ? Math.round(((orgCounts.VERIFIED ?? 0) / orgTotal) * 100) : 0,
      requestsSubmitted: Object.values(statusCounts).reduce((s, n) => s + (n ?? 0), 0),
    },
  };
}

export async function recentActivity(limit = 8) {
  const rows = await db.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    select: { id: true, actorLabel: true, action: true, targetType: true, targetId: true, createdAt: true },
  });
  return rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() }));
}

// ───────────────────────── Request moderation ─────────────────────────

export async function listRequestsForModeration(status?: RequestStatus, page = 1) {
  const where: Prisma.RequestWhereInput = status ? { status } : {};
  const [rows, total] = await Promise.all([
    db.request.findMany({
      where,
      orderBy: [{ createdAt: "desc" }],
      skip: (page - 1) * 25,
      take: 25,
      select: {
        id: true,
        publicId: true,
        title: true,
        status: true,
        priority: true,
        district: true,
        percentFulfilled: true,
        createdAt: true,
        recurrence: true,
        category: { select: { name: true, icon: true } },
        organization: { select: { publicId: true, verificationStatus: true } },
        _count: { select: { reports: true, donations: true } },
      },
    }),
    db.request.count({ where }),
  ]);
  return { rows: rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() })), total, pageCount: Math.max(1, Math.ceil(total / 25)) };
}

/** Moderation view — organisation identity stays "[private]" here. */
export async function getModerationDetail(requestId: string) {
  const r = await db.request.findUnique({
    where: { id: requestId },
    select: {
      id: true,
      publicId: true,
      title: true,
      description: true,
      status: true,
      priority: true,
      priorityScore: true,
      peopleAffected: true,
      neededBy: true,
      district: true,
      city: true,
      recurrence: true,
      donationTypes: true,
      deliveryMethods: true,
      adminNote: true,
      rejectionReason: true,
      createdAt: true,
      organizationId: true,
      categoryId: true,
      category: { select: { name: true, icon: true } },
      organization: { select: { publicId: true, publicDescriptor: true, verificationStatus: true, _count: { select: { documents: true } } } },
      items: { orderBy: { sortOrder: "asc" }, select: { id: true, name: true, unit: true, quantityRequired: true, quantityCommitted: true, attributes: true } },
      reports: { orderBy: { createdAt: "desc" }, select: { id: true, reason: true, details: true, status: true, createdAt: true } },
    },
  });
  if (!r) throw notFound("This request");
  const duplicates = await findPossibleDuplicates(r.organizationId, r.categoryId, r.items.map((i) => i.name), r.id);
  const totalQty = r.items.reduce((s, i) => s + i.quantityRequired, 0);
  const remainingFraction = totalQty ? r.items.reduce((s, i) => s + i.quantityRequired - i.quantityCommitted, 0) / totalQty : 0;
  const suggestion = suggestPriority({
    statedUrgency: r.priority,
    neededBy: r.neededBy,
    peopleAffected: r.peopleAffected,
    remainingFraction,
    verified: r.organization.verificationStatus === "VERIFIED",
  });
  const quality = {
    organizationVerified: r.organization.verificationStatus === "VERIFIED",
    descriptionComplete: r.description.length >= 60,
    quantityReasonable: r.items.every((i) => i.quantityRequired <= 500),
    documentsPresent: r.organization._count.documents > 0,
    noContactDetails: detectPii(`${r.title} ${r.description}`).length === 0,
    noDuplicates: duplicates.length === 0,
  };
  return {
    ...r,
    organizationId: undefined,
    categoryId: undefined,
    neededBy: r.neededBy?.toISOString() ?? null,
    createdAt: r.createdAt.toISOString(),
    reports: r.reports.map((x) => ({ ...x, createdAt: x.createdAt.toISOString() })),
    duplicates,
    quality,
    suggestion,
  };
}

export async function decideRequest(actor: SessionUser, requestId: string, input: z.infer<typeof requestDecisionSchema>, ip?: string) {
  const r = await db.request.findUnique({
    where: { id: requestId },
    select: { id: true, publicId: true, status: true, organization: { select: { userId: true, verificationStatus: true } } },
  });
  if (!r) throw notFound("This request");
  const ownerId = r.organization.userId;

  switch (input.decision) {
    case "APPROVE": {
      if (r.organization.verificationStatus !== "VERIFIED") {
        throw new AppError("CONFLICT", "Verify the organisation before approving its requests.");
      }
      if (!["PENDING_VERIFICATION", "NEEDS_INFO", "DRAFT"].includes(r.status)) throw new AppError("CONFLICT", "This request has already been reviewed.");
      await db.request.update({
        where: { id: r.id },
        data: { status: "ACTIVE", approvedAt: new Date(), priority: input.priority ?? undefined, adminNote: input.note ?? null, rejectionReason: null },
      });
      await audit(actor, "REQUEST_APPROVED", { type: "request", id: r.publicId }, { priority: input.priority ?? null }, ip);
      await notify(ownerId, templates.requestApproved(r.publicId), { email: true });
      break;
    }
    case "REJECT":
      await db.request.update({ where: { id: r.id }, data: { status: "REJECTED", rejectionReason: input.reason } });
      await audit(actor, "REQUEST_REJECTED", { type: "request", id: r.publicId }, {}, ip);
      await notify(ownerId, templates.requestRejected(r.publicId), { email: true });
      break;
    case "REQUEST_INFO":
      await db.request.update({ where: { id: r.id }, data: { status: "NEEDS_INFO", adminNote: input.note } });
      await audit(actor, "REQUEST_INFO_REQUESTED", { type: "request", id: r.publicId }, {}, ip);
      await notify(ownerId, templates.requestNeedsInfo(r.publicId), { email: true });
      break;
    case "SET_PRIORITY":
      await db.request.update({ where: { id: r.id }, data: { priority: input.priority } });
      await audit(actor, "REQUEST_PRIORITY_CHANGED", { type: "request", id: r.publicId }, { priority: input.priority }, ip);
      break;
    case "CLOSE":
      await db.request.update({ where: { id: r.id }, data: { status: "CLOSED", adminNote: input.note ?? undefined } });
      await audit(actor, "REQUEST_CLOSED", { type: "request", id: r.publicId }, {}, ip);
      break;
  }
}

export async function listReports(status?: ReportStatus) {
  const rows = await db.report.findMany({
    where: status ? { status } : { status: { in: ["OPEN", "INVESTIGATING"] } },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      reason: true,
      details: true,
      status: true,
      resolution: true,
      createdAt: true,
      request: { select: { id: true, publicId: true, title: true } },
    },
  });
  return rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() }));
}

export async function updateReport(actor: SessionUser, reportId: string, status: ReportStatus, resolution?: string, ip?: string) {
  const report = await db.report.update({
    where: { id: reportId },
    data: { status, resolution: resolution ?? null, resolvedAt: status === "RESOLVED" || status === "DISMISSED" ? new Date() : null },
    select: { id: true },
  });
  await audit(actor, "REPORT_UPDATED", { type: "report", id: report.id }, { status }, ip);
}

// ───────────────────────── Donations & identity resolution ─────────────────────────

export async function listDonationsAdmin(filters: { status?: DonationStatus; q?: string; page?: number }) {
  const page = Math.max(1, filters.page ?? 1);
  const where: Prisma.DonationWhereInput = {
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.q ? { OR: [{ publicId: { contains: filters.q.toUpperCase() } }, { request: { publicId: { contains: filters.q.toUpperCase() } } }] } : {}),
  };
  const [rows, total] = await Promise.all([
    db.donation.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * 25,
      take: 25,
      select: {
        id: true,
        publicId: true,
        status: true,
        deliveryMethod: true,
        createdAt: true,
        estimatedValue: true,
        donor: { select: { publicId: true } },
        organization: { select: { publicId: true } },
        request: { select: { publicId: true, title: true } },
        items: { select: { quantity: true } },
      },
    }),
    db.donation.count({ where }),
  ]);
  return {
    rows: rows.map((d) => ({ ...d, createdAt: d.createdAt.toISOString(), quantity: d.items.reduce((s, i) => s + i.quantity, 0) })),
    total,
    pageCount: Math.max(1, Math.ceil(total / 25)),
  };
}

export async function getDonationAdmin(donationId: string) {
  const d = await db.donation.findUnique({
    where: { id: donationId },
    select: {
      id: true,
      publicId: true,
      status: true,
      type: true,
      deliveryMethod: true,
      condition: true,
      description: true,
      groupType: true,
      estimatedValue: true,
      expectedBy: true,
      createdAt: true,
      donor: { select: { publicId: true } },
      organization: { select: { publicId: true, publicDescriptor: true } },
      request: { select: { publicId: true, title: true, district: true } },
      items: { select: { quantity: true, variant: true, requestItem: { select: { name: true, unit: true } } } },
      events: { orderBy: { createdAt: "asc" }, select: { status: true, actorRole: true, note: true, createdAt: true } },
      delivery: { select: { status: true, assigneeLabel: true, pickupScheduledAt: true, deliveredAt: true, courier: true, courierName: true, trackingNumber: true, trackingAddedAt: true } },
    },
  });
  if (!d) throw notFound("This donation");
  return {
    ...d,
    createdAt: d.createdAt.toISOString(),
    expectedBy: d.expectedBy?.toISOString() ?? null,
    events: d.events.map((e) => ({ ...e, createdAt: e.createdAt.toISOString() })),
  };
}

/**
 * The ONLY code path that resolves donor ↔ recipient identities.
 * Requires VIEW_PRIVATE_IDENTITY and writes an audit record before returning.
 */
export async function getDonationIdentity(actor: SessionUser, donationId: string, ip?: string) {
  if (!hasPermission(actor, "VIEW_PRIVATE_IDENTITY")) {
    throw new AppError("FORBIDDEN", "Viewing private identities requires the VIEW_PRIVATE_IDENTITY permission.");
  }
  const d = await db.donation.findUnique({
    where: { id: donationId },
    select: {
      publicId: true,
      donor: { select: { publicId: true, email: true, private: true } },
      organization: { select: { publicId: true, private: true, user: { select: { email: true } } } },
    },
  });
  if (!d) throw notFound("This donation");
  // The target is the donation; the donor↔recipient pair is deliberately not
  // copied into the audit trail (audit readers may lack identity permission).
  await audit(actor, "VIEW_PRIVATE_IDENTITY", { type: "donation", id: d.publicId }, { context: "donation_identity" }, ip);
  const dp = d.donor.private;
  const op = d.organization.private;
  return {
    donation: d.publicId,
    donor: {
      ref: d.donor.publicId,
      name: dp ? decrypt(dp.fullNameEnc) : null,
      email: d.donor.email,
      phone: decryptOptional(dp?.phoneEnc),
    },
    recipient: {
      ref: d.organization.publicId,
      organization: op ? decrypt(op.legalNameEnc) : null,
      contactPerson: op ? decrypt(op.contactPersonEnc) : null,
      phone: op ? decrypt(op.phoneEnc) : null,
      address: op ? decrypt(op.addressEnc) : null,
      email: d.organization.user.email,
    },
  };
}

// ───────────────────────── Deliveries (least privilege) ─────────────────────────

export async function listDeliveries(status?: string) {
  const rows = await db.delivery.findMany({
    where: status ? { status: status as never } : { status: { not: "DELIVERED" } },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      status: true,
      assigneeLabel: true,
      pickupScheduledAt: true,
      deliveredAt: true,
      notes: true,
      proofNote: true,
      createdAt: true,
      courier: true,
      courierName: true,
      trackingNumber: true,
      trackingAddedAt: true,
      donation: {
        select: {
          publicId: true,
          status: true,
          deliveryMethod: true,
          request: { select: { publicId: true, district: true } },
          items: { select: { quantity: true, requestItem: { select: { name: true } } } },
        },
      },
    },
  });
  return rows.map((r) => ({
    ...r,
    createdAt: r.createdAt.toISOString(),
    pickupScheduledAt: r.pickupScheduledAt?.toISOString() ?? null,
    deliveredAt: r.deliveredAt?.toISOString() ?? null,
  }));
}

/**
 * Logistics packet for ONE leg of the journey (donor → platform hub, or
 * platform hub → recipient). Each leg contains only the addresses needed for
 * that leg — no names, emails or account references — so a single packet
 * never links a donor's location to a recipient's (least privilege).
 */
export async function getDeliveryPacket(actor: SessionUser, deliveryId: string, leg: "pickup" | "dropoff", ip?: string) {
  const d = await db.delivery.findUnique({
    where: { id: deliveryId },
    select: {
      id: true,
      private: true,
      donation: {
        select: {
          publicId: true,
          deliveryMethod: true,
          items: { select: { quantity: true, requestItem: { select: { name: true, unit: true } } } },
          organization: { select: { district: true, city: true, private: { select: { addressEnc: true, pinCodeEnc: true, phoneEnc: true } } } },
        },
      },
    },
  });
  if (!d) throw notFound("This delivery");
  await audit(actor, "VIEW_DELIVERY_DETAILS", { type: "donation", id: d.donation.publicId }, { leg }, ip);
  const op = d.donation.organization.private;
  const base = {
    donation: d.donation.publicId,
    leg,
    method: d.donation.deliveryMethod,
    items: d.donation.items.map((i) => `${i.quantity} ${i.requestItem.unit} × ${i.requestItem.name}`),
  };
  if (leg === "pickup") {
    return { ...base, from: { address: decryptOptional(d.private?.pickupAddressEnc), phone: decryptOptional(d.private?.pickupPhoneEnc) }, to: { address: "Platform hub" } };
  }
  return {
    ...base,
    from: { address: "Platform hub" },
    to: {
      address: op ? decrypt(op.addressEnc) : null,
      pinCode: decryptOptional(op?.pinCodeEnc),
      area: [d.donation.organization.city, d.donation.organization.district].filter(Boolean).join(", "),
      phone: op ? decrypt(op.phoneEnc) : null,
    },
  };
}

export async function updateDelivery(actor: SessionUser, deliveryId: string, input: z.infer<typeof deliveryUpdateSchema>, ip?: string) {
  const delivery = await db.delivery.findUnique({ where: { id: deliveryId }, select: { id: true, donation: { select: { id: true, publicId: true, status: true } } } });
  if (!delivery) throw notFound("This delivery");
  await db.delivery.update({
    where: { id: deliveryId },
    data: {
      status: input.status,
      pickupScheduledAt: input.pickupScheduledAt,
      assigneeLabel: input.assigneeLabel,
      notes: input.notes,
      proofNote: input.proofNote,
      deliveredAt: input.status === "DELIVERED" ? new Date() : undefined,
    },
  });
  await audit(actor, "DELIVERY_UPDATED", { type: "donation", id: delivery.donation.publicId }, { status: input.status }, ip);
  return { donationId: delivery.donation.id, donationStatus: delivery.donation.status };
}

// ───────────────────────── Users & roles ─────────────────────────

/**
 * User table. Searching by email, and seeing (masked) emails, are identity
 * lookups — they require VIEW_PRIVATE_IDENTITY. Otherwise an admin holding
 * only USER_MANAGEMENT + DONATION_MANAGEMENT could go email → reference →
 * donations → recipient and link a donor to a recipient without the
 * identity permission.
 */
export async function listUsers(viewer: SessionUser, filters: { role?: Role; status?: string; q?: string; page?: number }) {
  const page = Math.max(1, filters.page ?? 1);
  const canSeeIdentity = hasPermission(viewer, "VIEW_PRIVATE_IDENTITY");
  const q = filters.q?.trim();
  const where: Prisma.UserWhereInput = {
    ...(filters.role ? { role: filters.role } : {}),
    ...(filters.status ? { status: filters.status as never } : {}),
    ...(q
      ? canSeeIdentity
        ? { OR: [{ publicId: { contains: q.toUpperCase() } }, { email: { contains: q.toLowerCase() } }] }
        : { publicId: { contains: q.toUpperCase() } }
      : {}),
  };
  const [rows, total] = await Promise.all([
    db.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * 25,
      take: 25,
      select: {
        id: true,
        publicId: true,
        email: true,
        role: true,
        status: true,
        permissions: true,
        emailVerifiedAt: true,
        createdAt: true,
        lastLoginAt: true,
        organization: { select: { verificationStatus: true } },
      },
    }),
    db.user.count({ where }),
  ]);
  return {
    // Even masked emails are shown only to identity-permitted admins.
    rows: rows.map((u) => ({
      id: u.id,
      publicId: u.publicId,
      emailMasked: canSeeIdentity ? mask(u.email) : null,
      role: u.role,
      status: u.status,
      permissions: u.permissions,
      verification: u.organization?.verificationStatus ?? (u.emailVerifiedAt ? "EMAIL_VERIFIED" : "UNVERIFIED"),
      createdAt: u.createdAt.toISOString(),
      lastLoginAt: u.lastLoginAt?.toISOString() ?? null,
    })),
    total,
    pageCount: Math.max(1, Math.ceil(total / 25)),
  };
}

export async function userActivity(userId: string) {
  const rows = await db.auditLog.findMany({
    where: { actorId: userId },
    orderBy: { createdAt: "desc" },
    take: 30,
    select: { id: true, action: true, targetType: true, targetId: true, createdAt: true },
  });
  return rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() }));
}

export async function updateUser(actor: SessionUser, targetId: string, input: z.infer<typeof userUpdateSchema>, ip?: string) {
  if (targetId === actor.id && (input.role || input.status || input.permissions)) {
    throw forbidden("You can't change your own role, status or permissions.");
  }
  const target = await db.user.findUnique({
    where: { id: targetId },
    select: { id: true, publicId: true, email: true, role: true, permissions: true, organization: { select: { id: true } }, donorProfile: { select: { userId: true } } },
  });
  if (!target) throw notFound("This user");
  if (!canManageUser(actor, target.role)) throw forbidden("Only a super admin can manage administrator accounts.");

  if (input.status) {
    await db.user.update({ where: { id: target.id }, data: { status: input.status } });
    if (input.status !== "ACTIVE") await destroyAllSessionsForUser(target.id);
    if (target.organization && input.status === "SUSPENDED") {
      await db.recipientOrganization.update({ where: { id: target.organization.id }, data: { verificationStatus: "SUSPENDED" } });
    }
    await audit(actor, "USER_STATUS_CHANGED", { type: "user", id: target.publicId }, { status: input.status, reason: input.reason ?? null }, ip);
  }

  if (input.role && input.role !== target.role) {
    if (!canAssignRole(actor, input.role)) throw forbidden("You don't have permission to assign this role.");
    if (input.role === "RECIPIENT" && !target.organization) {
      throw new AppError("CONFLICT", "This account has no organisation profile. Ask the user to register as a recipient organisation.");
    }
    await db.user.update({
      where: { id: target.id },
      data: {
        role: input.role,
        permissions: input.role === "ADMIN" ? DEFAULT_ADMIN_PERMISSIONS : input.role === "SUPER_ADMIN" ? [] : [],
      },
    });
    if (input.role === "DONOR" && !target.donorProfile) await db.donorProfile.create({ data: { userId: target.id } });
    await destroyAllSessionsForUser(target.id);
    await audit(actor, "USER_ROLE_CHANGED", { type: "user", id: target.publicId }, { from: target.role, to: input.role }, ip);
  }

  if (input.permissions) {
    if (actor.role !== "SUPER_ADMIN") throw forbidden("Only a super admin can change administrator permissions.");
    const role = input.role ?? target.role;
    if (role !== "ADMIN") throw new AppError("CONFLICT", "Permissions apply to administrator accounts only.");
    const permissions = [...new Set(input.permissions.filter((p) => !SUPER_ADMIN_ONLY.includes(p)))] as Permission[];
    await db.user.update({ where: { id: target.id }, data: { permissions } });
    await audit(actor, "USER_PERMISSIONS_CHANGED", { type: "user", id: target.publicId }, { permissions }, ip);
  }

  if (input.resetAccess) {
    await destroyAllSessionsForUser(target.id);
    await requestPasswordReset(target.email);
    await audit(actor, "USER_ACCESS_RESET", { type: "user", id: target.publicId }, {}, ip);
  }
}

export async function createAdmin(actor: SessionUser, input: z.infer<typeof createAdminSchema>, ip?: string) {
  if (actor.role !== "SUPER_ADMIN") throw forbidden("Only a super admin can create administrators.");
  const exists = await db.user.findUnique({ where: { email: input.email }, select: { id: true } });
  if (exists) throw new AppError("CONFLICT", "An account with this email already exists.");
  const permissions = input.role === "ADMIN" ? input.permissions.filter((p) => !SUPER_ADMIN_ONLY.includes(p)) : [];
  const user = await withUniqueRetry(async () =>
    db.user.create({
      data: {
        publicId: generatePublicId("admin"),
        email: input.email,
        emailVerifiedAt: new Date(),
        passwordHash: await hashPassword(input.password),
        role: input.role,
        permissions: permissions.length ? permissions : input.role === "ADMIN" ? DEFAULT_ADMIN_PERMISSIONS : [],
        private: { create: { fullNameEnc: encrypt(input.fullName) } },
      },
      select: { id: true, publicId: true },
    }),
  );
  await audit(actor, "ADMIN_CREATED", { type: "user", id: user.publicId }, { role: input.role }, ip);
  return user;
}

export async function resolveUserIdentity(actor: SessionUser, userId: string, ip?: string) {
  if (!hasPermission(actor, "VIEW_PRIVATE_IDENTITY")) throw forbidden("Viewing private identities requires the VIEW_PRIVATE_IDENTITY permission.");
  const u = await db.user.findUnique({ where: { id: userId }, select: { publicId: true, email: true, private: true } });
  if (!u) throw notFound("This user");
  await audit(actor, "VIEW_PRIVATE_IDENTITY", { type: "user", id: u.publicId }, { context: "user_management" }, ip);
  return {
    ref: u.publicId,
    name: u.private ? decrypt(u.private.fullNameEnc) : null,
    email: u.email,
    phone: decryptOptional(u.private?.phoneEnc),
  };
}

// ───────────────────────── Audit, categories, export, retention ─────────────────────────

export async function listAuditLogs(filters: { action?: string; page?: number }) {
  const page = Math.max(1, filters.page ?? 1);
  const where: Prisma.AuditLogWhereInput = filters.action ? { action: filters.action } : {};
  const [rows, total] = await Promise.all([
    db.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * 40,
      take: 40,
      select: { id: true, actorLabel: true, action: true, targetType: true, targetId: true, metadata: true, ipEnc: true, createdAt: true },
    }),
    db.auditLog.count({ where }),
  ]);
  return {
    rows: rows.map((r) => ({
      id: r.id,
      actorLabel: r.actorLabel,
      action: r.action,
      targetType: r.targetType,
      targetId: r.targetId,
      metadata: r.metadata,
      ipStored: Boolean(r.ipEnc),
      createdAt: r.createdAt.toISOString(),
    })),
    total,
    pageCount: Math.max(1, Math.ceil(total / 40)),
  };
}

export async function upsertCategory(actor: SessionUser, input: z.infer<typeof categoryUpsertSchema>, ip?: string) {
  const data = { ...input, description: input.description ?? null, fieldSchema: input.fieldSchema as Prisma.InputJsonObject };
  const category = await db.category.upsert({ where: { slug: input.slug }, create: data, update: data, select: { id: true, slug: true } });
  await audit(actor, "CATEGORY_CHANGED", { type: "category", id: category.slug }, { isActive: input.isActive }, ip);
  return category;
}

/** Operational export without PII. Identity data is never included in exports. */
export async function exportData(actor: SessionUser, ip?: string) {
  if (actor.role !== "SUPER_ADMIN") throw forbidden("Only a super admin can export data.");
  const [categories, requests, donations, organizations] = await Promise.all([
    db.category.findMany({ select: { slug: true, name: true, icon: true, fieldSchema: true, isActive: true } }),
    db.request.findMany({
      select: {
        publicId: true, title: true, status: true, priority: true, district: true, createdAt: true, approvedAt: true,
        organization: { select: { publicId: true } }, category: { select: { slug: true } },
        items: { select: { name: true, quantityRequired: true, quantityCommitted: true, quantityReceived: true } },
      },
    }),
    db.donation.findMany({
      select: {
        publicId: true, status: true, deliveryMethod: true, createdAt: true,
        request: { select: { publicId: true } }, items: { select: { quantity: true, requestItem: { select: { name: true } } } },
      },
    }),
    db.recipientOrganization.findMany({ select: { publicId: true, orgType: true, district: true, verificationStatus: true, verifiedAt: true } }),
  ]);
  await audit(actor, "DATA_EXPORT", { type: "platform", id: "export" }, { requests: requests.length, donations: donations.length }, ip);
  return { exportedAt: new Date().toISOString(), note: "Operational export — contains no personal data.", categories, organizations, requests, donations };
}

export async function runRetention(actor: SessionUser | null, ip?: string) {
  const settings = await getSettings();
  const now = Date.now();
  const auditCutoff = new Date(now - settings.retention.auditLogDays * DAY);
  const purgedAudit = await db.auditLog.deleteMany({ where: { createdAt: { lt: auditCutoff } } });
  const expiredDocs = await db.verificationDocument.findMany({
    where: { retainUntil: { lt: new Date(now) }, organization: { verificationStatus: { in: ["VERIFIED", "REJECTED"] } } },
    select: { id: true, storageKey: true },
  });
  for (const doc of expiredDocs) await deletePrivateObject(doc.storageKey);
  await db.verificationDocument.deleteMany({ where: { id: { in: expiredDocs.map((d) => d.id) } } });
  const sessions = await db.session.deleteMany({ where: { expiresAt: { lt: new Date(now) } } });
  const tokens = await db.authToken.deleteMany({ where: { expiresAt: { lt: new Date(now - DAY) } } });
  const result = { auditLogs: purgedAudit.count, documents: expiredDocs.length, sessions: sessions.count, tokens: tokens.count };
  await audit(actor, "RETENTION_PURGE", { type: "platform", id: "retention" }, result, ip);
  return result;
}

/**
 * Self-service account deletion: PII is erased, the login is disabled, and
 * anonymous donation records are kept so recipients' histories stay intact.
 */
export async function deleteOwnAccount(actor: SessionUser) {
  if (actor.role === "ADMIN" || actor.role === "SUPER_ADMIN") throw forbidden("Administrator accounts are removed by a super admin.");
  const active = await db.donation.count({ where: { donorId: actor.id, status: { in: ["CONFIRMED", "PREPARING", "IN_TRANSIT"] } } });
  if (active) throw new AppError("CONFLICT", "Please complete or cancel your active donations before deleting your account.");
  await db.$transaction(async (tx) => {
    await tx.userPrivate.deleteMany({ where: { userId: actor.id } });
    await tx.user.update({
      where: { id: actor.id },
      data: { email: `deleted+${actor.id}@invalid.local`, status: "DISABLED", passwordHash: "!", emailVerifiedAt: null },
    });
    await tx.session.deleteMany({ where: { userId: actor.id } });
  });
}
