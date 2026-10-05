import "server-only";
import { db } from "@/lib/db";
import { PUBLIC_VISIBILITY } from "./requests";

/** Public, aggregate-only impact numbers (no per-person data). */
export async function publicImpact() {
  const [itemAgg, people, verifiedOrgs, statusGroups, categories, perCategory, districts] = await Promise.all([
    db.donationItem.aggregate({ _sum: { quantity: true }, where: { donation: { status: { not: "CANCELLED" } } } }),
    db.request.aggregate({ _sum: { peopleAffected: true }, where: { donations: { some: { status: { not: "CANCELLED" } } } } }),
    db.recipientOrganization.count({ where: { verificationStatus: "VERIFIED" } }),
    db.request.groupBy({ by: ["status"], _count: true, where: { status: { in: ["ACTIVE", "FULFILLED", "CLOSED"] } } }),
    db.category.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" }, select: { id: true, slug: true, name: true, icon: true } }),
    db.donationItem.findMany({
      where: { donation: { status: { not: "CANCELLED" } } },
      select: { quantity: true, requestItem: { select: { request: { select: { categoryId: true } } } } },
    }),
    db.request.groupBy({ by: ["district"], _count: true, where: { ...PUBLIC_VISIBILITY } }),
  ]);
  const counts = Object.fromEntries(statusGroups.map((g) => [g.status, g._count])) as Record<string, number>;
  const decided = (counts.FULFILLED ?? 0) + (counts.CLOSED ?? 0);
  const byCategory = categories.map((c) => ({
    slug: c.slug,
    name: c.name,
    icon: c.icon,
    items: perCategory.filter((p) => p.requestItem.request.categoryId === c.id).reduce((s, p) => s + p.quantity, 0),
  }));
  return {
    itemsDonated: itemAgg._sum.quantity ?? 0,
    peopleSupported: people._sum.peopleAffected ?? 0,
    verifiedOrganizations: verifiedOrgs,
    activeRequests: counts.ACTIVE ?? 0,
    fulfilledRequests: counts.FULFILLED ?? 0,
    fulfillmentRate: decided ? Math.round(((counts.FULFILLED ?? 0) / decided) * 100) : 0,
    byCategory,
    districts: districts.map((d) => ({ district: d.district, requests: d._count })),
  };
}
