import Link from "next/link";
import { BadgeCheck, ClipboardList, Clock, PackageCheck, Percent, UserRound } from "lucide-react";
import { PageHeader } from "@/components/ui/card";
import { MetricCard } from "@/components/ui/metric";
import { ButtonLink } from "@/components/ui/button";
import { ProgressBar } from "@/components/ui/progress";
import { Callout } from "@/components/ui/states";
import { Badge } from "@/components/ui/badge";
import { UrgencyBadge } from "@/components/brand/badges";
import { CategoryArt } from "@/components/brand/category-visual";
import { StatusPill } from "@/components/donations/tracker";
import { requirePageUser } from "@/lib/auth/guards";
import { listOwnRequests } from "@/services/requests";
import { listRecipientDonations } from "@/services/donations";
import { getOwnOrganization } from "@/services/organizations";
import { REQUEST_STATUS_LABELS, VERIFICATION_STATUS_LABELS } from "@/lib/descriptors";
import { daysLeft, formatDate } from "@/lib/format";

export const metadata = { title: "Organisation dashboard" };

function greeting(now = new Date()) {
  const hour = Number(now.toLocaleString("en-IN", { hour: "numeric", hour12: false, timeZone: "Asia/Kolkata" }));
  return hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
}

export default async function RecipientDashboard() {
  const user = await requirePageUser(["RECIPIENT"]);
  const [org, requests, donations] = await Promise.all([getOwnOrganization(user), listOwnRequests(user), listRecipientDonations(user)]);
  const active = requests.filter((r) => r.status === "ACTIVE");
  const received = requests.reduce((s, r) => s + r.received, 0);
  const live = requests.filter((r) => ["ACTIVE", "FULFILLED"].includes(r.status));
  const required = live.reduce((s, r) => s + r.totals.required, 0);
  const fulfilment = required ? Math.round((live.reduce((s, r) => s + r.totals.committed, 0) / required) * 100) : 0;
  const verified = org.verificationStatus === "VERIFIED";

  return (
    <>
      <PageHeader
        title={`${greeting()},`}
        description={
          <span className="flex flex-wrap items-center gap-2">
            {org.publicDescriptor}
            {verified && <Badge tone="success" icon={<BadgeCheck className="h-3.5 w-3.5" aria-hidden="true" />}>Verified</Badge>}
            <span className="text-subtle">· Partner #{org.publicId} · {org.district}</span>
          </span>
        }
        actions={<ButtonLink href="/recipient/requests/new">Create request</ButtonLink>}
      />
      {!verified && (
        <div className="mb-6">
          <Callout tone="warning" title={`Verification: ${VERIFICATION_STATUS_LABELS[org.verificationStatus]}`}>
            You can prepare requests now; they will be published once your organisation is verified. <Link href="/recipient/verification" className="font-semibold text-primary-ink underline">Complete verification →</Link>
          </Callout>
        </div>
      )}
      <section aria-label="Overview" className="grid gap-4 sm:grid-cols-3">
        <MetricCard label="Active requests" value={active.length} icon={<ClipboardList className="h-5 w-5" />} />
        <MetricCard label="Items received" value={received} icon={<PackageCheck className="h-5 w-5" />} tone="accent" />
        <MetricCard label="Fulfilment rate" value={`${fulfilment}%`} icon={<Percent className="h-5 w-5" />} tone="success" />
      </section>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.3fr_1fr]">
        <section className="card p-5 sm:p-6" aria-labelledby="req">
          <div className="flex items-center justify-between">
            <h2 id="req" className="text-lg font-semibold">Recent Requests</h2>
            <Link href="/recipient/requests" className="text-sm font-semibold text-primary-ink hover:underline">View all</Link>
          </div>
          {requests.length ? (
            <ul className="mt-4 space-y-3">
              {requests.slice(0, 5).map((r) => {
                const due = r.status === "ACTIVE" ? daysLeft(r.neededBy) : null;
                return (
                  <li key={r.id}>
                    <Link href={`/recipient/requests/${r.id}`} className="flex items-center gap-4 rounded-2xl border border-line p-3 transition-colors hover:border-line-strong hover:bg-surface-2">
                      <CategoryArt slug={r.category.slug} emoji={r.category.icon} size="sm" className="h-14 w-14 shrink-0 rounded-xl" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold">{r.title}</p>
                        <p className="text-xs text-muted">{r.totals.committed}/{r.totals.required} fulfilled · {REQUEST_STATUS_LABELS[r.status as keyof typeof REQUEST_STATUS_LABELS]}</p>
                        <ProgressBar value={r.percent} size="sm" className="mt-2 max-w-56" label={`${r.title}: ${r.percent}%`} />
                      </div>
                      <div className="hidden shrink-0 flex-col items-end gap-1.5 sm:flex">
                        <UrgencyBadge priority={r.priority} />
                        {due && <span className="inline-flex items-center gap-1 text-xs text-muted"><Clock className="h-3.5 w-3.5" aria-hidden="true" /> {due}</span>}
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="mt-4 text-muted">No requests yet.</p>
          )}
        </section>

        <section className="card p-5 sm:p-6" aria-labelledby="inc">
          <div className="flex items-center justify-between">
            <h2 id="inc" className="text-lg font-semibold">Recent Donations</h2>
            <Link href="/recipient/donations" className="text-sm font-semibold text-primary-ink hover:underline">View all</Link>
          </div>
          {donations.length ? (
            <ul className="mt-4 divide-y divide-line">
              {donations.slice(0, 5).map((d) => (
                <li key={d.id}>
                  <Link href="/recipient/donations" className="flex items-center gap-3 py-3 hover:text-primary-ink">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary-ink" aria-hidden="true">
                      <UserRound className="h-5 w-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{d.items.map((i) => `${i.quantity} × ${i.name}`).join(", ")}</p>
                      <p className="truncate text-xs text-muted">{d.donor.displayName} · {formatDate(d.createdAt, { year: undefined })}</p>
                    </div>
                    <StatusPill status={d.status} />
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 text-muted">No donations yet. You&apos;ll be notified as soon as a donor commits items.</p>
          )}
        </section>
      </div>
    </>
  );
}
