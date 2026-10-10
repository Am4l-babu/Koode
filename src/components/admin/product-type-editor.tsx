"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Plus, RotateCcw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/ui/dialog";
import { Checkbox, Field, Input, Select } from "@/components/ui/form";
import { AttributeField } from "@/components/ui/attribute-field";
import { Callout } from "@/components/ui/states";
import { cn } from "@/components/ui/cn";
import { api, ApiError } from "@/lib/client-api";
import { AGE_GROUPS, donorFieldsFor, fieldsFor, FIELD_TYPES, PRODUCT_TYPE_KEY, toFieldKey, type FieldDef, type ProductType } from "@/lib/categories";

type FieldType = FieldDef["type"];
type Ask = NonNullable<FieldDef["ask"]>;

const TYPE_LABELS: Record<FieldType, string> = {
  text: "Short text",
  number: "Number",
  select: "Pick from a list",
  boolean: "Yes / no",
  ageRange: "Age range",
  measure: "Measurement (number + unit)",
  date: "Date",
};
const ASK_LABELS: Record<Ask, string> = { recipient: "Organisation only", donor: "Donor only", both: "Organisation and donor" };
const UNITS = ["cm", "mm", "m", "in", "ft", "kg", "g", "L", "ml", "W"];
const MAX_TYPES = 30;
const MAX_FIELDS = 12;

interface DraftField extends FieldDef {
  uid: string;
  /** Not saved yet: its key still follows the label. */
  fresh: boolean;
  optionsText: string;
}
interface DraftType {
  uid: string;
  name: string;
  /** The saved name, to warn when renaming a type open requests use. */
  savedName?: string;
  unit: string;
  hide: string[];
  fields: DraftField[];
}

let counter = 0;
const uid = () => `d${++counter}`;

function toDraft(types: ProductType[]): DraftType[] {
  return types.map((t) => ({
    uid: uid(),
    name: t.name,
    savedName: t.name,
    unit: t.unit ?? "",
    hide: t.hide ?? [],
    fields: t.fields.map((f) => ({ ...f, uid: uid(), fresh: false, optionsText: (f.options ?? []).join(", ") })),
  }));
}

function splitOptions(text: string): string[] {
  return [...new Set(text.split(",").map((s) => s.trim()).filter(Boolean))];
}

function toPayload(types: DraftType[]): ProductType[] {
  return types.map((t) => ({
    name: t.name.trim(),
    ...(t.unit.trim() ? { unit: t.unit.trim() } : {}),
    ...(t.hide.length ? { hide: t.hide } : {}),
    fields: t.fields.map((f) => ({
      key: f.key,
      label: f.label,
      type: f.type,
      ...(f.type === "select" || f.type === "ageRange" ? { options: splitOptions(f.optionsText) } : {}),
      ...(f.type === "measure" ? { units: f.units ?? [] } : {}),
      ...(f.required && f.ask !== "donor" ? { required: true } : {}),
      ...(f.placeholder ? { placeholder: f.placeholder } : {}),
      ...(f.help ? { help: f.help } : {}),
      ...(f.ask ? { ask: f.ask } : {}),
    })),
  }));
}

/** A key for a new detail that doesn't clash with the product's other details. */
function freshKey(label: string, taken: string[]): string {
  const base = toFieldKey(label) || "detail";
  let key = base === PRODUCT_TYPE_KEY ? `${base}Detail` : base;
  for (let n = 2; taken.includes(key); n++) key = `${base.slice(0, 29)}${n}`;
  return key;
}

