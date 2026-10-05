import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/ui/card";
import { DonationTracker, StatusPill } from "@/components/donations/tracker";
import { DonationStatusActions, IdentityReveal } from "@/components/admin/actions";
import { requirePagePermission } from "@/lib/auth/guards";
import { hasPermission } from "@/lib/permissions";
import { getDonationAdmin } from "@/services/admin";
import { AppError } from "@/lib/errors";
import { CONDITION_LABELS, DELIVERY_METHOD_LABELS, GROUP_LABELS } from "@/lib/descriptors";
import { formatDate, formatINR } from "@/lib/format";

export const metadata = { title: "Donation" };

export default async function AdminDonationPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePagePermission("DONATION_MANAGEMENT");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const d = await getDonationAdmin(id).catch((e) => {
    if (e instanceof AppError && e.code === "NOT_FOUND") return null;
    throw e;
  });
  if (!d) notFound();
  const timeline = d.events.map((e) => ({ status: e.status, at: e.createdAt, note: e.note, by: (e.actorRole === "DONOR" ? "Donor" : e.actorRole === "RECIPIENT" ? "Recipient" : "Platform") as "Donor" | "Recipient" | "Platform" }));
  return (
    <>
      <Link href="/admin/donations" className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-muted hover:text-fg"><ArrowLeft className="h-4 w-4" aria-hidden="true" /> Donations</Link>
      <PageHeader eyebrow="Donation" title={<span className="font-mono">Donation #{d.publicId}</span>} actions={<StatusPill status={d.status} />} />
      <div className="grid gap-6 xl:grid-cols-[1fr_1.2fr]">
        <section className="card p-6">
          <h2 className="mb-5 font-semibold">Timeline</h2>
          <DonationTracker status={d.status} timeline={timeline} />
          <div className="mt-6 border-t border-line pt-4"><DonationStatusActions id={d.id} status={d.status} /></div>
        </section>
        <div className="space-y-6">
          <section className="card p-6">
            <h2 className="font-semibold">Public view</h2>
            <dl className="mt-3 grid grid-cols-[9rem_1fr] gap-y-2 text-sm">
              <dt className="text-muted">Donor</dt><dd className="font-mono">Donor #{d.donor.publicId}</dd>
              <dt className="text-muted">Recipient</dt><dd className="font-mono">Recipient #{d.organization.publicId} <span className="font-sans text-muted">({d.organization.publicDescriptor})</span></dd>
              <dt className="text-muted">Request</dt><dd>{d.request.title} <span className="font-mono text-xs text-subtle">{d.request.publicId}</span></dd>
              <dt className="text-muted">Items</dt><dd>{d.items.map((i) => `${i.quantity} × ${i.requestItem.name}`).join(", ")}</dd>
              <dt className="text-muted">Delivery</dt><dd>{DELIVERY_METHOD_LABELS[d.deliveryMethod]} · {d.delivery?.status.toLowerCase() ?? "—"}</dd>
              <dt className="text-muted">Condition</dt><dd>{CONDITION_LABELS[d.condition]}</dd>
              <dt className="text-muted">Donating as</dt><dd>{GROUP_LABELS[d.groupType]}</dd>
              <dt className="text-muted">Est. value</dt><dd>{formatINR(d.estimatedValue)}</dd>
              <dt className="text-muted">Expected by</dt><dd>{formatDate(d.expectedBy)}</dd>
            </dl>
          </section>
          <section className="card p-6">
            <h2 className="mb-3 font-semibold">Admin identity view</h2>
            <IdentityReveal donationId={d.id} allowed={hasPermission(user, "VIEW_PRIVATE_IDENTITY")} />
          </section>
        </div>
      </div>
    </>
  );
}
