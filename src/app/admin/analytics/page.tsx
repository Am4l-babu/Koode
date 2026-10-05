import { PageHeader } from "@/components/ui/card";
import { MetricCard } from "@/components/ui/metric";
import { AnalyticsPanels } from "@/components/admin/analytics-panels";
import { requirePagePermission } from "@/lib/auth/guards";
import { analytics } from "@/services/admin";

export const metadata = { title: "Analytics" };
export const dynamic = "force-dynamic";

export default async function AnalyticsPage() {
  await requirePagePermission("ANALYTICS_VIEW");
  const data = await analytics();
  return (
    <>
      <PageHeader eyebrow="Analytics" title="Platform analytics" description="Aggregates only. Geographic data is shown at district level." />
      <h2 className="mb-3 text-lg font-semibold">Donors</h2>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <MetricCard label="Total donors" value={data.donors.total} />
        <MetricCard label="New (30 days)" value={data.donors.newLast30Days} tone="info" />
        <MetricCard label="Returning donors" value={data.donors.returning} tone="success" />
        <MetricCard label="Avg. items / donation" value={data.donors.averageItemsPerDonation} tone="accent" />
      </div>
      <h2 className="mb-3 mt-8 text-lg font-semibold">Recipients</h2>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <MetricCard label="Organisations" value={data.recipients.total} />
        <MetricCard label="Verification rate" value={`${data.recipients.verificationRate}%`} tone="success" />
        <MetricCard label="Requests submitted" value={data.recipients.requestsSubmitted} tone="info" />
        <MetricCard label="Fulfilment rate" value={`${data.fulfillmentRate}%`} tone="accent" />
      </div>
      <div className="mt-8"><AnalyticsPanels data={data} /></div>
    </>
  );
}
