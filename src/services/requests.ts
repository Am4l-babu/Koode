import "server-only";
import type { Prisma, Priority, RequestStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { AppError, forbidden, notFound } from "@/lib/errors";
import { generatePublicId, withUniqueRetry } from "@/lib/ids";
import { parseSearchQuery } from "@/lib/search";
import { PRODUCT_TYPE_KEY, resolveCategorySchema, validateItemAttributes } from "@/lib/categories";
import { suggestPriority } from "@/lib/priority";
import { DISTRICT_TILES, isKeralaDistrict, type KeralaDistrict } from "@/lib/geo";
import { ownerRequestSelect, publicRequestSelect, toOwnerRequest, toPublicRequest, type PublicRequestDTO } from "@/lib/dto/requests";
import type { SessionUser } from "@/lib/auth/session";
import type { CreateRequestInput } from "@/lib/validation/request";
import { templates } from "@/lib/notifications/templates";
import { notifyAdmins } from "./notifications";
import { getSettings } from "./settings";

/** A request is publicly visible only when approved AND its organisation is verified. */
export const PUBLIC_VISIBILITY: Prisma.RequestWhereInput = {
  status: { in: ["ACTIVE", "FULFILLED"] },
  organization: { verificationStatus: "VERIFIED" },
};

export const SORTS = ["urgent", "recent", "closest", "most_needed", "almost", "popular"] as const;
export type SortKey = (typeof SORTS)[number];
export const STAGES = ["just_posted", "partial", "almost"] as const;

export interface BrowseFilters {
  q?: string;
  category?: string;
  product?: string;
  district?: string;
  urgency?: Priority;
  stage?: (typeof STAGES)[number];
  donationType?: "ITEM" | "MONETARY" | "SPONSOR";
  sort?: SortKey;
  near?: string;
  includeFulfilled?: boolean;
  page?: number;
  pageSize?: number;
}

export interface BrowseResult {
  items: PublicRequestDTO[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
  interpreted: ReturnType<typeof parseSearchQuery> | null;
}

function orderFor(sort: SortKey): Prisma.RequestOrderByWithRelationInput[] {
  switch (sort) {
    case "recent":
      return [{ approvedAt: "desc" }, { createdAt: "desc" }];
    case "most_needed":
      return [{ quantityRemaining: "desc" }, { priority: "asc" }];
    case "almost":
      return [{ percentFulfilled: "desc" }, { priority: "asc" }];
    case "popular":
      return [{ popularity: "desc" }, { createdAt: "desc" }];
    case "urgent":
    default:
      // Postgres orders enums by declaration: CRITICAL, HIGH, MEDIUM, NORMAL.
      return [{ priority: "asc" }, { priorityScore: "desc" }, { neededBy: { sort: "asc", nulls: "last" } }];
  }
}

function districtDistance(a: KeralaDistrict, b: KeralaDistrict): number {
  const [ax, ay] = DISTRICT_TILES[a];
  const [bx, by] = DISTRICT_TILES[b];
  return Math.hypot(ax - bx, ay - by);
}

export function buildBrowseWhere(filters: BrowseFilters) {
  const and: Prisma.RequestWhereInput[] = [PUBLIC_VISIBILITY];
  if (!filters.includeFulfilled) and.push({ status: "ACTIVE" });
  const interpreted = filters.q?.trim() ? parseSearchQuery(filters.q) : null;

  const category = filters.category || interpreted?.categorySlug;
  if (category) and.push({ category: { slug: category } });
  if (filters.product) and.push({ items: { some: { attributes: { path: [PRODUCT_TYPE_KEY], equals: filters.product } } } });
  const district = filters.district || interpreted?.district;
  if (district) and.push({ district });
  if (filters.urgency) and.push({ priority: filters.urgency });
  if (filters.donationType) and.push({ donationTypes: { has: filters.donationType } });
  if (filters.stage === "just_posted") and.push({ percentFulfilled: 0 });
  if (filters.stage === "partial") and.push({ percentFulfilled: { gt: 0, lt: 75 } });
  if (filters.stage === "almost") and.push({ percentFulfilled: { gte: 75, lt: 100 } });

  if (interpreted) {
    for (const term of interpreted.terms) {
      and.push({
        OR: [
          { title: { contains: term, mode: "insensitive" } },
          { description: { contains: term, mode: "insensitive" } },
          { items: { some: { name: { contains: term, mode: "insensitive" } } } },
        ],
      });
    }
    if (interpreted.age !== undefined) {
      and.push({ items: { some: { ageMin: { lte: interpreted.age }, ageMax: { gte: interpreted.age } } } });
    }
    if (interpreted.size) {
      and.push({ items: { some: { attributes: { path: ["size"], string_contains: interpreted.size } } } });
    }
  }
  return { where: { AND: and } satisfies Prisma.RequestWhereInput, interpreted };
}

export async function browseRequests(filters: BrowseFilters): Promise<BrowseResult> {
  const pageSize = Math.min(Math.max(filters.pageSize ?? 12, 1), 48);
  const page = Math.max(filters.page ?? 1, 1);
  const sort = filters.sort ?? "urgent";
  const { where, interpreted } = buildBrowseWhere(filters);

  const total = await db.request.count({ where });
  let rows;
  if (sort === "closest" && filters.near && isKeralaDistrict(filters.near)) {
    // Rank by coarse district distance (privacy-preserving — no coordinates).
    const near = filters.near;
    const light = await db.request.findMany({
      where,
      select: { id: true, district: true, priorityScore: true },
      take: 5000,
    });
    light.sort((a, b) => {
      const da = isKeralaDistrict(a.district) ? districtDistance(near, a.district) : 99;
      const dbb = isKeralaDistrict(b.district) ? districtDistance(near, b.district) : 99;
      return da - dbb || b.priorityScore - a.priorityScore;
    });
    const ids = light.slice((page - 1) * pageSize, page * pageSize).map((r) => r.id);
    const fetched = await db.request.findMany({ where: { id: { in: ids } }, select: { ...publicRequestSelect, id: true } });
    rows = ids.map((id) => fetched.find((r) => r.id === id)!).filter(Boolean);
  } else {
    rows = await db.request.findMany({
      where,
      select: publicRequestSelect,
      orderBy: orderFor(sort),
      skip: (page - 1) * pageSize,
      take: pageSize,
    });
  }

  return {
    items: rows.map(toPublicRequest),
    total,
    page,
    pageSize,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
    interpreted,
  };
}

export async function getPublicRequest(publicId: string): Promise<PublicRequestDTO> {
  const row = await db.request.findFirst({ where: { publicId, ...PUBLIC_VISIBILITY }, select: publicRequestSelect });
  if (!row) throw notFound("This request");
  return toPublicRequest(row);
}

export async function recordView(publicId: string) {
  await db.request.updateMany({ where: { publicId, status: "ACTIVE" }, data: { popularity: { increment: 1 } } });
}

/**
 * Product types that currently have open, public needs in a category, with how
 * many needs each — in the category's own order, so filters never lead nowhere.
 */
export async function productTypeCounts(categorySlug: string): Promise<{ name: string; count: number }[]> {
  const category = await db.category.findFirst({ where: { slug: categorySlug, isActive: true }, select: { slug: true, fieldSchema: true } });
  if (!category) return [];
  const items = await db.requestItem.findMany({
    where: { request: { AND: [PUBLIC_VISIBILITY, { status: "ACTIVE" }, { category: { slug: categorySlug } }] } },
    select: { requestId: true, attributes: true },
    take: 5000,
  });
  const needs = new Map<string, Set<string>>();
  for (const item of items) {
    const type = (item.attributes as Record<string, unknown> | null)?.[PRODUCT_TYPE_KEY];
    if (typeof type !== "string") continue;
    if (!needs.has(type)) needs.set(type, new Set());
    needs.get(type)!.add(item.requestId);
  }
  const order = resolveCategorySchema(category.slug, category.fieldSchema).productTypes?.map((t) => t.name) ?? [];
  return [...needs.entries()]
    .map(([name, ids]) => ({ name, count: ids.size }))
    .sort((a, b) => (order.indexOf(a.name) + 1 || 999) - (order.indexOf(b.name) + 1 || 999) || a.name.localeCompare(b.name));
}

export async function listCategories(includeInactive = false) {
  return db.category.findMany({
    where: includeInactive ? {} : { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: { id: true, slug: true, name: true, icon: true, description: true, fieldSchema: true, isActive: true, sortOrder: true },
  });
}

export async function categoryCounts() {
  const groups = await db.request.groupBy({ by: ["categoryId"], where: { ...PUBLIC_VISIBILITY, status: "ACTIVE" }, _count: true });
  return Object.fromEntries(groups.map((g) => [g.categoryId, g._count]));
}

// ───────────────────────── Recipient side ─────────────────────────

function requireOrg(actor: SessionUser): string {
  if (actor.role !== "RECIPIENT" || !actor.organizationId) throw forbidden("Only recipient organisations can manage requests.");
  return actor.organizationId;
}

/** Detect probable duplicates: same org, open request, same category with overlapping item names. */
export async function findPossibleDuplicates(organizationId: string, categoryId: string, itemNames: string[], excludeId?: string) {
  const open = await db.request.findMany({
    where: {
      organizationId,
      categoryId,
      status: { in: ["PENDING_VERIFICATION", "NEEDS_INFO", "ACTIVE"] },
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
    select: { publicId: true, title: true, items: { select: { name: true } } },
  });
  const wanted = new Set(itemNames.map((n) => n.toLowerCase().trim()));
  return open
    .filter((r) => r.items.some((i) => wanted.has(i.name.toLowerCase().trim())))
    .map((r) => ({ id: r.publicId, title: r.title }));
}

export async function createRequest(actor: SessionUser, input: CreateRequestInput) {
  const organizationId = requireOrg(actor);
  const [org, category, settings] = await Promise.all([
    db.recipientOrganization.findUnique({ where: { id: organizationId }, select: { verificationStatus: true } }),
    db.category.findFirst({ where: { id: input.categoryId, isActive: true }, select: { id: true, slug: true, fieldSchema: true } }),
    getSettings(),
  ]);
  if (!org) throw forbidden();
  if (org.verificationStatus === "SUSPENDED" || org.verificationStatus === "REJECTED") {
    throw forbidden("Your organisation cannot create requests at the moment. Please contact the platform team.");
  }
  if (!category) throw new AppError("VALIDATION_FAILED", "Choose a valid category.", { fields: { categoryId: "Choose a valid category." } });
  if (input.recurrence !== "NONE" && !settings.features.recurringRequests) {
    throw new AppError("VALIDATION_FAILED", "Recurring requests are currently disabled.", { fields: { recurrence: "Recurring requests are disabled." } });
  }
  if (input.donationTypes.some((t) => t !== "ITEM") && !settings.features.monetaryDonations) {
    input.donationTypes = ["ITEM"];
  }

  const schema = resolveCategorySchema(category.slug, category.fieldSchema);
  const fieldErrors: Record<string, string> = {};
  const items = input.items.map((item, index) => {
    const result = validateItemAttributes(schema, item.attributes);
    if (!result.ok) {
      for (const [k, v] of Object.entries(result.errors)) fieldErrors[`items.${index}.attributes.${k}`] = v;
      return null;
    }
    return { ...item, attributes: result.attributes, ageMin: result.ageMin, ageMax: result.ageMax, sortOrder: index };
  });
  if (Object.keys(fieldErrors).length) throw new AppError("VALIDATION_FAILED", "Some item details need attention.", { fields: fieldErrors });

  const totalQty = input.items.reduce((s, i) => s + i.quantity, 0);
  const { score } = suggestPriority({
    statedUrgency: input.urgency,
    neededBy: input.neededBy ?? null,
    peopleAffected: input.peopleAffected ?? null,
    remainingFraction: 1,
    verified: org.verificationStatus === "VERIFIED",
  });

  const status: RequestStatus = input.submit ? "PENDING_VERIFICATION" : "DRAFT";
  const created = await withUniqueRetry(() =>
    db.request.create({
      data: {
        publicId: generatePublicId("request"),
        organizationId,
        categoryId: category.id,
        title: input.title,
        description: input.description,
        status,
        // Final priority is set by an admin at approval; start from the stated urgency.
        priority: input.urgency,
        priorityScore: score,
        peopleAffected: input.peopleAffected ?? null,
        neededBy: input.neededBy ?? null,
        district: input.district,
        city: input.city ?? null,
        donationTypes: input.donationTypes,
        deliveryMethods: input.deliveryMethods,
        recurrence: input.recurrence,
        quantityRemaining: totalQty,
        items: {
          create: items.map((i) => ({
            name: i!.name,
            unit: i!.unit,
            quantityRequired: i!.quantity,
            estimatedUnitValue: i!.estimatedUnitValue ?? null,
            attributes: i!.attributes,
            ageMin: i!.ageMin,
            ageMax: i!.ageMax,
            sortOrder: i!.sortOrder,
          })),
        },
      },
      select: { id: true, publicId: true, status: true },
    }),
  );

  if (status === "PENDING_VERIFICATION") await notifyAdmins("REQUEST_REVIEW", templates.adminNewRequest(created.publicId));
  return { id: created.publicId, status: created.status };
}

export async function listOwnRequests(actor: SessionUser) {
  const organizationId = requireOrg(actor);
  const rows = await db.request.findMany({
    where: { organizationId },
    orderBy: { createdAt: "desc" },
    select: ownerRequestSelect,
  });
  return rows.map(toOwnerRequest);
}

export async function getOwnRequest(actor: SessionUser, publicId: string) {
  const organizationId = requireOrg(actor);
  // Ownership is part of the query: another organisation's id yields "not found".
  const row = await db.request.findFirst({ where: { publicId, organizationId }, select: ownerRequestSelect });
  if (!row) throw notFound("This request");
  return toOwnerRequest(row);
}

export async function recipientRequestAction(actor: SessionUser, publicId: string, action: "close" | "resubmit") {
  const organizationId = requireOrg(actor);
  const request = await db.request.findFirst({ where: { publicId, organizationId }, select: { id: true, status: true } });
  if (!request) throw notFound("This request");
  if (action === "close") {
    if (!["ACTIVE", "PENDING_VERIFICATION", "NEEDS_INFO", "DRAFT"].includes(request.status)) {
      throw new AppError("CONFLICT", "This request can no longer be closed.");
    }
    await db.request.update({ where: { id: request.id }, data: { status: "CLOSED" } });
  } else {
    if (!["NEEDS_INFO", "DRAFT"].includes(request.status)) throw new AppError("CONFLICT", "Only drafts or requests awaiting information can be resubmitted.");
    await db.request.update({ where: { id: request.id }, data: { status: "PENDING_VERIFICATION" } });
    await notifyAdmins("REQUEST_REVIEW", templates.adminNewRequest(publicId));
  }
  return { ok: true };
}

// ───────────────────────── Reports & recommendations ─────────────────────────

export async function reportRequest(
  actor: SessionUser | null,
  publicId: string,
  input: { reason: Prisma.ReportCreateInput["reason"]; details?: string },
) {
  const request = await db.request.findFirst({ where: { publicId, ...PUBLIC_VISIBILITY }, select: { id: true } });
  if (!request) throw notFound("This request");
  await db.report.create({
    data: { requestId: request.id, reporterId: actor?.id ?? null, reason: input.reason, details: input.details ?? null },
  });
  await notifyAdmins("REQUEST_REVIEW", templates.adminReport(publicId));
  return { ok: true };
}

/**
 * "Needs you can fulfil": active requests in categories the donor has
 * supported before, near their preferred district. No pressure mechanics.
 */
export async function recommendationsFor(actor: SessionUser, limit = 6) {
  const [history, profile] = await Promise.all([
    db.donation.findMany({
      where: { donorId: actor.id, status: { not: "CANCELLED" } },
      select: { requestId: true, request: { select: { categoryId: true, category: { select: { name: true } } } } },
      take: 50,
      orderBy: { createdAt: "desc" },
    }),
    db.donorProfile.findUnique({ where: { userId: actor.id }, select: { preferredDistrict: true } }),
  ]);
  const categoryIds = [...new Set(history.map((h) => h.request.categoryId))];
  const supported = history.map((h) => h.requestId);
  const reason = categoryIds.length
    ? `You have previously supported ${[...new Set(history.map((h) => h.request.category.name))].slice(0, 2).join(" and ").toLowerCase()}.`
    : profile?.preferredDistrict
      ? `Active needs around ${profile.preferredDistrict}.`
      : "Active verified needs right now.";

  const rows = await db.request.findMany({
    where: {
      AND: [
        PUBLIC_VISIBILITY,
        { status: "ACTIVE", id: { notIn: supported } },
        categoryIds.length ? { categoryId: { in: categoryIds } } : profile?.preferredDistrict ? { district: profile.preferredDistrict } : {},
      ],
    },
    select: publicRequestSelect,
    orderBy: orderFor("urgent"),
    take: limit,
  });
  return { reason, items: rows.map(toPublicRequest) };
}
