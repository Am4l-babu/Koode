import { Suspense } from "react";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/states";
import { Pagination } from "@/components/ui/pagination";
import { NeedCard } from "./need-card";
import { FilterBar } from "./filter-bar";
import { browseRequests, listCategories, type BrowseFilters } from "@/services/requests";
import { KERALA_DISTRICTS } from "@/lib/geo";
import type { BrowseQuery } from "@/lib/validation/browse";

export async function BrowseView({ query, basePath, fixedCategory }: { query: BrowseQuery; basePath: string; fixedCategory?: string }) {
  const filters: BrowseFilters = { ...query, category: fixedCategory ?? query.category };
  const [result, categories] = await Promise.all([browseRequests(filters), listCategories()]);

  const interpreted = result.interpreted
    ? [
        result.interpreted.terms.length ? `“${result.interpreted.terms.join(" ")}”` : null,
        result.interpreted.categorySlug ? categories.find((c) => c.slug === result.interpreted!.categorySlug)?.name : null,
        result.interpreted.size ? `size ${result.interpreted.size}` : null,
        result.interpreted.age !== undefined ? `age ${result.interpreted.age}` : null,
        result.interpreted.district ? `near ${result.interpreted.district}` : null,
      ]
        .filter(Boolean)
        .join(" · ")
    : null;

  const hrefFor = (page: number) => {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(query)) if (v !== undefined && k !== "page") sp.set(k, String(v));
    sp.set("page", String(page));
    return `${basePath}?${sp.toString()}`;
  };

  const urgentFilter = query.urgency === "CRITICAL" || query.urgency === "HIGH";

  return (
    <div className="space-y-8">
      <Suspense>
        <FilterBar
          categories={categories.map((c) => ({ value: c.slug, label: `${c.icon} ${c.name}` }))}
          districts={[...KERALA_DISTRICTS]}
          interpreted={interpreted}
        />
      </Suspense>

      <p className="text-sm text-muted" aria-live="polite">
        {result.total} verified need{result.total === 1 ? "" : "s"} found
      </p>

      {result.items.length ? (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {result.items.map((n, i) => <NeedCard key={n.id} need={n} index={i} />)}
        </div>
      ) : urgentFilter ? (
        <EmptyState
          title="There are no urgent needs at the moment, but many organisations would still welcome your support."
          action={<ButtonLink href="/needs">Browse all needs</ButtonLink>}
        />
      ) : (
        <EmptyState
          illustration="box"
          title="No needs match those filters yet"
          description="Try a broader search or a nearby district — new verified needs are posted every week."
          action={<ButtonLink href="/needs">Browse all needs</ButtonLink>}
        />
      )}
      <Pagination page={result.page} pageCount={result.pageCount} hrefFor={hrefFor} />
    </div>
  );
}
