"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Check, Copy, ExternalLink, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/form";
import { Callout } from "@/components/ui/states";
import { api, ApiError } from "@/lib/client-api";
import { COURIERS, findCourier, OTHER_COURIER, type TrackingInfo } from "@/lib/couriers";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/components/ui/cn";

/** Courier, tracking number (copyable) and a link to follow the parcel. */
export function TrackingSummary({ tracking, compact }: { tracking: TrackingInfo; compact?: boolean }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(tracking.trackingNumber);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* Clipboard can be blocked; the number is still visible to copy by hand. */
    }
  }
  return (
    <div className={cn("text-sm", compact ? "flex flex-wrap items-center gap-x-3 gap-y-1" : "space-y-2")} data-testid="tracking-summary">
      <p className="flex items-center gap-1.5">
        <Truck className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
        <span>Sent by <span className="font-semibold">{tracking.courierName}</span></span>
      </p>
      <p className="flex items-center gap-1">
        <span className="text-muted">Tracking no.</span>
        <span className="font-mono font-semibold tracking-wide">{tracking.trackingNumber}</span>
        <button type="button" onClick={copy} aria-label="Copy tracking number" className="flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-surface-2 hover:text-fg">
          {copied ? <Check className="h-4 w-4 text-secondary-ink" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />}
        </button>
        <span className="sr-only" aria-live="polite">{copied ? "Copied" : ""}</span>
      </p>
      {tracking.url ? (
        <p className={cn(compact ? "" : "flex flex-wrap items-center gap-x-2")}>
          <a href={tracking.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-semibold text-primary-ink hover:underline">
            Track on {findCourier(tracking.courierId)?.name.split(" (")[0] ?? tracking.courierName} <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
          </a>
          {!tracking.direct && !compact && <span className="text-xs text-muted">Paste the number on the courier&apos;s page.</span>}
        </p>
      ) : (
        !compact && <p className="text-xs text-muted">Use this number on the courier&apos;s website or app to follow the parcel.</p>
      )}
      {!compact && tracking.addedAt && <p className="text-xs text-subtle">Added {formatDateTime(tracking.addedAt)}</p>}
    </div>
  );
}

/**
 * Donor-side: record which courier the items went with and the tracking number.
 * Saving the first time also marks the donation as sent.
 */
export function CourierTrackingCard({ donationId, status, tracking }: { donationId: string; status: string; tracking: TrackingInfo | null }) {
  const router = useRouter();
  const editable = ["CONFIRMED", "PREPARING", "IN_TRANSIT"].includes(status);
  const [editing, setEditing] = useState(!tracking && editable);
  const [courier, setCourier] = useState(tracking?.courierId ?? "");
  const [courierName, setCourierName] = useState(tracking && !findCourier(tracking.courierId) ? tracking.courierName : "");
  const [trackingNumber, setTrackingNumber] = useState(tracking?.trackingNumber ?? "");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const example = findCourier(courier)?.example;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const local: Record<string, string> = {};
    if (!courier) local.courier = "Choose the courier service.";
    if (courier === OTHER_COURIER && courierName.trim().length < 2) local.courierName = "Enter the courier's name.";
    if (trackingNumber.replace(/\s+/g, "").length < 6) local.trackingNumber = "Enter the tracking number from your receipt.";
    setErrors(local);
    if (Object.keys(local).length) return;
    setSaving(true);
    setError(null);
    try {
      await api(`/api/my-donations/${donationId}/tracking`, {
        method: "PUT",
        body: { courier, courierName: courier === OTHER_COURIER ? courierName.trim() : undefined, trackingNumber },
      });
      setEditing(false);
      router.refresh();
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
        setErrors(err.fields);
      } else setError("Something didn't go as planned.");
    } finally {
      setSaving(false);
    }
  }

  if (!editing) {
    return (
      <div className="space-y-3">
        {tracking ? <TrackingSummary tracking={tracking} /> : <p className="text-sm text-muted">No tracking was added for this donation.</p>}
        {editable && tracking && <Button variant="outline" size="sm" onClick={() => setEditing(true)}>Change tracking details</Button>}
      </div>
    );
  }

  return (
    <form onSubmit={save} className="space-y-4" noValidate>
      <p className="text-sm text-muted">Once you&apos;ve handed the parcel to a courier, add the service and the tracking number from your receipt.</p>
      <Field label="Courier service" htmlFor="courier" required error={errors.courier}>
        <Select id="courier" value={courier} onChange={(e) => setCourier(e.target.value)} invalid={!!errors.courier}>
          <option value="">Choose…</option>
          {COURIERS.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          <option value={OTHER_COURIER}>Other courier</option>
        </Select>
      </Field>
      {courier === OTHER_COURIER && (
        <Field label="Courier name" htmlFor="courier-name" required error={errors.courierName}>
          <Input id="courier-name" value={courierName} onChange={(e) => setCourierName(e.target.value)} maxLength={40} invalid={!!errors.courierName} />
        </Field>
      )}
      <Field label="Tracking number" htmlFor="tracking-number" required error={errors.trackingNumber} help={example ? `Looks like ${example}` : "Also called the AWB, docket or consignment number."}>
        <Input id="tracking-number" value={trackingNumber} onChange={(e) => setTrackingNumber(e.target.value)} autoCapitalize="characters" autoComplete="off" spellCheck={false} maxLength={40} className="font-mono" invalid={!!errors.trackingNumber} />
      </Field>
      <Callout tone="privacy" title="The organisation will see these tracking details">
        So they know when to expect the items. Courier tracking pages can show the town a parcel was booked from — if you&apos;d rather not share that, book it from a different branch or choose partner drop-off next time.
      </Callout>
      {error && <Callout tone="danger" title={error} />}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" loading={saving}>{status === "IN_TRANSIT" ? "Save tracking" : "Save and mark as sent"}</Button>
        {tracking && <Button variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>}
      </div>
    </form>
  );
}
