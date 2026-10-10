import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, BadgeCheck, Building2, CalendarDays, MapPin, RefreshCw, Truck } from "lucide-react";
import { PageHeader } from "@/components/ui/card";
import { ProgressBar } from "@/components/ui/progress";
import { UrgencyBadge } from "@/components/brand/badges";
import { CategoryArt, CategoryIcon } from "@/components/brand/category-visual";
import { remainingSummary } from "@/components/needs/need-card";
import { BrowseView } from "@/components/needs/browse-view";
import { DonatePanel } from "@/components/needs/donate-panel";
import { ReportButton } from "@/components/needs/report-button";
import { getCurrentUser } from "@/lib/auth/guards";
import { getPublicRequest, listCategories, recordView } from "@/services/requests";
import { parseBrowseParams } from "@/lib/validation/browse";
import { isPublicId } from "@/lib/ids";
import { AppError } from "@/lib/errors";
import { DELIVERY_METHOD_LABELS } from "@/lib/descriptors";
import { STAGE_LABELS } from "@/lib/fulfillment";
import { formatDate, formatMonthYear, relativeDays } from "@/lib/format";

type Params = { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

async function load(id: string) {
  try {
    return await getPublicRequest(id.toUpperCase());
  } catch (e) {
    if (e instanceof AppError && e.code === "NOT_FOUND") return null;
    throw e;
  }
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { id } = await params;
  const categories = await listCategories();
  const category = categories.find((c) => c.slug === id);
  if (category) {
    return { title: `${category.name} needs`, description: `Verified ${category.name.toLowerCase()} needs from community organisations. ${category.description ?? ""}`, alternates: { canonical: `/needs/${category.slug}` } };
  }
  if (!isPublicId(id.toUpperCase(), "request")) return { title: "Need not found" };
  const need = await load(id);
  if (!need) return { title: "Need not found" };
  return {
    title: need.title,
    description: `${need.recipient.descriptor} in ${need.location.district} needs ${need.items.map((i) => `${i.remaining} ${i.name.toLowerCase()}`).join(", ")}.`,
    alternates: { canonical: `/needs/${need.id}` },
  };
}

export default async function NeedPage({ params, searchParams }: Params) {
  const { id } = await params;
  const sp = await searchParams;

  // /needs/<category-slug> — SEO-friendly category listing.
  const categories = await listCategories();
  const category = categories.find((c) => c.slug === id);
  if (category) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
        <PageHeader eyebrow={<><CategoryIcon slug={category.slug} emoji={category.icon} className="h-7 w-7 rounded-lg" iconClassName="h-4 w-4" />Browse needs</>} title={`${category.name} needs`} description={category.description ?? undefined} />
        <BrowseView query={parseBrowseParams(sp)} basePath={`/needs/${category.slug}`} fixedCategory={category.slug} />
      </div>
    );
  }

  if (!isPublicId(id.toUpperCase(), "request")) notFound();
  const [need, user] = await Promise.all([load(id), getCurrentUser()]);
  if (!need) notFound();
  await recordView(need.id);
  const viewer = !user ? "guest" : user.role === "DONOR" ? "donor" : "other";
  const due = relativeDays(need.neededBy);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: need.title,
    description: need.description,
    about: { "@type": "Thing", name: need.category.name },
    contentLocation: { "@type": "Place", address: { "@type": "PostalAddress", addressRegion: need.location.district, addressCountry: "IN" } },
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <Link href="/needs" className="mb-6 inline-flex items-center gap-2 rounded-full px-2 py-1 text-sm font-semibold text-muted hover:text-fg">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back to needs
      </Link>

      <div className="grid gap-8 lg:grid-cols-[1.25fr_1fr]">
        <div className="space-y-6">
          <article className="card overflow-hidden" aria-labelledby="need-title">
            <CategoryArt slug={need.category.slug} emoji={need.category.icon} size="lg" className="h-56 sm:h-72">
              <div className="absolute right-4 top-4 flex flex-wrap justify-end gap-2">
                <Link href={`/needs/${need.category.slug}`} className="inline-flex items-center gap-1.5 rounded-full bg-surface/95 py-1 pl-1 pr-3 text-xs font-semibold text-fg shadow-soft hover:text-primary-ink">
                  <CategoryIcon slug={need.category.slug} emoji={need.category.icon} className="h-6 w-6 rounded-full" iconClassName="h-3.5 w-3.5" />
                  {need.category.name}
                </Link>
                <UrgencyBadge priority={need.priority} className="shadow-soft" />
                {need.recurrence !== "NONE" && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-info-soft px-2.5 py-1 text-xs font-semibold text-info shadow-soft">
                    <RefreshCw className="h-3 w-3" aria-hidden="true" /> Recurring · {need.recurrence.toLowerCase()}
                  </span>
                )}
              </div>
            </CategoryArt>

            <div className="p-5 sm:p-7">
              <p className="text-sm font-semibold text-primary-ink">{need.category.name}</p>
              <h1 id="need-title" className="mt-1 text-3xl font-semibold text-fg sm:text-4xl">{need.title}</h1>
              <p className="mt-2 text-muted">{remainingSummary(need)}</p>

              <div className="mt-5 flex items-center gap-4">
                <ProgressBar value={need.percent} size="lg" />
                <span className="shrink-0 text-sm font-semibold text-fg">{need.percent}% fulfilled</span>
              </div>
              <p className="mt-2 text-sm text-muted">{STAGE_LABELS[need.stage]} · {need.totals.committed} of {need.totals.required} committed</p>

              <dl className="mt-6 grid gap-4 border-t border-line pt-5 text-sm sm:grid-cols-3">
                <div className="flex items-start gap-2.5">
                  <BadgeCheck className="mt-0.5 h-5 w-5 shrink-0 text-secondary-ink" aria-hidden="true" />
                  <div>
                    <dt className="text-subtle">{need.recipient.verified ? "Verified organisation" : "Pending verification"}</dt>
                    <dd className="font-semibold">{need.recipient.descriptor}</dd>
                  </div>
                </div>
                <div className="flex items-start gap-2.5">
                  <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-subtle" aria-hidden="true" />
                  <div>
                    <dt className="text-subtle">Area</dt>
                    <dd className="font-semibold">{need.location.city ? `${need.location.city}, ` : ""}{need.location.district} District</dd>
                  </div>
                </div>
                <div className="flex items-start gap-2.5">
                  <CalendarDays className="mt-0.5 h-5 w-5 shrink-0 text-subtle" aria-hidden="true" />
                  <div>
                    <dt className="text-subtle">Needed by</dt>
                    <dd className="font-semibold">{formatDate(need.neededBy)}{due && <span className="ml-1 font-normal text-muted">({due})</span>}</dd>
                  </div>
                </div>
              </dl>
            </div>
          </article>

          <section aria-labelledby="why" className="card p-5 sm:p-7">
            <h2 id="why" className="text-lg font-semibold">About This Need</h2>
            <p className="mt-3 whitespace-pre-line leading-relaxed text-fg">{need.description}</p>
            <dl className="mt-5 grid gap-3 rounded-2xl bg-surface-2 p-4 text-sm sm:grid-cols-2">
              <div className="flex items-start gap-2">
                <Truck className="mt-0.5 h-4 w-4 text-subtle" aria-hidden="true" />
                <div><dt className="text-subtle">Delivery</dt><dd className="font-semibold">{need.deliveryMethods.map((m) => DELIVERY_METHOD_LABELS[m as keyof typeof DELIVERY_METHOD_LABELS]).join(" · ")}</dd></div>
              </div>
              <div className="flex items-start gap-2">
                <Building2 className="mt-0.5 h-4 w-4 text-subtle" aria-hidden="true" />
                <div>
                  <dt className="text-subtle">Partner #{need.recipient.ref}</dt>
                  <dd className="font-semibold">
                    {need.recipient.typeLabel}
                    {need.recipient.focusArea ? ` · ${need.recipient.focusArea}` : ""}
                    {need.recipient.verifiedSince ? <span className="block font-normal text-muted">Verified since {formatMonthYear(need.recipient.verifiedSince)}</span> : null}
                  </dd>
                </div>
              </div>
            </dl>
          </section>

          <ReportButton requestId={need.id} />
        </div>

        <div className="lg:sticky lg:top-24 lg:self-start">
          <DonatePanel need={need} viewer={viewer} autoOpen={sp.donate === "1"} />
        </div>
      </div>
    </div>
  );
}
