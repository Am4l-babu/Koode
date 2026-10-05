import "server-only";
import type { Prisma } from "@prisma/client";
import { fulfillmentStage, itemPercent, remaining, requestPercent, totals, type FulfillmentStage } from "../fulfillment";
import { ORG_TYPE_LABELS } from "../descriptors";
import { donorFieldsFor, resolveCategorySchema, type FieldDef } from "../categories";

/**
 * PUBLIC request projection.
 *
 * This `select` is the single source of truth for what a donor / the public
 * can ever receive about a request. It deliberately does NOT reach into
 * OrganizationPrivate, the owning User, or any internal scoring fields.
 */
export const publicRequestSelect = {
  publicId: true,
  title: true,
  description: true,
  status: true,
  priority: true,
  neededBy: true,
  district: true,
  city: true,
  state: true,
  donationTypes: true,
  deliveryMethods: true,
  recurrence: true,
  createdAt: true,
  approvedAt: true,
  category: { select: { slug: true, name: true, icon: true, fieldSchema: true } },
  organization: {
    select: {
      publicId: true,
      orgType: true,
      publicDescriptor: true,
      focusArea: true,
      verificationStatus: true,
      verifiedAt: true,
    },
  },
  items: {
    orderBy: { sortOrder: "asc" },
    select: {
      id: true,
      name: true,
      unit: true,
      quantityRequired: true,
      quantityCommitted: true,
      attributes: true,
      estimatedUnitValue: true,
    },
  },
} satisfies Prisma.RequestSelect;

export type PublicRequestRow = Prisma.RequestGetPayload<{ select: typeof publicRequestSelect }>;

export interface PublicRequestItemDTO {
  id: string;
  name: string;
  unit: string;
  required: number;
  committed: number;
  remaining: number;
  percent: number;
  attributes: Record<string, string | number | boolean>;
  estimatedUnitValue: number | null;
  /** What a donor is asked about the items they give (product-type specific). */
  donorFields: FieldDef[];
}

export interface PublicRequestDTO {
  id: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  neededBy: string | null;
  postedAt: string;
  category: { slug: string; name: string; icon: string };
  recipient: {
    ref: string;
    descriptor: string;
    typeLabel: string;
    focusArea: string | null;
    verified: boolean;
    verifiedSince: string | null;
  };
  location: { district: string; city: string | null; state: string };
  donationTypes: string[];
  deliveryMethods: string[];
  recurrence: string;
  percent: number;
  stage: FulfillmentStage;
  totals: { required: number; committed: number; remaining: number };
  items: PublicRequestItemDTO[];
}

export function toPublicRequest(row: PublicRequestRow): PublicRequestDTO {
  const t = totals(row.items);
  const schema = resolveCategorySchema(row.category.slug, row.category.fieldSchema);
  return {
    id: row.publicId,
    title: row.title,
    description: row.description,
    status: row.status,
    priority: row.priority,
    neededBy: row.neededBy?.toISOString() ?? null,
    postedAt: (row.approvedAt ?? row.createdAt).toISOString(),
    category: { slug: row.category.slug, name: row.category.name, icon: row.category.icon },
    recipient: {
      ref: row.organization.publicId,
      descriptor: row.organization.publicDescriptor,
      typeLabel: ORG_TYPE_LABELS[row.organization.orgType],
      focusArea: row.organization.focusArea,
      verified: row.organization.verificationStatus === "VERIFIED",
      verifiedSince: row.organization.verifiedAt?.toISOString() ?? null,
    },
    location: { district: row.district, city: row.city, state: row.state },
    donationTypes: row.donationTypes,
    deliveryMethods: row.deliveryMethods,
    recurrence: row.recurrence,
    percent: requestPercent(row.items),
    stage: fulfillmentStage(row.items),
    totals: { required: t.required, committed: t.committed, remaining: t.remaining },
    items: row.items.map((i) => {
      const attributes = (i.attributes ?? {}) as Record<string, string | number | boolean>;
      return {
        id: i.id,
        name: i.name,
        unit: i.unit,
        required: i.quantityRequired,
        committed: i.quantityCommitted,
        remaining: remaining(i),
        percent: itemPercent(i),
        attributes,
        estimatedUnitValue: i.estimatedUnitValue,
        donorFields: donorFieldsFor(schema, attributes),
      };
    }),
  };
}

/** The owning recipient's view of its own request (adds moderation fields). */
export const ownerRequestSelect = {
  ...publicRequestSelect,
  id: true,
  adminNote: true,
  rejectionReason: true,
  peopleAffected: true,
  updatedAt: true,
  items: {
    orderBy: { sortOrder: "asc" },
    select: {
      id: true,
      name: true,
      unit: true,
      quantityRequired: true,
      quantityCommitted: true,
      quantityReceived: true,
      attributes: true,
      estimatedUnitValue: true,
    },
  },
} satisfies Prisma.RequestSelect;

export type OwnerRequestRow = Prisma.RequestGetPayload<{ select: typeof ownerRequestSelect }>;

export interface OwnerRequestDTO extends PublicRequestDTO {
  adminNote: string | null;
  rejectionReason: string | null;
  peopleAffected: number | null;
  received: number;
  itemsReceived: Record<string, number>;
}

export function toOwnerRequest(row: OwnerRequestRow): OwnerRequestDTO {
  const base = toPublicRequest(row);
  return {
    ...base,
    adminNote: row.adminNote,
    rejectionReason: row.rejectionReason,
    peopleAffected: row.peopleAffected,
    received: row.items.reduce((s, i) => s + i.quantityReceived, 0),
    itemsReceived: Object.fromEntries(row.items.map((i) => [i.id, i.quantityReceived])),
  };
}
