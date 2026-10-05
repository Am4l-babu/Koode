"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Check, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/form";
import { Callout } from "@/components/ui/states";
import { cn } from "@/components/ui/cn";
import { api, ApiError } from "@/lib/client-api";
import { KERALA_DISTRICTS } from "@/lib/geo";
import type { CategorySchema, FieldDef } from "@/lib/categories";
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
  name: string;
  quantity: string;
  unit: string;
  estimatedUnitValue: string;
  attributes: Record<string, string>;
}

const STEPS = ["Category", "Describe", "Quantities", "Variants", "Review"];
const blankItem = (key: number): ItemDraft => ({ key, name: "", quantity: "", unit: "pcs", estimatedUnitValue: "", attributes: {} });

/**
 * Smart request builder. Variant fields are rendered from the category's
 * `fieldSchema` — adding a category in the admin panel adds its form here
 * with no code change.
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
        if (it.name.trim().length < 2) e[`items.${idx}.name`] = "Name the item.";
        const q = Number(it.quantity);
        if (!Number.isInteger(q) || q < 1) e[`items.${idx}.quantity`] = "Enter a whole number of at least 1.";
      });
    }
    if (step === 3 && category) {
      items.forEach((it, idx) => {
        for (const f of category.fieldSchema.fields) {
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
          items: items.map((i) => ({
            name: i.name.trim(),
            quantity: Number(i.quantity),
            unit: i.unit.trim() || "pcs",
            estimatedUnitValue: i.estimatedUnitValue ? Number(i.estimatedUnitValue) : undefined,
            attributes: i.attributes,
          })),
        },
      });
      router.push(`/recipient/requests/${res.id}?created=1`);
      router.refresh();
    } catch (e) {
      if (e instanceof ApiError) {
        setError(e.message);
        setErrors(e.fields);
        const keys = Object.keys(e.fields);
        if (keys.some((k) => k.includes(".attributes."))) setStep(3);
        else if (keys.some((k) => k.startsWith("items"))) setStep(2);
        else if (keys.some((k) => ["title", "description", "district", "city", "neededBy"].includes(k))) setStep(1);
      } else setError("Something didn't go as planned.");
      setSubmitting(false);
    }
  }

  return (
    <div className="card p-5 sm:p-8">
      <ol className="mb-8 flex items-center gap-2" aria-label="Request steps">
        {STEPS.map((label, i) => (
          <li key={label} className="flex flex-1 items-center gap-2" aria-current={i === step ? "step" : undefined}>
            <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold", i < step ? "bg-secondary text-white" : i === step ? "bg-primary text-primary-fg" : "bg-surface-3 text-muted")}>
              {i < step ? <Check className="h-4 w-4" aria-hidden="true" /> : i + 1}
            </span>
            <span className={cn("hidden text-sm font-semibold md:block", i === step ? "text-fg" : "text-subtle")}>{label}</span>
            {i < STEPS.length - 1 && <span className="h-px flex-1 bg-line" aria-hidden="true" />}
          </li>
        ))}
      </ol>

      {step === 0 && (
        <fieldset>
          <legend className="text-xl font-semibold">What kind of support do you need?</legend>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {categories.map((c) => (
              <label key={c.id} className={cn("flex cursor-pointer items-start gap-3 rounded-2xl border p-4 transition-colors", categoryId === c.id ? "border-primary bg-primary-soft" : "border-line hover:border-line-strong")}>
                <input type="radio" name="category" value={c.id} checked={categoryId === c.id} onChange={() => setCategoryId(c.id)} className="sr-only" />
                <span className="text-2xl" aria-hidden="true">{c.icon}</span>
                <span><span className="block font-semibold">{c.name}</span><span className="block text-sm text-muted">{c.description}</span></span>
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

      {step === 2 && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Specify quantities</h2>
          <p className="text-muted">Each item is tracked independently, so donors can fulfil part of the request.</p>
          {items.map((it, idx) => (
            <div key={it.key} className="grid gap-3 rounded-2xl border border-line p-4 sm:grid-cols-[2fr_1fr_1fr_1fr_auto] sm:items-end">
              <Field label="Item" htmlFor={`name-${it.key}`} error={errors[`items.${idx}.name`]}><Input id={`name-${it.key}`} value={it.name} onChange={(e) => updateItem(it.key, { name: e.target.value })} placeholder="e.g. Notebook" /></Field>
              <Field label="Quantity" htmlFor={`qty-${it.key}`} error={errors[`items.${idx}.quantity`]}><Input id={`qty-${it.key}`} type="number" min={1} value={it.quantity} onChange={(e) => updateItem(it.key, { quantity: e.target.value })} /></Field>
              <Field label="Unit" htmlFor={`unit-${it.key}`}><Input id={`unit-${it.key}`} value={it.unit} onChange={(e) => updateItem(it.key, { unit: e.target.value })} placeholder="pcs, kg…" /></Field>
              <Field label="Est. ₹ / unit" htmlFor={`val-${it.key}`} help="Optional"><Input id={`val-${it.key}`} type="number" min={0} value={it.estimatedUnitValue} onChange={(e) => updateItem(it.key, { estimatedUnitValue: e.target.value })} /></Field>
              <Button variant="ghost" aria-label={`Remove ${it.name || "item"}`} disabled={items.length === 1} onClick={() => setItems((l) => l.filter((x) => x.key !== it.key))} className="h-11 w-11 px-0"><Trash2 className="h-4 w-4" /></Button>
            </div>
          ))}
          {errors.items && <p className="text-sm text-critical" role="alert">{errors.items}</p>}
          <Button variant="outline" icon={<Plus className="h-4 w-4" />} disabled={items.length >= 10} onClick={() => setItems((l) => [...l, blankItem(Math.max(...l.map((x) => x.key)) + 1)])}>Add another item</Button>
        </div>
      )}

      {step === 3 && category && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Add variants <span className="text-base font-normal text-muted">— {category.icon} {category.name}</span></h2>
          {category.fieldSchema.fields.length === 0 && <p className="text-muted">No extra details needed for this category.</p>}
          {items.map((it, idx) => (
            <div key={it.key} className="rounded-2xl border border-line p-4">
              <p className="font-semibold">{it.name} <span className="font-normal text-muted">× {it.quantity} {it.unit}</span></p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {category.fieldSchema.fields.map((f) => (
                  <DynamicField key={f.key} field={f} id={`${f.key}-${it.key}`} value={it.attributes[f.key] ?? ""} error={errors[`items.${idx}.attributes.${f.key}`]} onChange={(v) => updateItem(it.key, { attributes: { ...it.attributes, [f.key]: v } })} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {step === 4 && category && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Review</h2>
          <div className="rounded-2xl border border-line p-5">
            <p className="text-sm text-muted">{category.icon} {category.name} · {form.district}{form.city ? `, ${form.city}` : ""} · {form.urgency.toLowerCase()} urgency{form.recurrence !== "NONE" ? ` · ${form.recurrence.toLowerCase()}` : ""}</p>
            <p className="mt-2 text-lg font-semibold">{form.title}</p>
            <p className="mt-2 whitespace-pre-line text-muted">{form.description}</p>
            <ul className="mt-4 space-y-1 border-t border-line pt-4">
              {items.map((i) => (
                <li key={i.key}>
                  <span className="font-semibold">{i.quantity} {i.unit !== "pcs" ? i.unit : ""} × {i.name}</span>
                  {Object.entries(i.attributes).filter(([, v]) => v).length > 0 && <span className="text-sm text-muted"> — {Object.entries(i.attributes).filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`).join(", ")}</span>}
                </li>
              ))}
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

function DynamicField({ field, id, value, error, onChange }: { field: FieldDef; id: string; value: string; error?: string; onChange: (v: string) => void }) {
  if (field.type === "select" || (field.type === "ageRange" && field.options?.length)) {
    return (
      <Field label={field.label} htmlFor={id} required={field.required} error={error} help={field.help}>
        <Select id={id} value={value} onChange={(e) => onChange(e.target.value)} invalid={!!error}>
          <option value="">{field.required ? "Choose…" : "Any / not specified"}</option>
          {field.options?.map((o) => <option key={o} value={o}>{o}</option>)}
        </Select>
      </Field>
    );
  }
  if (field.type === "boolean") {
    return <Checkbox label={field.label} checked={value === "true"} onChange={(e) => onChange(String(e.target.checked))} />;
  }
  return (
    <Field label={field.label} htmlFor={id} required={field.required} error={error} help={field.help}>
      <Input id={id} type={field.type === "number" ? "number" : "text"} value={value} placeholder={field.placeholder} onChange={(e) => onChange(e.target.value)} invalid={!!error} />
    </Field>
  );
}
