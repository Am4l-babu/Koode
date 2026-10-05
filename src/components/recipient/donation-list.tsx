import { AnonymousIdentityBadge } from "@/components/brand/badges";
import { StatusPill } from "@/components/donations/tracker";
import { DELIVERY_METHOD_LABELS } from "@/lib/descriptors";
import { formatDate } from "@/lib/format";
import type { RecipientDonationDTO } from "@/lib/dto/donations";
import { MediaGallery } from "@/components/donations/media-gallery";
import { ReceiveButton } from "./receive-button";

/** Recipient's view of donations — the donor is only ever an anonymous alias. */
export function RecipientDonationList({ donations }: { donations: RecipientDonationDTO[] }) {
  return (
    <ul className="grid gap-3">
      {donations.map((d) => (
        <li key={d.id} className="card flex flex-wrap items-center justify-between gap-4 p-5" data-testid="recipient-donation">
          <div className="min-w-0 space-y-2">
            <AnonymousIdentityBadge label={d.donor.displayName} sublabel={`Donation ${d.id} · ${formatDate(d.createdAt)}`} />
            <p className="font-semibold">{d.items.map((i) => `${i.quantity} × ${i.name}${i.variant.size ? ` (size ${i.variant.size})` : ""}`).join(", ")}</p>
            {d.description && <p className="max-w-md whitespace-pre-line text-sm">{d.description}</p>}
            {d.media.length > 0 && <div className="max-w-md"><MediaGallery media={d.media} /></div>}
            <p className="text-sm text-muted">
              For “{d.request.title}” · {DELIVERY_METHOD_LABELS[d.deliveryMethod as keyof typeof DELIVERY_METHOD_LABELS]} · expected {formatDate(d.expectedBy)}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <StatusPill status={d.status} />
            {["CONFIRMED", "PREPARING", "IN_TRANSIT"].includes(d.status) && <ReceiveButton donationId={d.id} />}
          </div>
        </li>
      ))}
    </ul>
  );
}
