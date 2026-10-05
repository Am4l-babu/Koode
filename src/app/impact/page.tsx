import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/card";
import { CountUp } from "@/components/marketing/count-up";
import { DistrictTileMap } from "@/components/charts/tile-map";
import { publicImpact } from "@/services/impact";
import { ButtonLink } from "@/components/ui/button";

export const metadata: Metadata = { title: "Impact", description: "Aggregate, privacy-preserving impact of community giving on Sahaya Bridge." };
export const dynamic = "force-dynamic";

export default async function ImpactPage() {
  const impact = await publicImpact();
  const max = Math.max(1, ...impact.byCategory.map((c) => c.items));
  const stats = [
    [impact.itemsDonated, "", "Items donated"],
    [impact.peopleSupported, "", "People supported"],
    [impact.verifiedOrganizations, "", "Verified organisations"],
    [impact.fulfillmentRate, "%", "Requests successfully fulfilled"],
  ] as const;
  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
      <PageHeader eyebrow="Impact" title="Small, specific gifts — adding up" description="All figures are aggregates. We never publish who gave or who received." />
      <dl className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map(([v, s, l], i) => (
          <div key={l} className="card animate-rise p-6" style={{ animationDelay: `${i * 80}ms` }}>
            <dd className="font-display text-4xl font-semibold text-primary-ink sm:text-5xl"><CountUp value={v} suffix={s} /></dd>
            <dt className="mt-2 text-sm text-muted">{l}</dt>
          </div>
        ))}
      </dl>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <section className="card p-6" aria-labelledby="by-cat">
          <h2 id="by-cat" className="text-lg font-semibold">Items donated by category</h2>
          <ul className="mt-6 space-y-4">
            {impact.byCategory.map((c) => (
              <li key={c.slug} className="grid grid-cols-[8rem_1fr_3rem] items-center gap-3 text-sm sm:grid-cols-[10rem_1fr_4rem]">
                <span className="flex items-center gap-2 font-semibold"><span aria-hidden="true" className="text-lg">{c.icon}</span>{c.name}</span>
                <span className="h-3 overflow-hidden rounded-full bg-surface-3" aria-hidden="true">
                  <span className="progress-fill block h-full rounded-full bg-primary" style={{ width: `${(c.items / max) * 100}%` }} />
                </span>
                <span className="text-right tabular-nums text-muted">{c.items.toLocaleString("en-IN")}</span>
              </li>
            ))}
          </ul>
        </section>
        <section className="card p-6" aria-labelledby="where">
          <h2 id="where" className="text-lg font-semibold">Where needs are</h2>
          <p className="mt-1 text-sm text-muted">District level only — exact locations are never shown.</p>
          <DistrictTileMap data={impact.districts.map((d) => ({ district: d.district, value: d.requests }))} label="requests" />
        </section>
      </div>
      <div className="mt-10 text-center">
        <ButtonLink href="/needs" size="lg">Add to this impact</ButtonLink>
      </div>
    </div>
  );
}
