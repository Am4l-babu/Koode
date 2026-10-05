"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Check, Minus, Package, Plus, ShieldCheck, Truck, Warehouse } from "lucide-react";
import type { PublicRequestDTO } from "@/lib/dto/requests";
import { Dialog } from "@/components/ui/dialog";
import { Button, buttonClass } from "@/components/ui/button";
import { Checkbox, Field, RadioCard, Select, Textarea, Input } from "@/components/ui/form";
import { Callout } from "@/components/ui/states";
import { PrivacyBadge } from "@/components/brand/badges";
import { api, ApiError } from "@/lib/client-api";
import { formatINR } from "@/lib/format";
import { cn } from "@/components/ui/cn";

const STEPS = ["What", "How", "Anonymous", "Review"] as const;

const DELIVERY = {
  PLATFORM_PICKUP: { title: "Platform pickup", description: "A verified volunteer collects from you.", icon: <Truck className="h-5 w-5" /> },
  PARTNER_DROPOFF: { title: "Partner drop-off", description: "Drop items at a nearby partner collection point.", icon: <Warehouse className="h-5 w-5" /> },
  DELIVERY: { title: "Delivery", description: "Send by courier to the platform hub.", icon: <Package className="h-5 w-5" /> },
} as const;

const GROUPS = [
  ["INDIVIDUAL", "Just me"],
  ["COMMUNITY_GROUP", "Community group"],
  ["COMPANY", "Company"],
  ["SCHOOL", "School"],
  ["COLLEGE", "College"],
  ["CLUB", "Club"],
] as const;

interface CreatedDonation {
  id: string;
}

