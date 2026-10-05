import Link from "next/link";
import { ArrowRight, BadgeCheck, HeartHandshake, Lock, Sparkles } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/states";
import { HeroVisual } from "@/components/brand/hero-visual";
import { NeedCard } from "@/components/needs/need-card";
import { CategoryTile, HowItWorksSteps, PrivacyComparison, Section } from "@/components/marketing/sections";
import { CountUp } from "@/components/marketing/count-up";
import { getDictionary } from "@/lib/i18n/server";
import { browseRequests, categoryCounts, listCategories } from "@/services/requests";
import { publicImpact } from "@/services/impact";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [t, urgent, categories, counts, impact] = await Promise.all([
    getDictionary(),
    browseRequests({ sort: "urgent", pageSize: 3 }),
    listCategories(),
    categoryCounts(),
    publicImpact(),
  ]);

  return (
    <>
      {/* Hero */}
      <section className="hero-glow relative overflow-hidden">
        <div className="grain pointer-events-none absolute inset-0 opacity-40" aria-hidden="true" />
        <div className="relative mx-auto grid max-w-7xl items-center gap-10 px-4 pb-16 pt-12 sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:pb-24 lg:pt-20">
          <div className="animate-rise">
            <p className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1.5 text-sm font-semibold text-primary-ink shadow-soft">
              <Sparkles className="h-4 w-4 text-accent" aria-hidden="true" /> {t.hero.eyebrow}
            </p>
            <h1 className="mt-6 text-[2.6rem] font-semibold leading-[1.05] sm:text-6xl">
              {t.hero.title1}
              <br />
              <span className="bg-[linear-gradient(100deg,var(--primary),color-mix(in_oklab,var(--primary)_40%,var(--secondary)))] bg-clip-text text-transparent">
                {t.hero.title2}
              </span>
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted sm:text-xl">{t.hero.lead}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <ButtonLink href="/needs" size="lg" icon={<HeartHandshake className="h-5 w-5" aria-hidden="true" />}>
                {t.hero.ctaHelp}
              </ButtonLink>
              <ButtonLink href="/register?role=recipient" size="lg" variant="outline">
                {t.hero.ctaRequest}
              </ButtonLink>
              <ButtonLink href="/how-it-works" size="lg" variant="ghost">
                {t.hero.ctaHow} <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </ButtonLink>
            </div>
            <ul className="mt-10 flex flex-wrap gap-x-6 gap-y-3 text-sm text-muted">
              <li className="flex items-center gap-2"><BadgeCheck className="h-4 w-4 text-secondary-ink" aria-hidden="true" /> Every organisation verified</li>
              <li className="flex items-center gap-2"><Lock className="h-4 w-4 text-primary-ink" aria-hidden="true" /> Identities kept confidential</li>
              <li className="flex items-center gap-2"><span aria-hidden="true">🎁</span> Give the items people actually need</li>
            </ul>
          </div>
          <HeroVisual />
        </div>
      </section>

      {/* Categories */}
      <Section id="categories" eyebrow="Browse by need" title="Give exactly what is needed" lead="Verified partners post specific requirements — sizes, ages and quantities — so every gift is useful.">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {categories.slice(0, 8).map((c) => (
            <CategoryTile key={c.id} slug={c.slug} name={c.name} icon={c.icon} count={counts[c.id] ?? 0} />
          ))}
        </div>
      </Section>

      {/* Urgent needs */}
      <Section id="urgent" eyebrow="Right now" title="Time-sensitive needs" className="pt-0">
        {urgent.items.length ? (
          <>
            <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {urgent.items.map((n, i) => <NeedCard key={n.id} need={n} index={i} />)}
            </div>
            <div className="mt-8 text-center">
              <ButtonLink href="/needs" variant="outline">{t.common.browseAll} <ArrowRight className="h-4 w-4" aria-hidden="true" /></ButtonLink>
            </div>
          </>
        ) : (
          <EmptyState
            title="There are no urgent needs at the moment, but many organisations would still welcome your support."
            action={<ButtonLink href="/needs">{t.common.browseAll}</ButtonLink>}
          />
        )}
      </Section>

      {/* How it works */}
      <div className="bg-bg-tint">
        <Section id="how" eyebrow={t.nav.how} title={t.how.title} lead={t.how.lead}>
          <HowItWorksSteps t={t} />
        </Section>
      </div>

      {/* Privacy */}
      <Section id="privacy" eyebrow="Our commitment" title="Privacy is built into every layer" lead="Personal details are kept separate from donations in the database, the API and the interface. Only a small number of authorised administrators can link a donation to a person, and every such access is recorded in an audit log.">
        <PrivacyComparison />
      </Section>

      {/* Impact strip */}
      <section aria-label="Community impact" className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="relative overflow-hidden rounded-[2rem] bg-primary px-6 py-12 text-primary-fg sm:px-12">
          <div className="grain absolute inset-0 opacity-20" aria-hidden="true" />
          <dl className="relative grid grid-cols-2 gap-8 lg:grid-cols-4">
            {[
              [impact.itemsDonated, "", "Items donated"],
              [impact.peopleSupported, "", "People supported"],
              [impact.verifiedOrganizations, "", "Verified organisations"],
              [impact.fulfillmentRate, "%", "Requests fulfilled"],
            ].map(([v, s, l]) => (
              <div key={l as string}>
                <dt className="text-sm opacity-80">{l}</dt>
                <dd className="mt-1 font-display text-4xl font-semibold sm:text-5xl"><CountUp value={v as number} suffix={s as string} /></dd>
              </div>
            ))}
          </dl>
          <div className="relative mt-10 flex flex-wrap items-center justify-between gap-4 border-t border-white/20 pt-8">
            <p className="max-w-lg text-lg">Run a school, shelter or care home? Request exactly what you need. Your organisation&apos;s details remain confidential.</p>
            <Link href="/register?role=recipient" className="inline-flex h-12 items-center gap-2 rounded-full bg-accent px-6 font-semibold text-[#2a1a00] hover:brightness-105">
              {t.hero.ctaRequest} <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
