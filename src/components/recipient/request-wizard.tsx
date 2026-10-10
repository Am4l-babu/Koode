"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { CategoryIcon } from "@/components/brand/category-visual";
import { Stepper } from "@/components/ui/stepper";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/form";
import { AttributeField } from "@/components/ui/attribute-field";
import { Callout } from "@/components/ui/states";
import { cn } from "@/components/ui/cn";
import { api, ApiError } from "@/lib/client-api";
import { KERALA_DISTRICTS } from "@/lib/geo";
import { fieldsFor, findProductType, formatAttributeValue, PRODUCT_TYPE_KEY, type CategorySchema } from "@/lib/categories";
import { detectPii, piiMessage } from "@/lib/pii-guard";

export interface WizardCategory {
  id: string;
  slug: string;
  name: string;
  icon: string;
  description: string | null;
  fieldSchema: CategorySchema;
}

interface ItemDraft {
  key: number;
  /** A product type name, OTHER, or "" while not chosen yet. */
  productType: string;
  name: string;
  quantity: string;
  unit: string;
  estimatedUnitValue: string;
  attributes: Record<string, string>;
}

const STEPS = ["Category", "Details", "Items", "Review"];
const OTHER = "__other";
const blankItem = (key: number): ItemDraft => ({ key, productType: "", name: "", quantity: "", unit: "pcs", estimatedUnitValue: "", attributes: {} });

/**
 * Smart request builder. Item details are rendered from the category's
 * `fieldSchema` — adding a category in the admin panel adds its form here
 * with no code change. Choosing a product type (e.g. Footwear) swaps in that
 * product's own measurements.
 */