export function DonationModal({
  open,
  onClose,
  need,
  preset,
  onQuantityConflict,
}: {
  open: boolean;
  onClose: () => void;
  need: PublicRequestDTO;
  preset: { itemId: string; qty: number } | null;
  onQuantityConflict: (itemId: string, remaining: number) => void;
}) {
  const [step, setStep] = useState(0);
  const [qty, setQty] = useState<Record<string, number>>({});
  const [sizes, setSizes] = useState<Record<string, string>>({});
  const [condition, setCondition] = useState("NEW");
  const [method, setMethod] = useState(need.deliveryMethods[0] ?? "PLATFORM_PICKUP");
  const [groupType, setGroupType] = useState("INDIVIDUAL");
  const [pickupAddress, setPickupAddress] = useState("");
  const [pickupPhone, setPickupPhone] = useState("");
  const [ack, setAck] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [done, setDone] = useState<CreatedDonation | null>(null);

  useEffect(() => {
    if (!open) return;
    setStep(0);
    setError(null);
    setFieldErrors({});
    setDone(null);
    setAck(false);
    const initial: Record<string, number> = {};
    if (preset) initial[preset.itemId] = Math.max(1, preset.qty);
    else {
      const first = need.items.find((i) => i.remaining > 0);
      if (first) initial[first.id] = 1;
    }
    setQty(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const lines = useMemo(() => need.items.filter((i) => (qty[i.id] ?? 0) > 0).map((i) => ({ item: i, quantity: qty[i.id]! })), [need.items, qty]);
  const total = lines.reduce((s, l) => s + l.quantity, 0);
  const estimate = lines.reduce((s, l) => s + l.quantity * (l.item.estimatedUnitValue ?? 0), 0);

  function sizeOptions(attr: Record<string, string | number | boolean>): string[] {
    const raw = attr.size;
    if (typeof raw !== "string") return [];
    const parts = raw.split(/[,/]|\s+or\s+/).map((s) => s.trim()).filter(Boolean);
    return parts.length > 1 ? parts : [];
  }

  function canContinue(): string | null {
    if (step === 0) {
      if (total === 0) return "Select at least one item to donate.";
      for (const l of lines) if (l.quantity > l.item.remaining) return `Only ${l.item.remaining} ${l.item.name.toLowerCase()} remaining.`;
    }
    if (step === 1 && method === "PLATFORM_PICKUP" && pickupAddress.trim().length < 5) return "Add a pickup address so our team can collect the items.";
    if (step === 2 && !ack) return "Please confirm that you understand how anonymous donations work.";
    return null;
  }

  function next() {
    const problem = canContinue();
    if (problem) return setError(problem);
    setError(null);
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }

  async function submit() {
    setSubmitting(true);
    setError(null);
    try {
      const created = await api<CreatedDonation>("/api/donations", {
        body: {
          requestId: need.id,
          items: lines.map((l) => ({
            requestItemId: l.item.id,
            quantity: l.quantity,
            ...(sizes[l.item.id] ? { variant: { size: sizes[l.item.id] } } : {}),
          })),
          condition,
          deliveryMethod: method,
          groupType,
          pickupAddress: method === "PLATFORM_PICKUP" ? pickupAddress.trim() : undefined,
          pickupPhone: pickupPhone.trim() || undefined,
          anonymousAcknowledged: true,
        },
      });
      setDone(created);
    } catch (e) {
      if (e instanceof ApiError) {
        setError(e.message);
        setFieldErrors(e.fields);
        const d = e.body.details as { requestItemId?: string; remaining?: number } | undefined;
        if (e.body.code === "INSUFFICIENT_QUANTITY" && d?.requestItemId) {
          onQuantityConflict(d.requestItemId, d.remaining ?? 0);
          setQty((q) => ({ ...q, [d.requestItemId!]: Math.min(q[d.requestItemId!] ?? 0, d.remaining ?? 0) }));
          setStep(0);
        }
      } else setError("Something didn't go as planned. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <Dialog open={open} onClose={onClose} title="Donation Confirmed" size="md">
        <SuccessView donationId={done.id} />
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onClose={onClose} title="Commit to a donation" description={need.title} size="md">
      <ol className="mb-6 flex items-center gap-2" aria-label="Donation steps">
        {STEPS.map((label, i) => (
          <li key={label} className="flex flex-1 items-center gap-2" aria-current={i === step ? "step" : undefined}>
            <span
              className={cn(
                "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-colors",
                i < step ? "bg-secondary text-white" : i === step ? "bg-primary text-primary-fg" : "bg-surface-3 text-muted",
              )}
            >
              {i < step ? <Check className="h-4 w-4" aria-hidden="true" /> : i + 1}
            </span>
            <span className={cn("hidden text-xs font-semibold sm:block", i === step ? "text-fg" : "text-subtle")}>{label}</span>
            {i < STEPS.length - 1 && <span className="h-px flex-1 bg-line" aria-hidden="true" />}
          </li>
        ))}
      </ol>

      {step === 0 && (
        <div className="space-y-5">
          <h3 className="font-semibold">What would you like to donate?</h3>
          <ul className="space-y-3">
            {need.items.map((i) => {
              const value = qty[i.id] ?? 0;
              const opts = sizeOptions(i.attributes);
              return (
                <li key={i.id} className={cn("rounded-2xl border p-4", value > 0 ? "border-primary bg-primary-soft/50" : "border-line")}>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold">{i.name}</p>
                      <p className="text-sm text-muted">{i.remaining > 0 ? `${i.remaining} remaining` : "Fully committed"}</p>
                    </div>
                    <div className="flex items-center rounded-full border border-line-strong bg-surface">
                      <button type="button" aria-label={`Fewer ${i.name}`} disabled={value <= 0} onClick={() => setQty((q) => ({ ...q, [i.id]: Math.max(0, value - 1) }))} className="flex h-10 w-10 items-center justify-center disabled:opacity-40">
                        <Minus className="h-4 w-4" />
                      </button>
                      <span className="w-8 text-center font-semibold" aria-live="polite" aria-label={`${value} ${i.name}`}>{value}</span>
                      <button type="button" aria-label={`More ${i.name}`} disabled={value >= i.remaining} onClick={() => setQty((q) => ({ ...q, [i.id]: Math.min(i.remaining, value + 1) }))} className="flex h-10 w-10 items-center justify-center disabled:opacity-40">
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  {value > 0 && opts.length > 0 && (
                    <div className="mt-3 max-w-48">
                      <Field label="Size / variant" htmlFor={`size-${i.id}`}>
                        <Select id={`size-${i.id}`} value={sizes[i.id] ?? ""} onChange={(e) => setSizes((s) => ({ ...s, [i.id]: e.target.value }))}>
                          <option value="">Mixed / any listed</option>
                          {opts.map((o) => <option key={o} value={o}>{o}</option>)}
                        </Select>
                      </Field>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
          <fieldset>
            <legend className="mb-2 text-sm font-semibold">Condition</legend>
            <div className="grid gap-2 sm:grid-cols-3">
              {[["NEW", "New"], ["LIKE_NEW", "Like new"], ["GOOD", "Good"]].map(([v, l]) => (
                <RadioCard key={v} name="condition" value={v} checked={condition === v} onChange={setCondition} title={l} />
              ))}
            </div>
          </fieldset>
        </div>
      )}

      {step === 1 && (
        <div className="space-y-5">
          <fieldset>
            <legend className="mb-2 font-semibold">How would you like to send it?</legend>
            <div className="grid gap-2">
              {need.deliveryMethods.map((m) => {
                const d = DELIVERY[m as keyof typeof DELIVERY];
                return <RadioCard key={m} name="method" value={m} checked={method === m} onChange={setMethod} title={d.title} description={d.description} icon={d.icon} />;
              })}
            </div>
          </fieldset>
          {method === "PLATFORM_PICKUP" && (
            <div className="space-y-3 rounded-2xl bg-surface-2 p-4">
              <Field label="Pickup address" htmlFor="pickup" required error={fieldErrors.pickupAddress} help="Encrypted and visible only to platform logistics staff — never to the recipient.">
                <Textarea id="pickup" value={pickupAddress} onChange={(e) => setPickupAddress(e.target.value)} rows={3} autoComplete="street-address" />
              </Field>
              <Field label="Pickup phone (optional)" htmlFor="pickup-phone" error={fieldErrors.pickupPhone}>
                <Input id="pickup-phone" type="tel" inputMode="tel" value={pickupPhone} onChange={(e) => setPickupPhone(e.target.value)} placeholder="+91 98765 43210" autoComplete="tel" />
              </Field>
            </div>
          )}
          <Field label="Donating as" htmlFor="group" help="Group donations still keep every participant anonymous.">
            <Select id="group" value={groupType} onChange={(e) => setGroupType(e.target.value)}>
              {GROUPS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </Select>
          </Field>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-5">
          <div className="flex flex-col items-center rounded-3xl bg-primary-soft px-6 py-8 text-center">
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-primary text-primary-fg animate-pop">
              <ShieldCheck className="h-8 w-8" aria-hidden="true" />
            </span>
            <h3 className="mt-4 text-xl font-semibold">Your donation is anonymous</h3>
            <p className="mt-2 max-w-sm text-muted">Koode holds your name securely. The organisation will see only a reference such as &ldquo;Community Donor #D7K2Q&rdquo;.</p>
          </div>
          <ul className="space-y-2 text-sm text-muted">
            <li className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-secondary-ink" aria-hidden="true" /> Your name, phone number, email and address are never shared.</li>
            <li className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-secondary-ink" aria-hidden="true" /> Only a small number of authorised administrators can link a donation to you, and every access is recorded in a permanent audit log.</li>
            <li className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-secondary-ink" aria-hidden="true" /> The organisation&apos;s identity is protected in the same way.</li>
          </ul>
          <Checkbox label="I understand that my donation is anonymous and that Koode coordinates the handover." checked={ack} onChange={(e) => setAck(e.target.checked)} />
        </div>
      )}

      {step === 3 && (
        <div className="space-y-4">
          <h3 className="font-semibold">Review</h3>
          <div className="rounded-2xl border border-line">
            <ul className="divide-y divide-line">
              {lines.map((l) => (
                <li key={l.item.id} className="flex justify-between px-4 py-3">
                  <span>{l.quantity} × {l.item.name}{sizes[l.item.id] ? ` (size ${sizes[l.item.id]})` : ""}</span>
                  <span className="text-muted">{l.item.estimatedUnitValue ? formatINR(l.quantity * l.item.estimatedUnitValue) : ""}</span>
                </li>
              ))}
            </ul>
            <dl className="grid grid-cols-2 gap-y-2 border-t border-line px-4 py-3 text-sm">
              <dt className="text-muted">Recipient</dt>
              <dd className="text-right font-semibold">{need.recipient.descriptor}</dd>
              <dt className="text-muted">Delivery</dt>
              <dd className="text-right">{DELIVERY[method as keyof typeof DELIVERY]?.title}</dd>
              <dt className="text-muted">Condition</dt>
              <dd className="text-right">{condition === "LIKE_NEW" ? "Like new" : condition === "GOOD" ? "Good" : "New"}</dd>
              {estimate > 0 && (
                <>
                  <dt className="text-muted">Estimated value</dt>
                  <dd className="text-right font-semibold">{formatINR(estimate)}</dd>
                </>
              )}
            </dl>
          </div>
          <PrivacyBadge note="Your identity will not be shared with the organisation." compact />
        </div>
      )}

      {error && <div className="mt-5"><Callout tone="danger" title={error} /></div>}

      <div className="mt-6 flex items-center justify-between gap-3 border-t border-line pt-5">
        <Button variant="ghost" onClick={() => (step === 0 ? onClose() : setStep((s) => s - 1))}>{step === 0 ? "Cancel" : "Back"}</Button>
        {step < STEPS.length - 1 ? (
          <Button onClick={next}>Continue</Button>
        ) : (
          <Button onClick={submit} loading={submitting} variant="primary">Confirm Anonymous Donation</Button>
        )}
      </div>
    </Dialog>
  );
}

function SuccessView({ donationId }: { donationId: string }) {
  const pieces = Array.from({ length: 18 }, (_, i) => i);
  return (
    <div className="relative flex flex-col items-center overflow-hidden py-4 text-center">
      <div className="pointer-events-none absolute left-1/2 top-12" aria-hidden="true">
        {pieces.map((i) => (
          <span
            key={i}
            className="confetti-piece absolute h-2.5 w-1.5 rounded-sm"
            style={
              {
                background: ["var(--primary)", "var(--secondary)", "var(--accent)"][i % 3],
                "--dx": `${Math.cos((i / pieces.length) * Math.PI * 2) * (80 + (i % 4) * 25)}px`,
                "--dy": `${Math.sin((i / pieces.length) * Math.PI * 2) * (60 + (i % 3) * 20) - 20}px`,
                "--rot": `${i * 47}deg`,
              } as React.CSSProperties
            }
          />
        ))}
      </div>
      <span className="flex h-20 w-20 items-center justify-center rounded-full bg-secondary text-white animate-pop">
        <Check className="h-10 w-10" strokeWidth={3} aria-hidden="true" />
      </span>
      <h3 className="mt-5 text-2xl font-semibold">Donation Confirmed</h3>
      <p className="mt-2 max-w-sm text-muted">Thank you. Your donation will go directly toward a verified community need.</p>
      <p className="mt-5 text-sm text-muted">Donation ID</p>
      <p className="font-mono text-2xl font-bold tracking-wide text-primary-ink" data-testid="donation-id">{donationId}</p>
      <p className="mt-4 inline-flex items-center gap-2 rounded-full bg-primary-soft px-3 py-1.5 text-sm font-semibold text-primary-ink">Your identity remains private.</p>
      <div className="mt-6 flex w-full flex-col gap-2 sm:flex-row sm:justify-center">
        <Link href={`/donor/donations/${donationId}`} className={buttonClass("primary", "md")}>Track Donation</Link>
        <Link href="/needs" className={buttonClass("outline", "md")}>Browse more needs</Link>
      </div>
    </div>
  );
}
