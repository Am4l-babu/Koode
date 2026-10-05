import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarDays, MapPin, RefreshCw, Truck } from "lucide-react";
import { PageHeader } from "@/components/ui/card";
import { ProgressBar } from "@/components/ui/progress";
import { PrivacyBadge, UrgencyBadge, VerificationBadge, AnonymousIdentityBadge } from "@/components/brand/badges";
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
        <PageHeader eyebrow={`${category.icon} ${category.name}`} title={`${category.name} needs`} description={category.description ?? undefined} />
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
          <div className="flex flex-wrap items-center gap-2">
            <Link href={`/needs/${need.category.slug}`} className="inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-fg">
              <span aria-hidden="true">{need.category.icon}</span> {need.category.name}
            </Link>
            <UrgencyBadge priority={need.priority} />
            {need.recurrence !== "NONE" && (
              <span className="inline-flex items-center gap-1 rounded-full bg-info-soft px-2.5 py-1 text-xs font-semibold text-info">
                <RefreshCw className="h-3 w-3" aria-hidden="true" /> Recurring · {need.recurrence.toLowerCase()}
              </span>
            )}
          </div>

          <div>
            <AnonymousIdentityBadge kind="recipient" label={need.recipient.descriptor} sublabel={`Partner #${need.recipient.ref} · ${need.recipient.typeLabel}`} />
            <div className="mt-3"><PageHeader title={need.title} /></div>
          </div>

          <div className="card -mt-4 p-5 sm:p-6">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="font-display text-4xl font-semibold">{need.percent}%</p>
                <p className="text-sm text-muted">{STAGE_LABELS[need.stage]} · {need.totals.committed} / {need.totals.required} committed</p>
              </div>
              <VerificationBadge verified={need.recipient.verified} />
            </div>
            <ProgressBar value={need.percent} size="lg" className="mt-4" />
            <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-3">
              <div className="flex items-start gap-2">
                <MapPin className="mt-0.5 h-4 w-4 text-subtle" aria-hidden="true" />
                <div><dt className="text-subtle">Area</dt><dd className="font-semibold">{need.location.city ? `${need.location.city}, ` : ""}{need.location.district}</dd></div>
              </div>
              <div className="flex items-start gap-2">
                <CalendarDays className="mt-0.5 h-4 w-4 text-subtle" aria-hidden="true" />
                <div><dt className="text-subtle">Needed by</dt><dd className="font-semibold">{formatDate(need.neededBy)}{due && <span className="ml-1 font-normal text-muted">({due})</span>}</dd></div>
              </div>
              <div className="flex items-start gap-2">
                <Truck className="mt-0.5 h-4 w-4 text-subtle" aria-hidden="true" />
                <div><dt className="text-subtle">Delivery</dt><dd className="font-semibold">{need.deliveryMethods.map((m) => DELIVERY_METHOD_LABELS[m as keyof typeof DELIVERY_METHOD_LABELS]).join(" · ")}</dd></div>
              </div>
            </dl>
          </div>

          <section aria-labelledby="why" className="card p-5 sm:p-6">
            <h2 id="why" className="text-lg font-semibold">Why this is needed</h2>
            <p className="mt-3 whitespace-pre-line leading-relaxed text-fg">{need.description}</p>
            <p className="mt-4 text-sm text-muted">
              {need.recipient.descriptor}
              {need.recipient.focusArea ? ` · ${need.recipient.focusArea}` : ""}
              {need.recipient.verifiedSince ? ` · Verified since ${formatMonthYear(need.recipient.verifiedSince)}` : ""}
            </p>
          </section>

          <PrivacyBadge note="Recipient identity protected. The platform coordinates delivery so neither side ever sees the other's personal details." />
          <ReportButton requestId={need.id} />
        </div>

        <div className="lg:sticky lg:top-24 lg:self-start">
          <DonatePanel need={need} viewer={viewer} autoOpen={sp.donate === "1"} />
        </div>
      </div>
    </div>
  );
}
