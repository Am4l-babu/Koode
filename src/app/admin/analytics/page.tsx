import { Baby, Boxes, Building2, Percent, Soup, Users } from "lucide-react";
import { PageHeader } from "@/components/ui/card";
import { MetricCard } from "@/components/ui/metric";
import { ChartCard } from "@/components/charts/chart-card";
import { LineChart } from "@/components/charts/line-chart";
import { DonutChart } from "@/components/charts/donut-chart";
import { BarChart } from "@/components/charts/bar-chart";
import { DistrictTileMap } from "@/components/charts/tile-map";
import { requirePagePermission } from "@/lib/auth/guards";
import { analytics } from "@/services/admin";
import { REQUEST_STATUS_LABELS } from "@/lib/descriptors";
import { formatNumber } from "@/lib/format";

export const metadata = { title: "Analytics" };
export const dynamic = "force-dynamic";

const monthLabel = (m: string) => new Date(`${m}-01T00:00:00Z`).toLocaleDateString("en-IN", { month: "short", timeZone: "UTC" });

const SECTIONS = [
  ["overview", "Overview"],
  ["donors", "Donors"],
  ["recipients", "Recipients"],
  ["categories", "Categories"],
  ["geography", "Geography"],
] as const;

export default async function AnalyticsPage() {
  await requirePagePermission("ANALYTICS_VIEW");
  const data = await analytics();
  const donations = data.series.reduce((s, m) => s + m.donations, 0);
  const statusRows = (["PENDING_VERIFICATION", "ACTIVE", "FULFILLED", "NEEDS_INFO", "CLOSED", "REJECTED", "DRAFT"] as const).map((s) => ({
    label: REQUEST_STATUS_LABELS[s],
    value: data.requestsByStatus[s] ?? 0,
  }));
  const impact = [
    { label: "Items donated", value: data.monthlyImpact.itemsDonated, icon: Boxes },
    { label: "Families supported", value: data.monthlyImpact.familiesSupported, icon: Users },
    { label: "Organisations supported", value: data.monthlyImpact.organizationsSupported, icon: Building2 },
    { label: "Children reached", value: data.monthlyImpact.childrenReached, icon: Baby },
    { label: "Meals provided (kg/units)", value: data.monthlyImpact.mealsProvided, icon: Soup },
  ];

  return (
    <>
      <PageHeader
        title="Analytics"
        description="Aggregates only. Geographic data is shown at district level."
        actions={<span className="rounded-full border border-line bg-surface px-3 py-1.5 text-sm font-medium text-muted">Last 6 months</span>}
      />
      <nav aria-label="Analytics sections" className="-mx-4 mb-6 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <ul className="inline-flex gap-1 rounded-full border border-line bg-surface p-1">
          {SECTIONS.map(([id, label], i) => (
            <li key={id}>
              <a href={`#${id}`} className={i === 0 ? "block rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-fg" : "block rounded-full px-4 py-2 text-sm font-semibold text-muted hover:bg-surface-2 hover:text-fg"}>
                {label}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <section id="overview" aria-label="Overview" className="scroll-mt-24">
        <div className="grid gap-4 sm:grid-cols-3">
          <MetricCard label="Total donations" value={formatNumber(donations)} icon={<Boxes className="h-5 w-5" />} hint="Excluding cancelled" />
          <MetricCard label="Fulfilment rate" value={`${data.fulfillmentRate}%`} icon={<Percent className="h-5 w-5" />} tone="success" />
          <MetricCard label="Active requests" value={formatNumber(data.requestsByStatus.ACTIVE ?? 0)} icon={<Building2 className="h-5 w-5" />} tone="info" />
        </div>
        <div className="mt-5">
          <ChartCard title="Items donated over time" description="Monthly, excluding cancelled donations" table={{ columns: ["Month", "Items", "Donations"], rows: data.series.map((s) => [monthLabel(s.month), s.items, s.donations]) }}>
            <LineChart data={data.series.map((s) => ({ label: monthLabel(s.month), value: s.items, detail: `${s.donations} donations` }))} valueLabel="items" />
          </ChartCard>
        </div>
      </section>

      <section id="donors" aria-labelledby="donors-h" className="mt-10 scroll-mt-24">
        <h2 id="donors-h" className="mb-3 text-lg font-semibold">Donors</h2>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <MetricCard label="Total donors" value={data.donors.total} />
          <MetricCard label="New (30 days)" value={data.donors.newLast30Days} tone="info" />
          <MetricCard label="Returning donors" value={data.donors.returning} tone="success" />
          <MetricCard label="Avg. items / donation" value={data.donors.averageItemsPerDonation} tone="accent" />
        </div>
      </section>

      <section id="recipients" aria-labelledby="recipients-h" className="mt-10 scroll-mt-24">
        <h2 id="recipients-h" className="mb-3 text-lg font-semibold">Recipients</h2>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <MetricCard label="Organisations" value={data.recipients.total} />
          <MetricCard label="Verification rate" value={`${data.recipients.verificationRate}%`} tone="success" />
          <MetricCard label="Requests submitted" value={data.recipients.requestsSubmitted} tone="info" />
          <MetricCard label="Fulfilment rate" value={`${data.fulfillmentRate}%`} tone="accent" />
        </div>
        <div className="mt-5">
          <ChartCard title="Requests by status" table={{ columns: ["Status", "Requests"], rows: statusRows.map((r) => [r.label, r.value]) }}>
            <BarChart data={statusRows} unit="requests" />
          </ChartCard>
        </div>
      </section>

      <div className="mt-10 grid gap-5 xl:grid-cols-2">
        <div id="categories" className="scroll-mt-24">
          <ChartCard title="Donations by category" description="Items, last 6 months" className="h-full" table={{ columns: ["Category", "Items"], rows: data.byCategory.map((c) => [c.name, c.items]) }}>
            <DonutChart data={data.byCategory.map((c) => ({ key: c.slug, label: c.name, value: c.items }))} centerLabel="items" />
          </ChartCard>
        </div>
        <div id="geography" className="scroll-mt-24">
          <ChartCard title="Geographic distribution" description="Active & fulfilled requests per district" className="h-full" table={{ columns: ["District", "Requests"], rows: data.geographic.map((g) => [g.district, g.requests]) }}>
            <DistrictTileMap data={data.geographic.map((g) => ({ district: g.district, value: g.requests }))} label="requests" />
          </ChartCard>
        </div>
      </div>

      <section aria-labelledby="impact-h" className="card mt-6 p-5 sm:p-6">
        <h2 id="impact-h" className="text-lg font-semibold">Impact this month</h2>
        <dl className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-5">
          {impact.map((m) => (
            <div key={m.label} className="flex flex-col items-center rounded-2xl bg-surface-2 p-4 text-center">
              <dt className="order-last text-xs text-muted">{m.label}</dt>
              <dd className="flex flex-col items-center">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-soft text-primary-ink" aria-hidden="true"><m.icon className="h-5 w-5" /></span>
                <span className="mt-2 font-display text-2xl font-semibold tabular-nums">{formatNumber(m.value)}</span>
              </dd>
            </div>
          ))}
        </dl>
      </section>
    </>
  );
}