export function ProductTypeEditor({
  slug,
  categoryName,
  categoryFields,
  initial,
  customised: initialCustomised,
  hasBuiltIn,
  usage,
}: {
  slug: string;
  categoryName: string;
  categoryFields: FieldDef[];
  initial: ProductType[];
  customised: boolean;
  hasBuiltIn: boolean;
  usage: Record<string, number>;
}) {
  const router = useRouter();
  const [types, setTypes] = useState<DraftType[]>(() => toDraft(initial));
  const [selected, setSelected] = useState<string | null>(types[0]?.uid ?? null);
  const [customised, setCustomised] = useState(initialCustomised);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState<"save" | "reset" | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<{ tone: "success" | "danger"; text: string } | null>(null);
  const [removing, setRemoving] = useState<DraftType | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);

  const index = types.findIndex((t) => t.uid === selected);
  const current = index >= 0 ? types[index]! : null;
  /** The first server error at or under this path of the selected product type. */
  const err = (path: string) => {
    if (index < 0) return undefined;
    const at = `productTypes.${index}.${path}`;
    return errors[at] ?? Object.entries(errors).find(([k]) => k.startsWith(`${at}.`))?.[1];
  };
  const typeHasError = (i: number) => Object.keys(errors).some((k) => k.startsWith(`productTypes.${i}.`));

  function change(next: DraftType[]) {
    setTypes(next);
    setDirty(true);
    setMessage(null);
  }
  const updateType = (patch: Partial<DraftType>) => change(types.map((t) => (t.uid === selected ? { ...t, ...patch } : t)));
  function updateField(fieldUid: string, patch: Partial<DraftField>) {
    if (!current) return;
    updateType({
      fields: current.fields.map((f) => {
        if (f.uid !== fieldUid) return f;
        const next = { ...f, ...patch };
        if (f.fresh && patch.label !== undefined) next.key = freshKey(patch.label, current.fields.filter((o) => o.uid !== f.uid).map((o) => o.key));
        if (patch.type === "ageRange" && !next.optionsText) next.optionsText = AGE_GROUPS.join(", ");
        if (patch.type === "measure" && !next.units?.length) next.units = ["cm"];
        return next;
      }),
    });
  }
  function moveField(i: number, by: -1 | 1) {
    if (!current) return;
    const fields = [...current.fields];
    [fields[i], fields[i + by]] = [fields[i + by]!, fields[i]!];
    updateType({ fields });
  }
  function moveType(i: number, by: -1 | 1) {
    const next = [...types];
    [next[i], next[i + by]] = [next[i + by]!, next[i]!];
    change(next);
  }
  function addType() {
    const t: DraftType = { uid: uid(), name: "", unit: "", hide: [], fields: [] };
    change([...types, t]);
    setSelected(t.uid);
  }
  function addField() {
    if (!current) return;
    const field: DraftField = { uid: uid(), fresh: true, key: freshKey("Detail", current.fields.map((f) => f.key)), label: "", type: "text", optionsText: "" };
    updateType({ fields: [...current.fields, field] });
  }
  function removeType(t: DraftType) {
    const next = types.filter((x) => x.uid !== t.uid);
    change(next);
    setSelected(next[Math.max(0, types.indexOf(t) - 1)]?.uid ?? null);
    setRemoving(null);
  }

  async function save(productTypes: ProductType[] | null) {
    setBusy(productTypes ? "save" : "reset");
    setErrors({});
    setMessage(null);
    try {
      const r = await api<{ productTypes: ProductType[]; customised: boolean }>(`/api/admin/categories/${slug}/product-types`, { method: "PUT", body: { productTypes } });
      const next = toDraft(r.productTypes);
      setTypes(next);
      setSelected(next[Math.max(0, index)]?.uid ?? next[0]?.uid ?? null);
      setCustomised(r.customised);
      setDirty(false);
      setMessage({ tone: "success", text: productTypes ? "Product types saved. Organisations see them in the request builder now." : "Back to the built-in product types." });
      router.refresh();
    } catch (e) {
      if (e instanceof ApiError && Object.keys(e.fields).length) {
        setErrors(e.fields);
        const first = Number(Object.keys(e.fields)[0]?.split(".")[1]);
        if (types[first]) setSelected(types[first]!.uid);
      }
      setMessage({ tone: "danger", text: e instanceof ApiError ? e.message : "Something didn't go as planned." });
    } finally {
      setBusy(null);
      setConfirmReset(false);
    }
  }

  const renamedFrom = current?.savedName && current.savedName !== current.name.trim() && usage[current.savedName] ? current.savedName : null;

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-[18rem_1fr]">
        <section className="card self-start p-3" aria-labelledby="pt-list-heading">
          <div className="flex items-center justify-between px-2 py-1.5">
            <h2 id="pt-list-heading" className="font-semibold">Product types <span className="text-sm font-normal text-muted">({types.length})</span></h2>
            {customised ? <Badge tone="primary">Customised</Badge> : hasBuiltIn ? <Badge>Built-in</Badge> : null}
          </div>
          {types.length === 0 && <p className="px-2 py-3 text-sm text-muted">No product types yet. Organisations describe items with the category’s own fields.</p>}
          <ul className="mt-1 space-y-1">
            {types.map((t, i) => (
              <li key={t.uid} className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setSelected(t.uid)}
                  aria-current={t.uid === selected || undefined}
                  className={cn(
                    "flex min-h-11 flex-1 items-center justify-between gap-2 rounded-xl px-3 py-2 text-left text-sm",
                    t.uid === selected ? "bg-primary-soft font-semibold text-primary-ink" : "hover:bg-surface-2",
                    typeHasError(i) && "ring-1 ring-critical",
                  )}
                >
                  <span className="min-w-0 truncate">{t.name.trim() || <em className="text-muted">Unnamed</em>}</span>
                  <span className="shrink-0 text-xs font-normal text-muted">
                    {t.fields.length} {t.fields.length === 1 ? "detail" : "details"}
                    {t.savedName && usage[t.savedName] ? ` · ${usage[t.savedName]} open` : ""}
                  </span>
                </button>
                <span className="flex flex-col">
                  <button type="button" disabled={i === 0} onClick={() => moveType(i, -1)} aria-label={`Move ${t.name || "product type"} up`} className="rounded p-0.5 text-muted hover:text-fg disabled:opacity-30"><ArrowUp className="h-3.5 w-3.5" /></button>
                  <button type="button" disabled={i === types.length - 1} onClick={() => moveType(i, 1)} aria-label={`Move ${t.name || "product type"} down`} className="rounded p-0.5 text-muted hover:text-fg disabled:opacity-30"><ArrowDown className="h-3.5 w-3.5" /></button>
                </span>
              </li>
            ))}
          </ul>
          <Button variant="outline" size="sm" className="mt-3 w-full" icon={<Plus className="h-4 w-4" />} onClick={addType} disabled={types.length >= MAX_TYPES}>
            Add product type
          </Button>
        </section>

        {current ? (
          <section className="card space-y-5 p-5" aria-label={`Edit ${current.name || "new product type"}`}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <h2 className="text-lg font-semibold">{current.name.trim() || "New product type"}</h2>
              <Button variant="ghost" size="sm" icon={<Trash2 className="h-4 w-4" />} onClick={() => (current.savedName && usage[current.savedName] ? setRemoving(current) : removeType(current))}>
                Remove product type
              </Button>
            </div>
            <div className="grid gap-4 sm:grid-cols-[1fr_12rem]">
              <Field label="Name" htmlFor="pt-name" required error={err("name")} help="What organisations pick, e.g. “Hearing aid”.">
                <Input id="pt-name" value={current.name} maxLength={40} invalid={!!err("name")} onChange={(e) => updateType({ name: e.target.value })} />
              </Field>
              <Field label="Default quantity unit" htmlFor="pt-unit" help="e.g. pairs, kg, packs">
                <Input id="pt-unit" value={current.unit} maxLength={16} onChange={(e) => updateType({ unit: e.target.value })} />
              </Field>
            </div>
            {renamedFrom && (
              <Callout tone="warning" title={`${usage[renamedFrom]} open request${usage[renamedFrom] === 1 ? "" : "s"} use “${renamedFrom}”.`}>
                They keep their details, but won’t show under the new name in the product filter.
              </Callout>
            )}
            {categoryFields.length > 0 && (
              <fieldset>
                <legend className="text-sm font-semibold">{categoryName} details this product doesn’t need</legend>
                <p className="mt-0.5 text-xs text-muted">Every {categoryName.toLowerCase()} item is asked these unless you hide them here or the product has its own detail with the same key.</p>
                <div className="mt-2 flex flex-wrap gap-x-5 gap-y-2">
                  {categoryFields.map((f) => (
                    <Checkbox key={f.key} label={f.label} checked={current.hide.includes(f.key)}
                      onChange={(e) => updateType({ hide: e.target.checked ? [...current.hide, f.key] : current.hide.filter((k) => k !== f.key) })} />
                  ))}
                </div>
              </fieldset>
            )}

            <div>
              <h3 className="font-semibold">Details to ask</h3>
              <p className="text-xs text-muted">Measurements, sizes and other specifics for this product. Up to {MAX_FIELDS}.</p>
              <ol className="mt-3 space-y-3">
                {current.fields.map((f, i) => (
                  <li key={f.uid} className="rounded-2xl border border-line p-4" aria-label={`Detail ${i + 1}: ${f.label || "unnamed"}`}>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Field label="Label" htmlFor={`pf-${f.uid}-label`} required error={err(`fields.${i}.label`) ?? err(`fields.${i}.key`)}
                        help={<>Saved as <code className="font-mono">{f.key}</code>{!f.fresh && " (fixed once saved)"}</>}>
                        <Input id={`pf-${f.uid}-label`} value={f.label} maxLength={60} invalid={!!err(`fields.${i}.label`)} onChange={(e) => updateField(f.uid, { label: e.target.value })} />
                      </Field>
                      <Field label="Answer type" htmlFor={`pf-${f.uid}-type`}>
                        <Select id={`pf-${f.uid}-type`} value={f.type} onChange={(e) => updateField(f.uid, { type: e.target.value as FieldType })}>
                          {FIELD_TYPES.map((t) => <option key={t} value={t}>{TYPE_LABELS[t]}</option>)}
                        </Select>
                      </Field>
                      {(f.type === "select" || f.type === "ageRange") && (
                        <Field label="Choices" htmlFor={`pf-${f.uid}-options`} className="sm:col-span-2" required={f.type === "select"} error={err(`fields.${i}.options`)} help="Separate with commas, e.g. Small, Medium, Large">
                          <Input id={`pf-${f.uid}-options`} value={f.optionsText} invalid={!!err(`fields.${i}.options`)} onChange={(e) => updateField(f.uid, { optionsText: e.target.value })} />
                        </Field>
                      )}
                      {f.type === "measure" && (
                        <fieldset className="sm:col-span-2">
                          <legend className="text-sm font-semibold">Units</legend>
                          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2">
                            {[...new Set([...UNITS, ...(f.units ?? [])])].map((u) => (
                              <Checkbox key={u} label={u} checked={f.units?.includes(u) ?? false}
                                onChange={(e) => updateField(f.uid, { units: e.target.checked ? [...(f.units ?? []), u] : (f.units ?? []).filter((x) => x !== u) })} />
                            ))}
                          </div>
                          {err(`fields.${i}.units`) && <p role="alert" className="mt-1 text-xs font-medium text-critical">{err(`fields.${i}.units`)}</p>}
                        </fieldset>
                      )}
                      <Field label="Asked of" htmlFor={`pf-${f.uid}-ask`} help="Donors are asked about what they're giving.">
                        <Select id={`pf-${f.uid}-ask`} value={f.ask ?? "recipient"} onChange={(e) => updateField(f.uid, { ask: e.target.value as Ask })}>
                          {(Object.keys(ASK_LABELS) as Ask[]).map((a) => <option key={a} value={a}>{ASK_LABELS[a]}</option>)}
                        </Select>
                      </Field>
                      <Field label="Example shown in the box" htmlFor={`pf-${f.uid}-placeholder`}>
                        <Input id={`pf-${f.uid}-placeholder`} value={f.placeholder ?? ""} maxLength={80} placeholder="e.g. 200" onChange={(e) => updateField(f.uid, { placeholder: e.target.value })} />
                      </Field>
                      <Field label="Help text" htmlFor={`pf-${f.uid}-help`} className="sm:col-span-2">
                        <Input id={`pf-${f.uid}-help`} value={f.help ?? ""} maxLength={140} onChange={(e) => updateField(f.uid, { help: e.target.value })} />
                      </Field>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                      <Checkbox label="Organisations must fill this in" checked={!!f.required} disabled={f.ask === "donor"} onChange={(e) => updateField(f.uid, { required: e.target.checked })} />
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" className="px-0! w-9" disabled={i === 0} onClick={() => moveField(i, -1)} aria-label={`Move ${f.label || "detail"} up`}><ArrowUp className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="sm" className="px-0! w-9" disabled={i === current.fields.length - 1} onClick={() => moveField(i, 1)} aria-label={`Move ${f.label || "detail"} down`}><ArrowDown className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="sm" icon={<Trash2 className="h-4 w-4" />} onClick={() => updateType({ fields: current.fields.filter((x) => x.uid !== f.uid) })}>Remove</Button>
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
              <Button variant="outline" size="sm" className="mt-3" icon={<Plus className="h-4 w-4" />} onClick={addField} disabled={current.fields.length >= MAX_FIELDS}>
                Add detail
              </Button>
            </div>

            <Preview key={current.uid} categoryFields={categoryFields} type={toPayload([current])[0]!} />
          </section>
        ) : (
          <section className="card grid place-items-center p-10 text-center text-sm text-muted">Add a product type to start.</section>
        )}
      </div>

      <div className="sticky bottom-3 z-10 flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-surface p-3 shadow-card">
        <Button onClick={() => save(toPayload(types))} loading={busy === "save"} disabled={!dirty && customised}>Save product types</Button>
        {hasBuiltIn && customised && (
          <Button variant="ghost" icon={<RotateCcw className="h-4 w-4" />} onClick={() => setConfirmReset(true)}>Restore built-in list</Button>
        )}
        <span className="text-sm text-muted" aria-live="polite">{dirty ? "Unsaved changes" : customised ? "All changes saved" : "Using the built-in list. Saving makes it your own."}</span>
        {message && <div className="basis-full"><Callout tone={message.tone} title={message.text} /></div>}
      </div>

      <ConfirmDialog open={!!removing} onClose={() => setRemoving(null)} onConfirm={() => removing && removeType(removing)} tone="danger" confirmLabel="Remove"
        title={`Remove “${removing?.savedName}”?`}
        description={`${usage[removing?.savedName ?? ""] ?? 0} open request(s) use it. They keep their details, but new requests can't pick it. Nothing changes until you save.`} />
      <ConfirmDialog open={confirmReset} onClose={() => setConfirmReset(false)} onConfirm={() => save(null)} loading={busy === "reset"} confirmLabel="Restore"
        title="Restore the built-in product types?"
        description="Your changes to this category's product types are replaced by the list that ships with Koode. Requests already made keep their details." />
    </div>
  );
}

/** What organisations fill in and what donors are asked, for the product being edited. */
function Preview({ categoryFields, type }: { categoryFields: FieldDef[]; type: ProductType }) {
  const [values, setValues] = useState<Record<string, string>>({});
  const schema = { fields: categoryFields, productTypes: [type] };
  const recipient = fieldsFor(schema, type.name, "recipient");
  const donor = donorFieldsFor(schema, { [PRODUCT_TYPE_KEY]: type.name });
  const column = (title: string, fields: FieldDef[], prefix: string) => (
    <div className="space-y-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">{title}</p>
      {fields.length === 0 && <p className="text-sm text-muted">Nothing extra is asked.</p>}
      {fields.map((f) => (
        <AttributeField key={f.key} field={f} id={`${prefix}-${f.key}`} value={values[`${prefix}.${f.key}`] ?? ""} onChange={(v) => setValues((s) => ({ ...s, [`${prefix}.${f.key}`]: v }))} />
      ))}
    </div>
  );
  return (
    <section className="rounded-2xl bg-surface-2 p-4" aria-label="Preview">
      <h3 className="font-semibold">Preview</h3>
      <p className="mb-4 text-xs text-muted">How the form looks once you save. Typing here saves nothing.</p>
      <div className="grid gap-6 md:grid-cols-2">
        {column("Organisation's request", recipient, "pv-r")}
        {column("Donor's offer", donor, "pv-d")}
      </div>
    </section>
  );
}
