"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Check, Minus, Package, Plus, Truck, Warehouse } from "lucide-react";
import type { PublicRequestDTO } from "@/lib/dto/requests";
import { Dialog } from "@/components/ui/dialog";
import { Button, buttonClass } from "@/components/ui/button";
import { Checkbox, Field, RadioCard, Select, Textarea, Input } from "@/components/ui/form";
import { Callout } from "@/components/ui/states";
import { CategoryArt } from "@/components/brand/category-visual";
import { Stepper } from "@/components/ui/stepper";
import { MediaPicker, uploadDonationMedia } from "@/components/donations/media-picker";
import { AttributeField } from "@/components/ui/attribute-field";
import { formatAttributeValue, listedChoices } from "@/lib/categories";
import { detectPii, piiMessage } from "@/lib/pii-guard";
import { api, ApiError } from "@/lib/client-api";
import { formatINR } from "@/lib/format";
import { cn } from "@/components/ui/cn";

const STEPS = ["Items", "Shipping", "Confirm", "Review"] as const;

const CONDITIONS = [
  ["NEW", "New"],
  ["LIKE_NEW", "Like new"],
  ["GOOD", "Good"],
] as const;
const conditionLabel = (c: string) => CONDITIONS.find(([v]) => v === c)?.[1] ?? "New";

