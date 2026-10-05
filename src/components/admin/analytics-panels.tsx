import { ChartCard } from "@/components/charts/chart-card";
import { LineChart } from "@/components/charts/line-chart";
import { DonutChart } from "@/components/charts/donut-chart";
import { BarChart } from "@/components/charts/bar-chart";
import { DistrictTileMap } from "@/components/charts/tile-map";
import { ProgressRing } from "@/components/charts/progress-ring";
import { REQUEST_STATUS_LABELS } from "@/lib/descriptors";
import type { analytics } from "@/services/admin";

type Analytics = Awaited<ReturnType<typeof analytics>>;

const monthLabel = (m: string) => new Date(`${m}-01T00:00:00Z`).toLocaleDateString("en-IN", { month: "short", timeZone: "UTC" });

export function AnalyticsPanels({ data }: { data: Analytics }) {
  const series = data.series.map((s) => ({ label: monthLabel(s.month), value: s.items, detail: `${s.donations} donations` }));
  const statusRows = (["PENDING_VERIFICATION", "ACTIVE", "FULFILLED", "NEEDS_INFO", "CLOSED", "REJECTED", "DRAFT"] as const).map((s) => ({
    label: REQUEST_STATUS_LABELS[s],
    value: data.requestsByStatus[s] ?? 0,
  }));
  return (
    <div className="grid gap-5 xl:grid-cols-3">
      <ChartCard title="Items donated over time" description="Monthly, excluding cancelled donations" className="xl:col-span-2" table={{ columns: ["Month", "Items", "Donations"], rows: data.series.map((s) => [monthLabel(s.month), s.items, s.donations]) }}>
        <LineChart data={series} valueLabel="items" />
      </ChartCard>
      <ChartCard title="Fulfilment rate" description="Fulfilled ÷ (fulfilled + closed + active)">
        <div className="flex h-full items-center justify-center"><ProgressRing value={data.fulfillmentRate} label="of approved requests fulfilled" /></div>
      </ChartCard>
      <ChartCard title="Donations by category" description="Items, last 6 months" table={{ columns: ["Category", "Items"], rows: data.byCategory.map((c) => [c.name, c.items]) }}>
        <DonutChart data={data.byCategory.map((c) => ({ key: c.slug, label: `${c.icon} ${c.name}`, value: c.items }))} centerLabel="items" />
      </ChartCard>
      <ChartCard title="Requests by status" table={{ columns: ["Status", "Requests"], rows: statusRows.map((r) => [r.label, r.value]) }}>
        <BarChart data={statusRows} unit="requests" />
      </ChartCard>
      <ChartCard title="Geographic distribution" description="Active & fulfilled requests per district" table={{ columns: ["District", "Requests"], rows: data.geographic.map((g) => [g.district, g.requests]) }}>
        <DistrictTileMap data={data.geographic.map((g) => ({ district: g.district, value: g.requests }))} label="requests" />
      </ChartCard>
    </div>
  );
}
