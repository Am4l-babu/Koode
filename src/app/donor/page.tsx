import Link from "next/link";
import { Award, Boxes, Building2, HandHeart } from "lucide-react";
import { PageHeader } from "@/components/ui/card";
import { MetricCard } from "@/components/ui/metric";
import { ButtonLink } from "@/components/ui/button";
import { Callout, EmptyState } from "@/components/ui/states";
import { AnonymousIdentityBadge, PrivacyBadge } from "@/components/brand/badges";
import { NeedCard } from "@/components/needs/need-card";
import { StatusPill } from "@/components/donations/tracker";
import { requirePageUser } from "@/lib/auth/guards";
import { donorImpact, listDonorDonations } from "@/services/donations";
import { recommendationsFor } from "@/services/requests";
import { formatDate } from "@/lib/format";
import { cn } from "@/components/ui/cn";

export const metadata = { title: "Donor dashboard" };

export default async function DonorDashboard({ searchParams }: { searchParams: Promise<{ welcome?: string }> }) {
  const user = await requirePageUser(["DONOR"]);
  const [impact, donations, recs, sp] = await Promise.all([donorImpact(user), listDonorDonations(user), recommendationsFor(user), searchParams]);
  const active = donations.filter((d) => !["COMPLETED", "CANCELLED"].includes(d.status)).slice(0, 4);

  return (
    <>
      <PageHeader
        eyebrow="Dashboard"
        title={<>Welcome, Community Donor</>}
        description="Thank you for supporting verified community needs."
        actions={<ButtonLink href="/needs">Browse needs</ButtonLink>}
      />
      {sp.welcome && <div className="mb-6"><Callout tone="success" title="Your donor account is ready 🎉">We&apos;ve sent a confirmation link to your email. You can start browsing needs right away.</Callout></div>}
      {!user.emailVerified && !sp.welcome && <div className="mb-6"><Callout tone="warning" title="Please confirm your email">Check your inbox for the confirmation link so we can send donation updates.</Callout></div>}

      <section aria-label="Your impact" className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <MetricCard label="Requests supported" value={impact.requests} icon={<HandHeart className="h-5 w-5" />} />
        <MetricCard label="Items contributed" value={impact.items} icon={<Boxes className="h-5 w-5" />} tone="success" />
        <MetricCard label="Organisations helped" value={impact.organizations} icon={<Building2 className="h-5 w-5" />} tone="info" />
        <MetricCard label="Milestones" value={`${impact.milestones.filter((m) => m.achieved).length}/${impact.milestones.length}`} icon={<Award className="h-5 w-5" />} tone="accent" />
      </section>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <section className="card p-5 sm:p-6" aria-labelledby="active">
          <div className="flex items-center justify-between">
            <h2 id="active" className="text-lg font-semibold">Active donations</h2>
            <Link href="/donor/donations" className="text-sm font-semibold text-primary-ink hover:underline">View all</Link>
          </div>
          {active.length ? (
            <ul className="mt-4 divide-y divide-line">
              {active.map((d) => (
                <li key={d.id}>
                  <Link href={`/donor/donations/${d.id}`} className="flex items-center justify-between gap-3 py-3 hover:text-primary-ink">
                    <div className="min-w-0">
                      <p className="font-mono text-sm font-semibold">#{d.id}</p>
                      <p className="truncate text-sm text-muted">{d.items.map((i) => `${i.quantity} × ${i.name}`).join(", ")} → {d.recipient.descriptor}</p>
                    </div>
                    <StatusPill status={d.status} />
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 text-muted">No active donations. When you commit to a need, you can follow it here.</p>
          )}
        </section>

        <section className="card p-5 sm:p-6" aria-labelledby="ms">
          <h2 id="ms" className="text-lg font-semibold">Your anonymous profile</h2>
          <div className="mt-4"><AnonymousIdentityBadge label="Community Donor" sublabel="Recipients see a different anonymous reference per organisation" /></div>
          <ul className="mt-5 grid grid-cols-2 gap-2">
            {impact.milestones.map((m) => (
              <li key={m.key} className={cn("rounded-xl border px-3 py-2 text-sm", m.achieved ? "border-secondary/40 bg-secondary-soft font-semibold text-secondary-ink" : "border-line text-subtle")}>
                {m.achieved ? "🏅 " : "○ "}{m.label}
              </li>
            ))}
          </ul>
          <p className="mt-4 text-xs text-muted">Milestones are private to you — there are no public leaderboards.</p>
        </section>
      </div>

      <section className="mt-10" aria-labelledby="recs">
        <h2 id="recs" className="text-2xl font-semibold">Needs you can fulfil</h2>
        <p className="mt-1 text-muted">{recs.reason}</p>
        <div className="mt-5">
          {recs.items.length ? (
            <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">{recs.items.slice(0, 3).map((n, i) => <NeedCard key={n.id} need={n} index={i} />)}</div>
          ) : (
            <EmptyState title="Nothing urgent right now — but there are still people who need a helping hand." action={<ButtonLink href="/needs">Browse all needs</ButtonLink>} />
          )}
        </div>
      </section>
      {donations.length > 0 && <p className="mt-8 text-sm text-muted">Last donation: {formatDate(donations[0]!.createdAt)}</p>}
      <PrivacyBadge className="mt-6" note="Your identity is never shared with recipients." />
    </>
  );
}