const DELIVERY = {
  PLATFORM_PICKUP: { title: "Platform pickup", description: "A verified volunteer collects from you.", icon: <Truck className="h-5 w-5" /> },
  PARTNER_DROPOFF: { title: "Partner drop-off", description: "Drop items at a nearby partner collection point.", icon: <Warehouse className="h-5 w-5" /> },
  DELIVERY: { title: "Delivery", description: "Send by courier to the platform hub, then add the tracking number.", icon: <Package className="h-5 w-5" /> },
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
  // Per requested item: the condition and product details of what the donor gives.
  const [conditions, setConditions] = useState<Record<string, string>>({});
  const [details, setDetails] = useState<Record<string, Record<string, string>>>({});
  const [description, setDescription] = useState("");
  const [method, setMethod] = useState(need.deliveryMethods[0] ?? "PLATFORM_PICKUP");
  const [groupType, setGroupType] = useState("INDIVIDUAL");
  const [pickupAddress, setPickupAddress] = useState("");
  const [pickupPhone, setPickupPhone] = useState("");
  const [ack, setAck] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [done, setDone] = useState<CreatedDonation | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [uploadNote, setUploadNote] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setStep(0);
    setError(null);
    setFieldErrors({});
    setDone(null);
    setFiles([]);
    setConditions({});
    setDetails({});
    setDescription("");
    setUploadNote(null);
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


  function canContinue(): string | null {
    if (step === 0) {
      if (total === 0) return "Select at least one item to donate.";
      for (const l of lines) if (l.quantity > l.item.remaining) return `Only ${l.item.remaining} ${l.item.name.toLowerCase()} remaining.`;
    }
    if (step === 0) {
      for (const l of lines) {
        const pii = detectPii(Object.values(details[l.item.id] ?? {}).join(" "));
        if (pii.length) return `${l.item.name}: ${piiMessage(pii)}`;
      }
    }
    if (step === 0 && description.trim()) {
      const pii = detectPii(description);
      if (pii.length) return piiMessage(pii);
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

  /** The details filled in for one item, limited to that item's questions. */
  function givenDetails(itemId: string): Record<string, string> {
    const item = need.items.find((i) => i.id === itemId);
    const filled = details[itemId] ?? {};
    return Object.fromEntries((item?.donorFields ?? []).filter((f) => filled[f.key]?.trim()).map((f) => [f.key, filled[f.key]!.trim()]));
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
            condition: l.item.newOnly ? "NEW" : (conditions[l.item.id] ?? "NEW"),
            variant: givenDetails(l.item.id),
          })),
          deliveryMethod: method,
          groupType,
          description: description.trim() || undefined,
          pickupAddress: method === "PLATFORM_PICKUP" ? pickupAddress.trim() : undefined,
          pickupPhone: pickupPhone.trim() || undefined,
          anonymousAcknowledged: true,
        },
      });
      // The donation is already confirmed; attach any photos/videos afterwards so a
      // failed upload can never block or undo the gift itself.
      const problems: string[] = [];
      for (const f of files) {
        const problem = await uploadDonationMedia(created.id, f);
        if (problem) problems.push(problem);
      }
      if (problems.length) setUploadNote(`${[...new Set(problems)].join(" ")} You can add photos and videos again from the tracking page.`);
      setDone(created);
    } catch (e) {
      if (e instanceof ApiError) {
        setError(e.message);
        setFieldErrors(e.fields);
        const d = e.body.details as { requestItemId?: string; remaining?: number } | undefined;
        if (Object.keys(e.fields).some((k) => k.startsWith("items."))) setStep(0);
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
        <SuccessView donationId={done.id} uploadNote={uploadNote} />
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onClose={onClose} title="Commit to a donation" description={need.title} size="md">
      <Stepper steps={STEPS} current={step} label="Donation steps" className="mb-6" />

      {step === 0 && (
        <div className="space-y-5">
          <h3 className="font-semibold">What would you like to donate?</h3>
          <ul className="space-y-3">
            {need.items.map((i) => {
              const value = qty[i.id] ?? 0;
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
                  {value > 0 && (
                    <div className="mt-3 border-t border-line pt-3" data-testid="item-details">
                      <p className="mb-2 text-sm font-semibold">About the {i.name.toLowerCase()} you&apos;re giving</p>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <Field label="Condition" htmlFor={`cond-${i.id}`} help={i.newOnly ? "Only new items can be accepted for this." : undefined} error={fieldErrors[`items.${lines.findIndex((l) => l.item.id === i.id)}.condition`]}>
                          <Select id={`cond-${i.id}`} value={i.newOnly ? "NEW" : (conditions[i.id] ?? "NEW")} disabled={i.newOnly} onChange={(e) => setConditions((c) => ({ ...c, [i.id]: e.target.value }))}>
                            {CONDITIONS.filter(([v]) => !i.newOnly || v === "NEW").map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                          </Select>
                        </Field>
                        {i.donorFields.map((f) => {
                          const requested = i.attributes[f.key];
                          // Only free-text answers can list several values ("28, 30"); a dropdown value is one option.
                          const choices = f.type === "text" ? listedChoices(requested) : [];
                          return (
                            <AttributeField
                              key={f.key}
                              field={f}
                              id={`give-${i.id}-${f.key}`}
                              value={details[i.id]?.[f.key] ?? ""}
                              required={false}
                              choices={choices}
                              placeholderOption={choices.length ? "Mixed / any listed" : "Not specified"}
                              help={requested !== undefined && requested !== "" && !choices.length ? `Requested: ${formatAttributeValue(requested)}` : f.help}
                              error={fieldErrors[`items.${lines.findIndex((l) => l.item.id === i.id)}.variant.${f.key}`]}
                              onChange={(v) => setDetails((d) => ({ ...d, [i.id]: { ...d[i.id], [f.key]: v } }))}
                            />
                          );
                        })}
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
          <Field label="Description (optional)" htmlFor="donate-description" help="Describe what you're giving — brand, age, condition, anything the recipient should know. Don't include names or contact details.">
            <Textarea id="donate-description" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} maxLength={600} placeholder="e.g. Two school bags, lightly used, all zips working." />
          </Field>
          <div>
            <h3 className="mb-2 text-sm font-semibold">Photos or video of the items <span className="font-normal text-muted">(optional)</span></h3>
            <MediaPicker files={files} onChange={setFiles} disabled={submitting} idPrefix="donate-media" />
          </div>
          {lines.length > 0 && (
            <div className="rounded-2xl border border-line bg-surface-2 p-4" aria-live="polite">
              <p className="text-sm font-semibold">Your donation</p>
              <div className="mt-3 flex items-center gap-3">
                <CategoryArt slug={need.category.slug} emoji={need.category.icon} size="sm" className="h-12 w-12 shrink-0 rounded-xl" />
                <p className="min-w-0 text-sm font-medium">{lines.map((l) => `${l.quantity} × ${l.item.name}`).join(", ")}</p>
              </div>
              {estimate > 0 && (
                <p className="mt-3 border-t border-line pt-3 text-sm text-muted">
                  Estimated value <span className="mt-0.5 block font-display text-2xl font-semibold text-fg">{formatINR(estimate)}</span>
                </p>
              )}
            </div>
          )}
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
          <div>
            <h3 className="font-semibold">How the handover works</h3>
            <p className="mt-1 text-sm text-muted">Koode coordinates delivery between you and the organisation. They will see a reference such as &ldquo;Community Donor #D7K2Q&rdquo; rather than your details.</p>
          </div>
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
                  <span>
                    {l.quantity} × {l.item.name}
                    <span className="block text-sm text-muted">
                      {[conditionLabel(conditions[l.item.id] ?? "NEW"), ...l.item.donorFields.filter((f) => givenDetails(l.item.id)[f.key]).map((f) => `${f.label}: ${formatAttributeValue(givenDetails(l.item.id)[f.key])}`)].join(" · ")}
                    </span>
                  </span>
                  <span className="text-muted">{l.item.estimatedUnitValue ? formatINR(l.quantity * l.item.estimatedUnitValue) : ""}</span>
                </li>
              ))}
            </ul>
            <dl className="grid grid-cols-2 gap-y-2 border-t border-line px-4 py-3 text-sm">
              <dt className="text-muted">Recipient</dt>
              <dd className="text-right font-semibold">{need.recipient.descriptor}</dd>
              <dt className="text-muted">Delivery</dt>
              <dd className="text-right">{DELIVERY[method as keyof typeof DELIVERY]?.title}</dd>
              {estimate > 0 && (
                <>
                  <dt className="text-muted">Estimated value</dt>
                  <dd className="text-right font-semibold">{formatINR(estimate)}</dd>
                </>
              )}
            </dl>
          </div>
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

function SuccessView({ donationId, uploadNote }: { donationId: string; uploadNote: string | null }) {
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
      {uploadNote && <div className="mt-4 w-full text-left"><Callout tone="warning" title="Some files could not be added">{uploadNote}</Callout></div>}
      <div className="mt-6 flex w-full flex-col gap-2 sm:flex-row sm:justify-center">
        <Link href={`/donor/donations/${donationId}`} className={buttonClass("primary", "md")}>Track Donation</Link>
        <Link href="/needs" className={buttonClass("outline", "md")}>Browse more needs</Link>
      </div>
    </div>
  );
}
