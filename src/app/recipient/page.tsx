import Link from "next/link";
import { ClipboardList, Inbox, PackageCheck, Truck } from "lucide-react";
import { PageHeader } from "@/components/ui/card";
import { MetricCard } from "@/components/ui/metric";
import { ButtonLink } from "@/components/ui/button";
import { ProgressBar } from "@/components/ui/progress";
import { Callout, EmptyState } from "@/components/ui/states";
import { PrivacyBadge } from "@/components/brand/badges";
import { RecipientDonationList } from "@/components/recipient/donation-list";
import { requirePageUser } from "@/lib/auth/guards";
import { listOwnRequests } from "@/services/requests";
import { listRecipientDonations } from "@/services/donations";
import { getOwnOrganization } from "@/services/organizations";
import { REQUEST_STATUS_LABELS, VERIFICATION_STATUS_LABELS } from "@/lib/descriptors";

export const metadata = { title: "Organisation dashboard" };

export default async function RecipientDashboard() {
  const user = await requirePageUser(["RECIPIENT"]);
  const [org, requests, donations] = await Promise.all([getOwnOrganization(user), listOwnRequests(user), listRecipientDonations(user)]);
  const active = requests.filter((r) => r.status === "ACTIVE");
  const committed = requests.reduce((s, r) => s + r.totals.committed, 0);
  const received = requests.reduce((s, r) => s + r.received, 0);
  const incoming = donations.filter((d) => ["CONFIRMED", "PREPARING", "IN_TRANSIT"].includes(d.status));

  return (
    <>
      <PageHeader eyebrow={org.publicDescriptor} title="Organisation dashboard" description={`Partner #${org.publicId} · ${org.district}`} actions={<ButtonLink href="/recipient/requests/new">Create request</ButtonLink>} />
      {org.verificationStatus !== "VERIFIED" && (
        <div className="mb-6">
          <Callout tone="warning" title={`Verification: ${VERIFICATION_STATUS_LABELS[org.verificationStatus]}`}>
            You can prepare requests now; they will be published once your organisation is verified. <Link href="/recipient/verification" className="font-semibold text-primary-ink underline">Complete verification →</Link>
          </Callout>
        </div>
      )}
      <section aria-label="Overview" className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <MetricCard label="Active requests" value={active.length} icon={<ClipboardList className="h-5 w-5" />} />
        <MetricCard label="Items committed" value={committed} icon={<Inbox className="h-5 w-5" />} tone="info" />
        <MetricCard label="Items received" value={received} icon={<PackageCheck className="h-5 w-5" />} tone="success" />
        <MetricCard label="Incoming donations" value={incoming.length} icon={<Truck className="h-5 w-5" />} tone="accent" />
      </section>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_1.2fr]">
        <section className="card p-5 sm:p-6" aria-labelledby="req">
          <div className="flex items-center justify-between"><h2 id="req" className="text-lg font-semibold">Fulfilment progress</h2><Link href="/recipient/requests" className="text-sm font-semibold text-primary-ink hover:underline">All requests</Link></div>
          {requests.length ? (
            <ul className="mt-4 space-y-4">
              {requests.slice(0, 5).map((r) => (
                <li key={r.id}>
                  <Link href={`/recipient/requests/${r.id}`} className="block rounded-xl p-2 hover:bg-surface-2">
                    <div className="flex justify-between gap-2 text-sm"><span className="font-semibold">{r.title}</span><span className="text-muted">{REQUEST_STATUS_LABELS[r.status as keyof typeof REQUEST_STATUS_LABELS]}</span></div>
                    <ProgressBar value={r.percent} size="sm" className="mt-2" label={`${r.title}: ${r.percent}%`} />
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 text-muted">No requests yet.</p>
          )}
        </section>
        <section aria-labelledby="inc">
          <h2 id="inc" className="mb-3 text-lg font-semibold">Incoming donations</h2>
          {incoming.length ? <RecipientDonationList donations={incoming.slice(0, 5)} /> : <EmptyState illustration="bell" title="No donations on the way right now" description="You'll be notified as soon as an anonymous donor commits items." />}
        </section>
      </div>
      <PrivacyBadge className="mt-8" note="Donor identities are never shared with your organisation, and your details are never shown to donors." />
    </>
  );
}
