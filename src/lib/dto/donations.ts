import "server-only";
import type { Prisma } from "@prisma/client";
import { donorAliasFor } from "../anonymity";
import { donorDisplayName } from "../descriptors";

const timelineSelect = {
  orderBy: { createdAt: "asc" },
  select: { status: true, createdAt: true, note: true, actorRole: true },
} satisfies Prisma.Donation$eventsArgs;

const itemsSelect = {
  select: {
    quantity: true,
    variant: true,
    requestItem: { select: { id: true, name: true, unit: true } },
  },
} satisfies Prisma.Donation$itemsArgs;

export interface DonationItemDTO {
  requestItemId: string;
  name: string;
  unit: string;
  quantity: number;
  variant: Record<string, string>;
}

export interface TimelineEntryDTO {
  status: string;
  at: string;
  note: string | null;
  by: "Donor" | "Recipient" | "Platform";
}

function mapTimeline(events: { status: string; createdAt: Date; note: string | null; actorRole: string }[]): TimelineEntryDTO[] {
  return events.map((e) => ({
    status: e.status,
    at: e.createdAt.toISOString(),
    note: e.note,
    by: e.actorRole === "DONOR" ? "Donor" : e.actorRole === "RECIPIENT" ? "Recipient" : "Platform",
  }));
}

function mapItems(items: { quantity: number; variant: Prisma.JsonValue; requestItem: { id: string; name: string; unit: string } }[]): DonationItemDTO[] {
  return items.map((i) => ({
    requestItemId: i.requestItem.id,
    name: i.requestItem.name,
    unit: i.requestItem.unit,
    quantity: i.quantity,
    variant: (i.variant ?? {}) as Record<string, string>,
  }));
}

// ───────────────────────── Donor's view ─────────────────────────

/**
 * What a DONOR sees about their own donation. The recipient appears only as
 * its public reference + safe descriptor + district.
 */
export const donorDonationSelect = {
  publicId: true,
  status: true,
  type: true,
  deliveryMethod: true,
  condition: true,
  groupType: true,
  estimatedValue: true,
  expectedBy: true,
  createdAt: true,
  items: itemsSelect,
  events: timelineSelect,
  delivery: { select: { status: true, pickupScheduledAt: true, deliveredAt: true } },
  request: {
    select: {
      publicId: true,
      title: true,
      district: true,
      category: { select: { slug: true, name: true, icon: true } },
      organization: { select: { publicId: true, publicDescriptor: true } },
    },
  },
} satisfies Prisma.DonationSelect;

export type DonorDonationRow = Prisma.DonationGetPayload<{ select: typeof donorDonationSelect }>;

export interface DonorDonationDTO {
  id: string;
  status: string;
  type: string;
  deliveryMethod: string;
  condition: string;
  groupType: string;
  estimatedValue: number | null;
  expectedBy: string | null;
  createdAt: string;
  items: DonationItemDTO[];
  timeline: TimelineEntryDTO[];
  delivery: { status: string; scheduledAt: string | null; deliveredAt: string | null } | null;
  request: { id: string; title: string; category: { slug: string; name: string; icon: string } };
  recipient: { ref: string; descriptor: string; district: string };
}

export function toDonorDonation(row: DonorDonationRow): DonorDonationDTO {
  return {
    id: row.publicId,
    status: row.status,
    type: row.type,
    deliveryMethod: row.deliveryMethod,
    condition: row.condition,
    groupType: row.groupType,
    estimatedValue: row.estimatedValue,
    expectedBy: row.expectedBy?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    items: mapItems(row.items),
    timeline: mapTimeline(row.events),
    delivery: row.delivery
      ? {
          status: row.delivery.status,
          scheduledAt: row.delivery.pickupScheduledAt?.toISOString() ?? null,
          deliveredAt: row.delivery.deliveredAt?.toISOString() ?? null,
        }
      : null,
    request: { id: row.request.publicId, title: row.request.title, category: row.request.category },
    recipient: {
      ref: row.request.organization.publicId,
      descriptor: row.request.organization.publicDescriptor,
      district: row.request.district,
    },
  };
}

// ───────────────────────── Recipient's view ─────────────────────────

/**
 * What a RECIPIENT sees about a donation to them. donorId and organizationId
 * are loaded only to derive the per-recipient alias and are never mapped out.
 */
export const recipientDonationSelect = {
  publicId: true,
  donorId: true,
  organizationId: true,
  status: true,
  type: true,
  deliveryMethod: true,
  condition: true,
  groupType: true,
  expectedBy: true,
  createdAt: true,
  items: itemsSelect,
  events: timelineSelect,
  request: { select: { publicId: true, title: true } },
} satisfies Prisma.DonationSelect;

export type RecipientDonationRow = Prisma.DonationGetPayload<{ select: typeof recipientDonationSelect }>;

export interface RecipientDonationDTO {
  id: string;
  status: string;
  type: string;
  deliveryMethod: string;
  condition: string;
  expectedBy: string | null;
  createdAt: string;
  items: DonationItemDTO[];
  timeline: TimelineEntryDTO[];
  request: { id: string; title: string };
  donor: { alias: string; displayName: string };
}

export function toRecipientDonation(row: RecipientDonationRow): RecipientDonationDTO {
  const alias = donorAliasFor(row.donorId, row.organizationId);
  return {
    id: row.publicId,
    status: row.status,
    type: row.type,
    deliveryMethod: row.deliveryMethod,
    condition: row.condition,
    expectedBy: row.expectedBy?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    items: mapItems(row.items),
    timeline: mapTimeline(row.events),
    request: { id: row.request.publicId, title: row.request.title },
    donor: { alias, displayName: donorDisplayName(alias, row.groupType) },
  };
}