export function RequestWizard({ categories, defaultDistrict, recurringEnabled }: { categories: WizardCategory[]; defaultDistrict: string; recurringEnabled: boolean }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [categoryId, setCategoryId] = useState<string>("");
  const [form, setForm] = useState({ title: "", description: "", urgency: "NORMAL", neededBy: "", peopleAffected: "", district: defaultDistrict, city: "", recurrence: "NONE" });
  const [methods, setMethods] = useState<string[]>(["PLATFORM_PICKUP", "PARTNER_DROPOFF", "DELIVERY"]);
  const [items, setItems] = useState<ItemDraft[]>([blankItem(1)]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const category = useMemo(() => categories.find((c) => c.id === categoryId), [categories, categoryId]);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const updateItem = (key: number, patch: Partial<ItemDraft>) => setItems((list) => list.map((i) => (i.key === key ? { ...i, ...patch } : i)));
  const productTypes = category?.fieldSchema.productTypes ?? [];
  const itemFields = (it: ItemDraft) => (category ? fieldsFor(category.fieldSchema, it.productType) : []);

  /** Switch an item's product type, carrying over the name and unit only if they were the old type's defaults. */
  function chooseProductType(it: ItemDraft, value: string) {
    if (!category) return;
    const before = findProductType(category.fieldSchema, it.productType);
    const after = findProductType(category.fieldSchema, value);
    const keep = new Set(fieldsFor(category.fieldSchema, value).map((f) => f.key));
    updateItem(it.key, {
      productType: value,
      name: !it.name.trim() || it.name === before?.name ? (after?.name ?? "") : it.name,
      unit: it.unit === "pcs" || it.unit === before?.unit ? (after?.unit ?? "pcs") : it.unit,
      attributes: Object.fromEntries(Object.entries(it.attributes).filter(([k]) => keep.has(k))),
    });
  }

  function validateStep(): Record<string, string> {
    const e: Record<string, string> = {};
    if (step === 0 && !categoryId) e.categoryId = "Choose a category.";
    if (step === 1) {
      if (form.title.trim().length < 8) e.title = "Title must be at least 8 characters.";
      if (form.description.trim().length < 30) e.description = "Describe the need in at least 30 characters.";
      const pii = detectPii(`${form.title} ${form.description}`);
      if (pii.length) e.description = piiMessage(pii);
      if (!form.district) e.district = "Choose a district.";
      if (!methods.length) e.deliveryMethods = "Choose at least one delivery method.";
    }
    if (step === 2) {
      items.forEach((it, idx) => {
        if (productTypes.length && !it.productType) e[`items.${idx}.attributes.${PRODUCT_TYPE_KEY}`] = "Choose a product type, or “Something else”.";
        if (it.name.trim().length < 2) e[`items.${idx}.name`] = "Name the item.";
        const q = Number(it.quantity);
        if (!Number.isInteger(q) || q < 1) e[`items.${idx}.quantity`] = "Enter a whole number of at least 1.";
        for (const f of itemFields(it)) {
          if (f.required && !it.attributes[f.key]?.trim()) e[`items.${idx}.attributes.${f.key}`] = `${f.label} is required.`;
        }
      });
    }
    return e;
  }

  function next() {
    const e = validateStep();
    setErrors(e);
    if (Object.keys(e).length) return;
    setError(null);
    setStep((s) => Math.min(STEPS.length - 1, s + 1));
  }

  async function submit(asDraft = false) {
    setSubmitting(true);
    setError(null);
    try {
      const res = await api<{ id: string }>("/api/requests", {
        body: {
          categoryId,
          title: form.title.trim(),
          description: form.description.trim(),
          urgency: form.urgency,
          neededBy: form.neededBy || undefined,
          peopleAffected: form.peopleAffected ? Number(form.peopleAffected) : undefined,
          district: form.district,
          city: form.city.trim() || undefined,
          recurrence: form.recurrence,
          deliveryMethods: methods,
          submit: !asDraft,
          items: items.map((i) => {
            const keys = new Set(itemFields(i).map((f) => f.key));
            const attributes = Object.fromEntries(Object.entries(i.attributes).filter(([k, v]) => keys.has(k) && v.trim()));
            return {
              name: i.name.trim(),
              quantity: Number(i.quantity),
              unit: i.unit.trim() || "pcs",
              estimatedUnitValue: i.estimatedUnitValue ? Number(i.estimatedUnitValue) : undefined,
              attributes: i.productType && i.productType !== OTHER ? { ...attributes, [PRODUCT_TYPE_KEY]: i.productType } : attributes,
            };
          }),
        },
      });
      router.push(`/recipient/requests/${res.id}?created=1`);
      router.refresh();
    } catch (e) {
      if (e instanceof ApiError) {
        setError(e.message);
        setErrors(e.fields);
        const keys = Object.keys(e.fields);
        if (keys.some((k) => k.startsWith("items"))) setStep(2);
        else if (keys.some((k) => ["title", "description", "district", "city", "neededBy"].includes(k))) setStep(1);
      } else setError("Something didn't go as planned.");
      setSubmitting(false);
    }
  }

  return (
    <div className="card p-5 sm:p-8">
      <Stepper steps={STEPS} current={step} label="Request steps" className="mx-auto mb-8 max-w-2xl" />

      {step === 0 && (
        <fieldset>
          <legend className="text-xl font-semibold">1. Select category</legend>
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {categories.map((c) => (
              <label
                key={c.id}
                title={c.description ?? undefined}
                className={cn(
                  "flex cursor-pointer flex-col items-center gap-3 rounded-2xl border-2 px-3 py-5 text-center transition-colors has-[:focus-visible]:shadow-[var(--ring)]",
                  categoryId === c.id ? "border-primary bg-primary-soft/60" : "border-line hover:border-line-strong",
                )}
              >
                <input type="radio" name="category" value={c.id} checked={categoryId === c.id} onChange={() => setCategoryId(c.id)} className="sr-only" />
                <CategoryIcon slug={c.slug} emoji={c.icon} className="h-14 w-14 rounded-2xl" iconClassName="h-7 w-7" />
                <span className="font-semibold">{c.name}</span>
                {c.description && <span className="line-clamp-2 text-xs text-muted">{c.description}</span>}
              </label>
            ))}
          </div>
          {errors.categoryId && <p className="mt-2 text-sm text-critical" role="alert">{errors.categoryId}</p>}
        </fieldset>
      )}

      {step === 1 && (
        <div className="space-y-5">
          <h2 className="text-xl font-semibold">Describe the requirement</h2>
          <Callout tone="privacy" title="Keep it dignified and anonymous">Describe the need, not the people. Don&apos;t include names, phone numbers, addresses or links — the platform coordinates all contact.</Callout>
          <Field label="Title" htmlFor="title" required error={errors.title} help="e.g. “School bags for the new academic year”">
            <Input id="title" value={form.title} onChange={set("title")} maxLength={90} invalid={!!errors.title} />
          </Field>
          <Field label="Why is this needed?" htmlFor="description" required error={errors.description}>
            <Textarea id="description" rows={5} value={form.description} onChange={set("description")} maxLength={1200} invalid={!!errors.description} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Urgency" htmlFor="urgency"><Select id="urgency" value={form.urgency} onChange={set("urgency")}>{["CRITICAL", "HIGH", "MEDIUM", "NORMAL"].map((p) => <option key={p} value={p}>{p[0] + p.slice(1).toLowerCase()}</option>)}</Select></Field>
            <Field label="Required by" htmlFor="neededBy" error={errors.neededBy}><Input id="neededBy" type="date" value={form.neededBy} onChange={set("neededBy")} /></Field>
            <Field label="People who will benefit" htmlFor="people" help="Private — used for prioritisation only."><Input id="people" type="number" min={1} value={form.peopleAffected} onChange={set("peopleAffected")} /></Field>
            <Field label="District" htmlFor="w-district" required error={errors.district}><Select id="w-district" value={form.district} onChange={set("district")}>{KERALA_DISTRICTS.map((d) => <option key={d} value={d}>{d}</option>)}</Select></Field>
            <Field label="City / town (shown publicly)" htmlFor="w-city" error={errors.city}><Input id="w-city" value={form.city} onChange={set("city")} /></Field>
            {recurringEnabled && (
              <Field label="Recurring?" htmlFor="recurrence" help="Recurring requests need admin approval."><Select id="recurrence" value={form.recurrence} onChange={set("recurrence")}>{[["NONE", "One-time"], ["WEEKLY", "Weekly"], ["MONTHLY", "Monthly"], ["QUARTERLY", "Quarterly"]].map(([v, l]) => <option key={v} value={v}>{l}</option>)}</Select></Field>
            )}
          </div>
          <fieldset>
            <legend className="mb-2 text-sm font-semibold">Accepted delivery methods</legend>
            <div className="flex flex-wrap gap-4">
              {[["PLATFORM_PICKUP", "Platform pickup"], ["PARTNER_DROPOFF", "Partner drop-off"], ["DELIVERY", "Courier delivery"]].map(([v, l]) => (
                <Checkbox key={v} label={l} checked={methods.includes(v)} onChange={(e) => setMethods((m) => (e.target.checked ? [...m, v] : m.filter((x) => x !== v)))} />
              ))}
            </div>
            {errors.deliveryMethods && <p className="mt-1 text-sm text-critical" role="alert">{errors.deliveryMethods}</p>}
          </fieldset>
        </div>
      )}

      {step === 2 && category && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">What do you need? <span className="text-base font-normal text-muted">— {category.name}</span></h2>
          <p className="text-muted">
            {productTypes.length ? "Pick a product type for each item to fill in its measurements and details. " : ""}
            Each item is tracked independently, so donors can fulfil part of the request.
          </p>
          {items.map((it, idx) => {
            const fields = itemFields(it);
            const showDetails = !productTypes.length || !!it.productType;
            const typeName = findProductType(category.fieldSchema, it.productType)?.name;
            return (
              <div key={it.key} className="relative space-y-3 rounded-2xl border border-line p-4" data-testid="request-item">
                <Button variant="ghost" aria-label={`Remove ${it.name || "item"}`} disabled={items.length === 1} onClick={() => setItems((l) => l.filter((x) => x.key !== it.key))} className="absolute right-2 top-2 h-10 w-10 px-0!"><Trash2 className="h-4 w-4" /></Button>
                <div className="grid gap-3 pr-10 sm:grid-cols-2">
                  {productTypes.length > 0 && (
                    <Field label="Product type" htmlFor={`type-${it.key}`} required error={errors[`items.${idx}.attributes.${PRODUCT_TYPE_KEY}`]}>
                      <Select id={`type-${it.key}`} value={it.productType} onChange={(e) => chooseProductType(it, e.target.value)} invalid={!!errors[`items.${idx}.attributes.${PRODUCT_TYPE_KEY}`]}>
                        <option value="">Choose…</option>
                        {productTypes.map((t) => <option key={t.name} value={t.name}>{t.name}</option>)}
                        <option value={OTHER}>Something else</option>
                      </Select>
                    </Field>
                  )}
                  <Field label="Item" htmlFor={`name-${it.key}`} error={errors[`items.${idx}.name`]}><Input id={`name-${it.key}`} value={it.name} onChange={(e) => updateItem(it.key, { name: e.target.value })} placeholder="e.g. Notebook" /></Field>
                </div>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  <Field label="Quantity" htmlFor={`qty-${it.key}`} error={errors[`items.${idx}.quantity`]}><Input id={`qty-${it.key}`} type="number" min={1} value={it.quantity} onChange={(e) => updateItem(it.key, { quantity: e.target.value })} /></Field>
                  <Field label="Unit" htmlFor={`unit-${it.key}`}><Input id={`unit-${it.key}`} value={it.unit} onChange={(e) => updateItem(it.key, { unit: e.target.value })} placeholder="pcs, kg…" /></Field>
                  <Field label="Est. ₹ / unit (optional)" htmlFor={`val-${it.key}`} className="col-span-2 sm:col-span-1"><Input id={`val-${it.key}`} type="number" min={0} value={it.estimatedUnitValue} onChange={(e) => updateItem(it.key, { estimatedUnitValue: e.target.value })} /></Field>
                </div>
                {showDetails && fields.length > 0 && (
                  <fieldset className="rounded-xl bg-surface-2 p-3">
                    <legend className="float-left mb-3 w-full text-sm font-semibold">{typeName ? `${typeName} details` : "Details"}</legend>
                    <div className="clear-both grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {fields.map((f) => (
                        <AttributeField key={`${it.productType}-${f.key}`} field={f} id={`${f.key}-${it.key}`} value={it.attributes[f.key] ?? ""} error={errors[`items.${idx}.attributes.${f.key}`]} onChange={(v) => updateItem(it.key, { attributes: { ...it.attributes, [f.key]: v } })} />
                      ))}
                    </div>
                  </fieldset>
                )}
              </div>
            );
          })}
          {errors.items && <p className="text-sm text-critical" role="alert">{errors.items}</p>}
          <Button variant="outline" icon={<Plus className="h-4 w-4" />} disabled={items.length >= 10} onClick={() => setItems((l) => [...l, blankItem(Math.max(...l.map((x) => x.key)) + 1)])}>Add another item</Button>
        </div>
      )}

      {step === 3 && category && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Review</h2>
          <div className="rounded-2xl border border-line p-5">
            <p className="text-sm text-muted">{category.name} · {form.district}{form.city ? `, ${form.city}` : ""} · {form.urgency.toLowerCase()} urgency{form.recurrence !== "NONE" ? ` · ${form.recurrence.toLowerCase()}` : ""}</p>
            <p className="mt-2 text-lg font-semibold">{form.title}</p>
            <p className="mt-2 whitespace-pre-line text-muted">{form.description}</p>
            <ul className="mt-4 space-y-1 border-t border-line pt-4">
              {items.map((i) => {
                const details = itemFields(i).filter((f) => i.attributes[f.key]?.trim()).map((f) => `${f.label}: ${formatAttributeValue(i.attributes[f.key])}`);
                const typeName = findProductType(category.fieldSchema, i.productType)?.name;
                return (
                  <li key={i.key}>
                    <span className="font-semibold">{i.quantity} {i.unit !== "pcs" ? i.unit : ""} × {i.name}</span>
                    {typeName && typeName !== i.name && <span className="text-sm text-muted"> ({typeName})</span>}
                    {details.length > 0 && <span className="text-sm text-muted"> — {details.join(", ")}</span>}
                  </li>
                );
              })}
            </ul>
          </div>
          <Callout tone="info" title="What happens next">Your request enters <strong>pending verification</strong>. Once our team approves it, it appears publicly as from a “Verified” organisation — your organisation&apos;s name and contact details are never shown.</Callout>
        </div>
      )}

      {error && <div className="mt-5"><Callout tone="danger" title={error} /></div>}

      <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5">
        <Button variant="ghost" disabled={step === 0} onClick={() => setStep((s) => s - 1)}>Back</Button>
        {step < STEPS.length - 1 ? (
          <Button onClick={next}>Continue</Button>
        ) : (
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => submit(true)} loading={submitting}>Save draft</Button>
            <Button onClick={() => submit(false)} loading={submitting}>Submit for review</Button>
          </div>
        )}
      </div>
    </div>
  );
}
