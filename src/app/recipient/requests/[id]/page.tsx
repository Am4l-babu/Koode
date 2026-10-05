import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ProgressBar } from "@/components/ui/progress";
import { Callout, EmptyState } from "@/components/ui/states";
import { UrgencyBadge } from "@/components/brand/badges";
import { RecipientDonationList } from "@/components/recipient/donation-list";
import { RecipientRequestActions } from "@/components/recipient/request-actions";
import { requirePageUser } from "@/lib/auth/guards";
import { getOwnRequest } from "@/services/requests";
import { listRecipientDonations } from "@/services/donations";
import { AppError } from "@/lib/errors";
import { REQUEST_STATUS_LABELS } from "@/lib/descriptors";
import { STAGE_LABELS } from "@/lib/fulfillment";
import { formatDate } from "@/lib/format";

export const metadata = { title: "Request" };

export default async function OwnRequestPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ created?: string }> }) {
  const user = await requirePageUser(["RECIPIENT"]);
  const { id } = await params;
  const sp = await searchParams;
  const r = await getOwnRequest(user, id.toUpperCase()).catch((e) => {
    if (e instanceof AppError && e.code === "NOT_FOUND") return null;
    throw e;
  });
  if (!r) notFound();
  const donations = await listRecipientDonations(user, r.id);

  return (
    <>
      <Link href="/recipient/requests" className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-muted hover:text-fg"><ArrowLeft className="h-4 w-4" aria-hidden="true" /> My requests</Link>
      <PageHeader
        eyebrow={`${r.category.icon} ${r.category.name} · ${r.id}`}
        title={r.title}
        actions={<RecipientRequestActions id={r.id} status={r.status} />}
      />
      {sp.created && <div className="mb-6"><Callout tone="success" title="Request submitted 🎉">It is now pending verification. We&apos;ll notify you once it&apos;s reviewed.</Callout></div>}
      {r.status === "NEEDS_INFO" && r.adminNote && <div className="mb-6"><Callout tone="warning" title="The review team asked for more information">{r.adminNote}</Callout></div>}
      {r.status === "REJECTED" && r.rejectionReason && <div className="mb-6"><Callout tone="danger" title="Not approved">{r.rejectionReason}</Callout></div>}

      <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
        <section className="card p-6" aria-labelledby="ful">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="primary">{REQUEST_STATUS_LABELS[r.status as keyof typeof REQUEST_STATUS_LABELS]}</Badge>
            <UrgencyBadge priority={r.priority} />
          </div>
          <h2 id="ful" className="mt-4 text-lg font-semibold">Smart fulfilment tracking</h2>
          <p className="text-sm text-muted">{STAGE_LABELS[r.stage]} · overall {r.percent}% committed · {r.received} items received</p>
          <ul className="mt-5 space-y-5">
            {r.items.map((i) => (
              <li key={i.id}>
                <div className="flex justify-between text-sm"><span className="font-semibold">{i.name}</span><span className="text-muted">{i.committed}/{i.required} committed · {r.itemsReceived[i.id] ?? 0} received</span></div>
                <ProgressBar value={i.percent} className="mt-2" tone={i.remaining === 0 ? "success" : "primary"} label={`${i.name}: ${i.percent}%`} />
              </li>
            ))}
          </ul>
          <dl className="mt-6 grid grid-cols-2 gap-y-2 border-t border-line pt-4 text-sm">
            <dt className="text-muted">Area</dt><dd>{r.location.city ? `${r.location.city}, ` : ""}{r.location.district}</dd>
            <dt className="text-muted">Needed by</dt><dd>{formatDate(r.neededBy)}</dd>
            <dt className="text-muted">Recurring</dt><dd>{r.recurrence === "NONE" ? "No" : r.recurrence.toLowerCase()}</dd>
            <dt className="text-muted">Public link</dt><dd>{r.status === "ACTIVE" || r.status === "FULFILLED" ? <Link className="text-primary-ink hover:underline" href={`/needs/${r.id}`}>View as donors see it</Link> : "Not yet public"}</dd>
          </dl>
        </section>
        <section aria-labelledby="don">
          <h2 id="don" className="mb-3 text-lg font-semibold">Donations ({donations.length})</h2>
          {donations.length ? <RecipientDonationList donations={donations} /> : <EmptyState illustration="bell" title="No donations yet" description="Once approved, anonymous donors can commit items to this request." />}
        </section>
      </div>
    </>
  );
}
