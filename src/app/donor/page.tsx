import Link from "next/link";
import { Boxes, Building2, HandHeart } from "lucide-react";
import { PageHeader } from "@/components/ui/card";
import { MetricCard } from "@/components/ui/metric";
import { ButtonLink } from "@/components/ui/button";
import { ProgressBar } from "@/components/ui/progress";
import { Callout, EmptyState } from "@/components/ui/states";
import { CategoryArt } from "@/components/brand/category-visual";
import { NeedCard } from "@/components/needs/need-card";
import { StatusPill } from "@/components/donations/tracker";
import { requirePageUser } from "@/lib/auth/guards";
import { donorImpact, listDonorDonations } from "@/services/donations";
import { recommendationsFor } from "@/services/requests";
import { DONATION_STATUS_FLOW } from "@/lib/descriptors";
import { formatDate, formatNumber } from "@/lib/format";
import { cn } from "@/components/ui/cn";
import type { DonationStatus } from "@prisma/client";

export const metadata = { title: "Donor dashboard" };

/** How far along its journey a donation is, for the small progress bar. */
const journey = (status: string) => Math.round((Math.max(0, DONATION_STATUS_FLOW.indexOf(status as DonationStatus)) / (DONATION_STATUS_FLOW.length - 1)) * 100);

export default async function DonorDashboard({ searchParams }: { searchParams: Promise<{ welcome?: string }> }) {
  const user = await requirePageUser(["DONOR"]);
  const [impact, donations, recs, sp] = await Promise.all([donorImpact(user), listDonorDonations(user), recommendationsFor(user), searchParams]);
  const active = donations.filter((d) => !["COMPLETED", "CANCELLED"].includes(d.status)).slice(0, 4);

  return (
    <>
      <PageHeader
        title="Welcome back, Donor!"
        description="Together we can make a difference."
        actions={<ButtonLink href="/needs">Browse needs</ButtonLink>}
      />
      {sp.welcome && <div className="mb-6"><Callout tone="success" title="Your donor account is ready 🎉">We&apos;ve sent a confirmation link to your email. You can start browsing needs right away.</Callout></div>}
      {!user.emailVerified && !sp.welcome && <div className="mb-6"><Callout tone="warning" title="Please confirm your email">Check your inbox for the confirmation link so we can send donation updates.</Callout></div>}

      <section aria-label="Your impact" className="grid gap-4 sm:grid-cols-3">
        <MetricCard label="Requests supported" value={impact.requests} icon={<HandHeart className="h-5 w-5" />} />
        <MetricCard label="Items contributed" value={impact.items} icon={<Boxes className="h-5 w-5" />} tone="accent" />
        <MetricCard label="Organisations helped" value={impact.organizations} icon={<Building2 className="h-5 w-5" />} tone="success" />
      </section>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <section className="card p-5 sm:p-6" aria-labelledby="active">
          <div className="flex items-center justify-between">
            <h2 id="active" className="text-lg font-semibold">Active Donations</h2>
            <Link href="/donor/donations" className="text-sm font-semibold text-primary-ink hover:underline">View all</Link>
          </div>
          {active.length ? (
            <ul className="mt-4 space-y-3">
              {active.map((d) => {
                const count = d.items.reduce((s, i) => s + i.quantity, 0);
                return (
                  <li key={d.id}>
                    <Link href={`/donor/donations/${d.id}`} className="flex items-center gap-4 rounded-2xl border border-line p-3 transition-colors hover:border-line-strong hover:bg-surface-2">
                      <CategoryArt slug={d.request.category.slug} emoji={d.request.category.icon} size="sm" className="h-14 w-14 shrink-0 rounded-xl" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold">{d.items.map((i) => i.name).join(", ")}</p>
                        <p className="font-mono text-xs text-muted">Donation #{d.id}</p>
                        <ProgressBar value={journey(d.status)} size="sm" className="mt-2 max-w-48" label={`Donation #${d.id} progress`} />
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1.5">
                        <StatusPill status={d.status} />
                        <span className="text-xs text-muted">{count} item{count === 1 ? "" : "s"}</span>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="mt-4 text-muted">No active donations. When you commit to a need, you can follow it here.</p>
          )}
        </section>

        <section className="card relative overflow-hidden p-5 sm:p-6" aria-labelledby="impact">
          <h2 id="impact" className="text-lg font-semibold">Your Impact</h2>
          <dl className="mt-4 grid grid-cols-3 gap-3">
            {[
              [impact.requests, "requests"],
              [impact.items, "items given"],
              [impact.organizations, "organisations"],
            ].map(([v, l]) => (
              <div key={l as string} className="flex flex-col-reverse">
                <dt className="text-xs text-muted">{l}</dt>
                <dd className="font-display text-3xl font-semibold tabular-nums">{formatNumber(v as number)}</dd>
              </div>
            ))}
          </dl>
          <h3 className="mt-6 text-sm font-semibold">Milestones</h3>
          <ul className="relative z-10 mt-2 grid grid-cols-2 gap-2">
            {impact.milestones.map((m) => (
              <li key={m.key} className={cn("rounded-xl border px-3 py-2 text-sm", m.achieved ? "border-secondary/40 bg-secondary-soft font-semibold text-secondary-ink" : "border-line text-subtle")}>
                {m.achieved ? "🏅 " : "○ "}{m.label}
              </li>
            ))}
          </ul>
          <svg className="pointer-events-none absolute -right-4 -top-2 h-28 w-28 opacity-80" viewBox="0 0 100 100" aria-hidden="true">
            <path d="M50 95 C50 70 50 50 50 30" stroke="var(--secondary-ink)" strokeWidth="3" fill="none" strokeLinecap="round" />
            <path d="M50 55 C30 55 18 42 16 24 C34 24 48 36 50 55 Z" fill="var(--secondary)" opacity="0.75" />
            <path d="M50 42 C68 42 82 30 84 12 C66 12 52 24 50 42 Z" fill="var(--primary)" opacity="0.7" />
            <path d="M50 70 C66 70 78 62 82 50 C66 48 54 56 50 70 Z" fill="var(--secondary)" opacity="0.55" />
          </svg>
        </section>
      </div>

      <section className="mt-10" aria-labelledby="recs">
        <h2 id="recs" className="text-2xl font-semibold">Needs you can fulfil</h2>
        <p className="mt-1 text-muted">{recs.reason}</p>
        <div className="mt-5">
          {recs.items.length ? (
            <div className="grid gap-5 md:grid-cols-2 2xl:grid-cols-3">{recs.items.slice(0, 3).map((n, i) => <NeedCard key={n.id} need={n} index={i} />)}</div>
          ) : (
            <EmptyState title="Nothing urgent right now — but there are still people who need a helping hand." action={<ButtonLink href="/needs">Browse all needs</ButtonLink>} />
          )}
        </div>
      </section>
      {donations.length > 0 && <p className="mt-8 text-sm text-muted">Last donation: {formatDate(donations[0]!.createdAt)}</p>}
    </>
  );
}
