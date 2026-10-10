import Link from "next/link";
import { Activity, Boxes, ChevronRight, ClipboardList, Flag, HandHeart, ShieldCheck, Users } from "lucide-react";
import { PageHeader } from "@/components/ui/card";
import { MetricCard } from "@/components/ui/metric";
import { Callout } from "@/components/ui/states";
import { ChartCard } from "@/components/charts/chart-card";
import { LineChart } from "@/components/charts/line-chart";
import { DonutChart } from "@/components/charts/donut-chart";
import { requirePageUser } from "@/lib/auth/guards";
import { hasPermission, PERMISSION_LABELS } from "@/lib/permissions";
import { analytics, dashboardStats, recentActivity } from "@/services/admin";
import { formatDate, formatDateTime, formatNumber } from "@/lib/format";
import type { Permission } from "@prisma/client";

export const metadata = { title: "Dashboard" };
export const dynamic = "force-dynamic";

const monthLabel = (m: string) => new Date(`${m}-01T00:00:00Z`).toLocaleDateString("en-IN", { month: "short", timeZone: "UTC" });

function greeting(now = new Date()) {
  const hour = Number(now.toLocaleString("en-IN", { hour: "numeric", hour12: false, timeZone: "Asia/Kolkata" }));
  return hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
}

export default async function AdminDashboard({ searchParams }: { searchParams: Promise<{ denied?: string }> }) {
  const user = await requirePageUser(["ADMIN", "SUPER_ADMIN"]);
  const sp = await searchParams;
  const canAnalytics = hasPermission(user, "ANALYTICS_VIEW");
  const [stats, activity, data] = await Promise.all([dashboardStats(), hasPermission(user, "AUDIT_LOG_VIEW") ? recentActivity() : Promise.resolve([]), canAnalytics ? analytics() : Promise.resolve(null)]);

  const pending = [
    { label: "Organisations", value: stats.pendingVerification, href: "/admin/verifications", icon: ShieldCheck },
    { label: "Requests", value: stats.pendingRequests, href: "/admin/requests?status=PENDING_VERIFICATION", icon: ClipboardList },
    { label: "Active donations", value: stats.activeDonations, href: "/admin/donations", icon: HandHeart },
    { label: "Open reports", value: stats.openReports, href: "/admin/requests", icon: Flag },
  ];

  return (
    <>
      <PageHeader
        title="Admin Dashboard"
        description={`${greeting()}, ${user.role === "SUPER_ADMIN" ? "Super Admin" : "Admin"}.`}
        actions={<span className="rounded-full border border-line bg-surface px-3 py-1.5 text-sm font-medium text-muted">{formatDate(new Date())}</span>}
      />
      {sp.denied && (
        <div className="mb-6">
          <Callout tone="warning" title="You don't have access to that area">It requires the “{PERMISSION_LABELS[sp.denied as Permission] ?? sp.denied}” permission. Ask a super admin if you need it.</Callout>
        </div>
      )}
      <section aria-label="Key figures" className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <MetricCard label="Total donors" value={formatNumber(stats.totalDonors)} icon={<Users className="h-5 w-5" />} />
        <MetricCard label="Verified recipients" value={formatNumber(stats.verifiedRecipients)} icon={<ShieldCheck className="h-5 w-5" />} tone="success" />
        <MetricCard label="Active requests" value={formatNumber(stats.activeRequests)} icon={<ClipboardList className="h-5 w-5" />} tone="info" />
        <MetricCard label="Items delivered" value={formatNumber(stats.itemsDelivered)} icon={<Boxes className="h-5 w-5" />} tone="accent" hint={`${formatNumber(stats.completedDonations)} donations completed`} />
      </section>

      {data && (
        <div className="mt-6 grid gap-5 xl:grid-cols-3">
          <ChartCard title="Donations over time" description="Items per month, excluding cancelled donations" className="xl:col-span-2" table={{ columns: ["Month", "Items", "Donations"], rows: data.series.map((s) => [monthLabel(s.month), s.items, s.donations]) }}>
            <LineChart data={data.series.map((s) => ({ label: monthLabel(s.month), value: s.items, detail: `${s.donations} donations` }))} valueLabel="items" />
          </ChartCard>
          <ChartCard title="Donations by category" description="Items, last 6 months" table={{ columns: ["Category", "Items"], rows: data.byCategory.map((c) => [c.name, c.items]) }}>
            <DonutChart data={data.byCategory.map((c) => ({ key: c.slug, label: c.name, value: c.items }))} centerLabel="items" />
          </ChartCard>
        </div>
      )}

      <div className="mt-6 grid gap-5 xl:grid-cols-3">
        {activity.length > 0 && (
          <section className="card p-5 sm:p-6 xl:col-span-2" aria-labelledby="ra">
            <div className="flex items-center justify-between">
              <h2 id="ra" className="flex items-center gap-2 text-lg font-semibold"><Activity className="h-5 w-5 text-primary-ink" aria-hidden="true" /> Recent activity</h2>
              <Link href="/admin/audit-logs" className="text-sm font-semibold text-primary-ink hover:underline">Audit log</Link>
            </div>
            <ul className="mt-4 divide-y divide-line">
              {activity.map((a) => (
                <li key={a.id} className="flex items-start gap-3 py-3 text-sm">
                  <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" aria-hidden="true" />
                  <div className="min-w-0 flex-1">
                    <p><span className="font-semibold">{a.actorLabel}</span> <span className="text-muted">{a.action.replace(/_/g, " ").toLowerCase()}</span> {a.targetId && <span className="font-mono text-xs text-subtle">{a.targetId}</span>}</p>
                    <p className="text-xs text-subtle">{formatDateTime(a.createdAt)}</p>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}
        <section className="card p-5 sm:p-6" aria-labelledby="pr">
          <h2 id="pr" className="text-lg font-semibold">Pending Reviews</h2>
          <ul className="mt-3 divide-y divide-line">
            {pending.map((p) => (
              <li key={p.label}>
                <Link href={p.href} className="flex items-center gap-3 py-3 hover:text-primary-ink">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-surface-2 text-muted" aria-hidden="true"><p.icon className="h-4 w-4" /></span>
                  <span className="flex-1 text-sm font-medium">{p.label}</span>
                  <span className={p.value ? "rounded-full bg-accent-soft px-2.5 py-0.5 text-sm font-bold text-accent-ink" : "text-sm text-subtle"}>{p.value}</span>
                  <ChevronRight className="h-4 w-4 text-subtle" aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </>
  );
}
