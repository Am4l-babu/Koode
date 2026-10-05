import Link from "next/link";
import { Activity, Boxes, CheckCircle2, ClipboardList, HandHeart, ShieldAlert, ShieldCheck, Users } from "lucide-react";
import { PageHeader } from "@/components/ui/card";
import { MetricCard } from "@/components/ui/metric";
import { Callout } from "@/components/ui/states";
import { AnalyticsPanels } from "@/components/admin/analytics-panels";
import { requirePageUser } from "@/lib/auth/guards";
import { hasPermission, PERMISSION_LABELS } from "@/lib/permissions";
import { analytics, dashboardStats, recentActivity } from "@/services/admin";
import { formatDateTime, formatNumber } from "@/lib/format";
import type { Permission } from "@prisma/client";

export const metadata = { title: "Dashboard" };
export const dynamic = "force-dynamic";

export default async function AdminDashboard({ searchParams }: { searchParams: Promise<{ denied?: string }> }) {
  const user = await requirePageUser(["ADMIN", "SUPER_ADMIN"]);
  const sp = await searchParams;
  const canAnalytics = hasPermission(user, "ANALYTICS_VIEW");
  const [stats, activity, data] = await Promise.all([dashboardStats(), hasPermission(user, "AUDIT_LOG_VIEW") ? recentActivity() : Promise.resolve([]), canAnalytics ? analytics() : Promise.resolve(null)]);

  return (
    <>
      <PageHeader eyebrow="Operations center" title="Dashboard" description="Verify, coordinate and protect both sides." />
      {sp.denied && (
        <div className="mb-6">
          <Callout tone="warning" title="You don't have access to that area">It requires the “{PERMISSION_LABELS[sp.denied as Permission] ?? sp.denied}” permission. Ask a super admin if you need it.</Callout>
        </div>
      )}
      <section aria-label="Key figures" className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <MetricCard label="Total donors" value={formatNumber(stats.totalDonors)} icon={<Users className="h-5 w-5" />} />
        <MetricCard label="Verified recipients" value={formatNumber(stats.verifiedRecipients)} icon={<ShieldCheck className="h-5 w-5" />} tone="success" />
        <MetricCard label="Active requests" value={formatNumber(stats.activeRequests)} icon={<ClipboardList className="h-5 w-5" />} tone="info" />
        <MetricCard label="Items delivered" value={formatNumber(stats.itemsDelivered)} icon={<Boxes className="h-5 w-5" />} tone="accent" />
        <MetricCard label="Pending verification" value={stats.pendingVerification} href="/admin/verifications" icon={<ShieldAlert className="h-5 w-5" />} tone="accent" />
        <MetricCard label="Pending requests" value={stats.pendingRequests} href="/admin/requests?status=PENDING_VERIFICATION" icon={<ClipboardList className="h-5 w-5" />} tone="accent" />
        <MetricCard label="Active donations" value={stats.activeDonations} href="/admin/donations" icon={<HandHeart className="h-5 w-5" />} tone="info" />
        <MetricCard label="Completed donations" value={formatNumber(stats.completedDonations)} icon={<CheckCircle2 className="h-5 w-5" />} tone="success" hint={stats.openReports ? `${stats.openReports} open report(s) to investigate` : undefined} />
      </section>

      {data && (
        <>
          <h2 className="mb-4 mt-10 text-xl font-semibold">Monthly impact</h2>
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
            {[
              ["Items donated", data.monthlyImpact.itemsDonated],
              ["Families supported", data.monthlyImpact.familiesSupported],
              ["Organisations supported", data.monthlyImpact.organizationsSupported],
              ["Children reached", data.monthlyImpact.childrenReached],
              ["Meals provided (kg/units)", data.monthlyImpact.mealsProvided],
            ].map(([l, v]) => (
              <div key={l as string} className="rounded-2xl border border-line bg-surface-2 p-4">
                <dt className="text-xs text-muted">{l}</dt>
                <dd className="mt-1 font-display text-2xl font-semibold tabular-nums">{formatNumber(v as number)}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-6"><AnalyticsPanels data={data} /></div>
        </>
      )}

      {activity.length > 0 && (
        <section className="card mt-8 p-5 sm:p-6" aria-labelledby="ra">
          <div className="flex items-center justify-between">
            <h2 id="ra" className="flex items-center gap-2 text-lg font-semibold"><Activity className="h-5 w-5 text-primary-ink" aria-hidden="true" /> Recent activity</h2>
            <Link href="/admin/audit-logs" className="text-sm font-semibold text-primary-ink hover:underline">Audit log</Link>
          </div>
          <ul className="mt-4 divide-y divide-line">
            {activity.map((a) => (
              <li key={a.id} className="flex flex-wrap justify-between gap-2 py-2.5 text-sm">
                <span><span className="font-semibold">{a.actorLabel}</span> <span className="text-muted">{a.action.replace(/_/g, " ").toLowerCase()}</span> {a.targetId && <span className="font-mono text-xs text-subtle">{a.targetId}</span>}</span>
                <span className="text-subtle">{formatDateTime(a.createdAt)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
