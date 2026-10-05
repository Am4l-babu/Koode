import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/ui/card";
import { AnonymousIdentityBadge, PrivacyBadge } from "@/components/brand/badges";
import { DonationTracker, StatusPill } from "@/components/donations/tracker";
import { DonorDonationActions } from "@/components/donations/donor-actions";
import { requirePageUser } from "@/lib/auth/guards";
import { getDonorDonation } from "@/services/donations";
import { AppError } from "@/lib/errors";
import { CONDITION_LABELS, DELIVERY_METHOD_LABELS } from "@/lib/descriptors";
import { formatDate, formatINR } from "@/lib/format";

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
      <Link href="/donor/donations" className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-muted hover:text-fg"><ArrowLeft className="h-4 w-4" aria-hidden="true" /> My donations</Link>
      <PageHeader eyebrow={`${d.request.category.icon} ${d.request.category.name}`} title={<span className="font-mono">Donation #{d.id}</span>} actions={<StatusPill status={d.status} />} />
      <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <section className="card p-6" aria-labelledby="tl">
          <h2 id="tl" className="mb-5 text-lg font-semibold">Status</h2>
          <DonationTracker status={d.status} timeline={d.timeline} />
          <DonorDonationActions id={d.id} status={d.status} />
        </section>
        <div className="space-y-6">
          <section className="card p-6" aria-labelledby="sum">
            <h2 id="sum" className="text-lg font-semibold">Summary</h2>
            <ul className="mt-3 space-y-1">
              {d.items.map((i) => <li key={i.requestItemId} className="font-semibold">{i.quantity} × {i.name}{i.variant.size ? <span className="font-normal text-muted"> · size {i.variant.size}</span> : null}</li>)}
            </ul>
            <dl className="mt-4 grid grid-cols-2 gap-y-2 text-sm">
              <dt className="text-muted">Request</dt><dd className="text-right"><Link className="text-primary-ink hover:underline" href={`/needs/${d.request.id}`}>{d.request.title}</Link></dd>
              <dt className="text-muted">Delivery</dt><dd className="text-right">{DELIVERY_METHOD_LABELS[d.deliveryMethod as keyof typeof DELIVERY_METHOD_LABELS]}</dd>
              <dt className="text-muted">Condition</dt><dd className="text-right">{CONDITION_LABELS[d.condition as keyof typeof CONDITION_LABELS]}</dd>
              <dt className="text-muted">Expected by</dt><dd className="text-right">{formatDate(d.expectedBy)}</dd>
              {d.estimatedValue ? <><dt className="text-muted">Estimated value</dt><dd className="text-right">{formatINR(d.estimatedValue)}</dd></> : null}
            </dl>
          </section>
          <section className="card p-6" aria-labelledby="rec">
            <h2 id="rec" className="mb-4 text-lg font-semibold">Recipient</h2>
            <AnonymousIdentityBadge kind="recipient" label={d.recipient.descriptor} sublabel={`Verified Recipient #${d.recipient.ref} · ${d.recipient.district}`} />
          </section>
          <PrivacyBadge note="Your identity will not be shared with the recipient." />
        </div>
      </div>
    </>
  );
}
