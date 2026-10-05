"use client";

import { useState } from "react";
import type { FieldDef } from "@/lib/categories";
import { Checkbox, Field, Input, Select } from "./form";

/**
 * One product detail rendered from its schema definition. Values are kept as
 * strings; a measurement is stored as "30 cm".
 *
 * `choices` turns a free-text field into a pick-list (e.g. the sizes a
 * recipient listed), and `placeholderOption` names the empty choice.
 */
export function AttributeField({
  field,
  id,
  value,
  error,
  help,
  choices,
  placeholderOption,
  required = field.required,
  onChange,
}: {
  field: FieldDef;
  id: string;
  value: string;
  error?: string;
  help?: string;
  choices?: string[];
  placeholderOption?: string;
  required?: boolean;
  onChange: (value: string) => void;
}) {
  const hint = help ?? field.help;
  const options = choices?.length ? choices : field.options;

  if (field.type === "boolean") {
    return <Checkbox label={field.label} checked={value === "true"} onChange={(e) => onChange(e.target.checked ? "true" : "")} />;
  }
  if (field.type === "measure") {
    return <MeasureField field={field} id={id} value={value} error={error} help={hint} required={required} onChange={onChange} />;
  }
  if (options?.length && (field.type === "select" || field.type === "ageRange" || choices?.length)) {
    return (
      <Field label={field.label} htmlFor={id} required={required} error={error} help={hint}>
        <Select id={id} value={value} onChange={(e) => onChange(e.target.value)} invalid={!!error}>
          <option value="">{placeholderOption ?? (required ? "Choose…" : "Any / not specified")}</option>
          {options.map((o) => <option key={o} value={o}>{o}</option>)}
        </Select>
      </Field>
    );
  }
  return (
    <Field label={field.label} htmlFor={id} required={required} error={error} help={hint}>
      <Input
        id={id}
        type={field.type === "number" ? "number" : field.type === "date" ? "date" : "text"}
        min={field.type === "number" ? 0 : undefined}
        value={value}
        placeholder={field.placeholder}
        onChange={(e) => onChange(e.target.value)}
        invalid={!!error}
      />
    </Field>
  );
}

function MeasureField({ field, id, value, error, help, required, onChange }: { field: FieldDef; id: string; value: string; error?: string; help?: string; required?: boolean; onChange: (value: string) => void }) {
  const units = field.units ?? [];
  const [amountPart = "", unitPart] = value.split(" ");
  const [unit, setUnit] = useState(unitPart && units.includes(unitPart) ? unitPart : units[0] ?? "");
  const emit = (amount: string, u: string) => onChange(amount.trim() ? `${amount.trim()} ${u}` : "");
  return (
    <Field label={field.label} htmlFor={id} required={required} error={error} help={help}>
      {/* Inputs are always full width, so the wrappers set the split. */}
      <div className="flex gap-2">
        <div className="min-w-0 flex-1">
          <Input
            id={id}
            type="number"
            inputMode="decimal"
            min={0}
            step="any"
            value={amountPart}
            placeholder={field.placeholder}
            onChange={(e) => emit(e.target.value, unit)}
            invalid={!!error}
          />
        </div>
        {units.length > 1 ? (
          <div className="w-20 shrink-0">
            <Select
              aria-label={`${field.label} unit`}
              value={unit}
              onChange={(e) => {
                setUnit(e.target.value);
                emit(amountPart, e.target.value);
              }}
            >
              {units.map((u) => <option key={u} value={u}>{u}</option>)}
            </Select>
          </div>
        ) : (
          <span className="flex h-11 shrink-0 items-center px-1 text-sm text-muted">{unit}</span>
        )}
      </div>
    </Field>
  );
}
