import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, BadgeCheck, MapPin } from "lucide-react";
import { CategoryArt } from "@/components/brand/category-visual";
import { DonationTracker, StatusPill } from "@/components/donations/tracker";
import { DonorDonationActions } from "@/components/donations/donor-actions";
import { DonationMediaManager } from "@/components/donations/media-manager";
import { CourierTrackingCard } from "@/components/donations/courier-tracking";
import { requirePageUser } from "@/lib/auth/guards";
import { getDonorDonation } from "@/services/donations";
import { AppError } from "@/lib/errors";
import { CONDITION_LABELS, DELIVERY_METHOD_LABELS } from "@/lib/descriptors";
import { formatDate, formatINR } from "@/lib/format";
import { describeAttributes } from "@/lib/categories";

export const metadata = { title: "Track donation" };

export default async function DonationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePageUser(["DONOR"]);
  const { id } = await params;
  const d = await getDonorDonation(user, id.toUpperCase()).catch((e) => {
    if (e instanceof AppError && e.code === "NOT_FOUND") return null;
    throw e;
  });
  if (!d) notFound();

  return (
    <>
      <Link href="/donor/donations" className="mb-5 inline-flex items-center gap-2 text-sm font-semibold text-muted hover:text-fg"><ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back</Link>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-mono text-2xl font-semibold sm:text-3xl">Donation #{d.id}</h1>
        <StatusPill status={d.status} />
      </div>

      <section className="card p-5 sm:p-7" aria-labelledby="tl">
        <h2 id="tl" className="sr-only">Status</h2>
        <DonationTracker status={d.status} timeline={d.timeline} />
        <DonorDonationActions id={d.id} status={d.status} />
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <div className="space-y-6">
          <section className="card p-5 sm:p-6" aria-labelledby="sum">
            <h2 id="sum" className="sr-only">Summary</h2>
            <div className="flex gap-4">
              <CategoryArt slug={d.request.category.slug} emoji={d.request.category.icon} size="sm" className="h-20 w-20 shrink-0 rounded-2xl" />
              <div className="min-w-0">
                <ul className="space-y-1">
                  {d.items.map((i) => (
                    <li key={i.requestItemId}>
                      <span className="text-lg font-semibold">{i.quantity} × {i.name}</span>
                      {describeAttributes(i.variant).length > 0 && <span className="block text-sm text-muted">{describeAttributes(i.variant).map((a) => `${a.label}: ${a.value}`).join(" · ")}</span>}
                    </li>
                  ))}
                </ul>
                {d.estimatedValue ? <p className="mt-1 text-sm text-muted">Estimated value: <span className="font-semibold text-fg">{formatINR(d.estimatedValue)}</span></p> : null}
              </div>
            </div>
            <dl className="mt-5 grid gap-4 border-t border-line pt-5 text-sm sm:grid-cols-2">
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-secondary-soft text-secondary-ink"><BadgeCheck className="h-5 w-5" aria-hidden="true" /></span>
                <div><dt className="text-subtle">Recipient</dt><dd className="font-semibold">{d.recipient.descriptor}</dd><dd className="text-xs text-muted">#{d.recipient.ref}</dd></div>
              </div>
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary-ink"><MapPin className="h-5 w-5" aria-hidden="true" /></span>
                <div><dt className="text-subtle">Location</dt><dd className="font-semibold">{d.recipient.district} District</dd></div>
              </div>
            </dl>
            <dl className="mt-5 grid grid-cols-2 gap-y-2 border-t border-line pt-5 text-sm">
              <dt className="text-muted">Request</dt><dd className="text-right"><Link className="text-primary-ink hover:underline" href={`/needs/${d.request.id}`}>{d.request.title}</Link></dd>
              <dt className="text-muted">Delivery</dt><dd className="text-right">{DELIVERY_METHOD_LABELS[d.deliveryMethod as keyof typeof DELIVERY_METHOD_LABELS]}</dd>
              <dt className="text-muted">Condition</dt><dd className="text-right">{CONDITION_LABELS[d.condition as keyof typeof CONDITION_LABELS]}</dd>
              <dt className="text-muted">Expected by</dt><dd className="text-right">{formatDate(d.expectedBy)}</dd>
            </dl>
          </section>
          {d.description && (
            <section className="card p-5 sm:p-6" aria-labelledby="desc">
              <h2 id="desc" className="mb-2 text-lg font-semibold">Description</h2>
              <p className="whitespace-pre-line text-sm">{d.description}</p>
            </section>
          )}
        </div>
        <div className="space-y-6">
          {d.deliveryMethod === "DELIVERY" && (
            <section className="card p-5 sm:p-6" aria-labelledby="courier-heading">
              <h2 id="courier-heading" className="mb-4 text-lg font-semibold">Courier tracking</h2>
              <CourierTrackingCard donationId={d.id} status={d.status} tracking={d.tracking} />
            </section>
          )}
          <section className="card p-5 sm:p-6" aria-labelledby="media">
            <h2 id="media" className="mb-4 text-lg font-semibold">Photos &amp; videos</h2>
            <DonationMediaManager donationId={d.id} media={d.media} editable={["CONFIRMED", "PREPARING", "IN_TRANSIT"].includes(d.status)} />
          </section>
        </div>
      </div>
    </>
  );
}
