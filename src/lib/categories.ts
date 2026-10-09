import { z } from "zod";
import { detectPii } from "./pii-guard";
import { DEFAULT_PRODUCT_TYPES } from "./product-types";

/**
 * Schema-driven request builder. Each category stores a `fieldSchema` in the
 * database; the UI renders fields from it and the server validates against it.
 * Admins can create new categories with their own schemas — nothing here is
 * hard-coded per category at the component level.
 *
 * A category can also offer product types (e.g. Clothing → Footwear, Saree).
 * Choosing one swaps in that product's own measurements and details. Built-in
 * categories get their product types from `product-types.ts` unless the stored
 * schema defines its own.
 */
export const FIELD_TYPES = ["text", "number", "select", "boolean", "ageRange", "measure", "date"] as const;

export const fieldDefSchema = z.object({
  key: z.string().regex(/^[a-zA-Z][a-zA-Z0-9]{0,30}$/),
  label: z.string().min(1).max(60),
  type: z.enum(FIELD_TYPES),
  options: z.array(z.string().min(1).max(40)).max(20).optional(),
  /** For `measure`: the units a value may be given in, e.g. ["cm", "in"]. */
  units: z.array(z.string().regex(/^[A-Za-z]{1,8}$/)).min(1).max(6).optional(),
  required: z.boolean().optional(),
  placeholder: z.string().max(80).optional(),
  help: z.string().max(140).optional(),
  /** Who fills it in: the recipient describing the need (default), the donor describing what they give, or both. */
  ask: z.enum(["recipient", "donor", "both"]).optional(),
});

export const productTypeSchema = z.object({
  name: z.string().min(1).max(40),
  /** Default quantity unit, e.g. "kg" or "pairs". */
  unit: z.string().min(1).max(16).optional(),
  /** Category-wide fields that don't apply to this product. */
  hide: z.array(z.string().max(31)).max(12).optional(),
  fields: z.array(fieldDefSchema).max(12),
});

export const categorySchemaSchema = z.object({
  fields: z.array(fieldDefSchema).max(12),
  productTypes: z.array(productTypeSchema).max(30).optional(),
});

export type FieldDef = z.infer<typeof fieldDefSchema>;
export type ProductType = z.infer<typeof productTypeSchema>;
export type CategorySchema = z.infer<typeof categorySchemaSchema>;
export type Audience = "recipient" | "donor";

/** Attribute key under which a request item records its chosen product type. */
export const PRODUCT_TYPE_KEY = "productType";

export const AGE_GROUPS = ["0–2", "3–5", "5–8", "8–10", "10–12", "13–17", "Adult", "Senior", "Any"];
const CONDITION = ["New", "New or excellent", "Good"];

export interface DefaultCategory {
  slug: string;
  name: string;
  icon: string;
  description: string;
  sortOrder: number;
  fieldSchema: CategorySchema;
}

export const DEFAULT_CATEGORIES: DefaultCategory[] = [
  {
    slug: "education",
    name: "Education",
    icon: "🎒",
    description: "Notebooks, school bags, learning kits, books and stationery.",
    sortOrder: 1,
    fieldSchema: {
      fields: [
        { key: "ageGroup", label: "Age group", type: "ageRange", options: AGE_GROUPS },
        { key: "specification", label: "Specification", type: "text", placeholder: "e.g. 200 pages, ruled" },
        { key: "condition", label: "Preferred condition", type: "select", options: CONDITION },
      ],
    },
  },
  {
    slug: "clothing",
    name: "Clothing",
    icon: "👕",
    description: "Shirts, uniforms, shoes, jackets and blankets.",
    sortOrder: 2,
    fieldSchema: {
      fields: [
        { key: "size", label: "Size", type: "text", required: true, placeholder: "e.g. 28–32 or M" },
        { key: "ageGroup", label: "Age group", type: "ageRange", options: AGE_GROUPS },
        { key: "gender", label: "Gender / fit", type: "select", options: ["Any", "Boys", "Girls", "Men", "Women"] },
        { key: "condition", label: "Preferred condition", type: "select", options: CONDITION },
        { key: "colour", label: "Colour", type: "text", placeholder: "Any" },
      ],
    },
  },
  {
    slug: "food",
    name: "Food",
    icon: "🍚",
    description: "Rice, groceries, fruit, vegetables, baby food and meals.",
    sortOrder: 3,
    fieldSchema: {
      fields: [
        { key: "weight", label: "Weight per unit", type: "text", placeholder: "e.g. 5 kg" },
        { key: "packaging", label: "Preferred packaging", type: "text", placeholder: "e.g. 5 kg bags" },
        {
          key: "expiry",
          label: "Expiry requirement",
          type: "select",
          options: ["Fresh – same day", "At least 1 month", "At least 3 months", "At least 6 months"],
        },
        { key: "dietary", label: "Dietary", type: "select", options: ["Any", "Vegetarian", "Non-vegetarian"] },
      ],
    },
  },
  {
    slug: "children",
    name: "Children",
    icon: "🧸",
    description: "Toys, puzzles, building blocks, books and sports equipment.",
    sortOrder: 4,
    fieldSchema: {
      fields: [
        { key: "ageRange", label: "Age range", type: "ageRange", required: true, options: AGE_GROUPS },
        { key: "purpose", label: "Type", type: "select", options: ["Educational", "Recreational", "Either"] },
        { key: "condition", label: "Preferred condition", type: "select", options: CONDITION },
        { key: "safetyNotes", label: "Safety notes", type: "text", placeholder: "e.g. no small parts" },
      ],
    },
  },
  {
    slug: "elder-care",
    name: "Elder Care",
    icon: "👵",
    description: "Clothing, blankets, toiletries, walking aids and recreation.",
    sortOrder: 5,
    fieldSchema: {
      fields: [
        { key: "size", label: "Size", type: "text", placeholder: "If relevant" },
        { key: "condition", label: "Preferred condition", type: "select", options: CONDITION },
        { key: "notes", label: "Notes", type: "text", placeholder: "e.g. adjustable height" },
      ],
    },
  },
  {
    slug: "medical-support",
    name: "Medical Support",
    icon: "🩺",
    description: "First-aid supplies, hygiene kits and mobility aids.",
    sortOrder: 6,
    fieldSchema: {
      fields: [
        { key: "specification", label: "Specification", type: "text" },
        { key: "condition", label: "Condition", type: "select", options: ["New"] },
      ],
    },
  },
  {
    slug: "household",
    name: "Household",
    icon: "🏠",
    description: "Kitchen items, bedding, cleaning supplies and furniture.",
    sortOrder: 7,
    fieldSchema: {
      fields: [
        { key: "specification", label: "Specification", type: "text" },
        { key: "condition", label: "Preferred condition", type: "select", options: CONDITION },
      ],
    },
  },
  {
    slug: "sports",
    name: "Sports",
    icon: "⚽",
    description: "Balls, bats, nets, shoes and team kits.",
    sortOrder: 8,
    fieldSchema: {
      fields: [
        { key: "ageGroup", label: "Age group", type: "ageRange", options: AGE_GROUPS },
        { key: "size", label: "Size", type: "text" },
        { key: "condition", label: "Preferred condition", type: "select", options: CONDITION },
      ],
    },
  },
  {
    slug: "other",
    name: "Other",
    icon: "📦",
    description: "Anything else a verified community partner needs.",
    sortOrder: 99,
    fieldSchema: {
      fields: [
        { key: "specification", label: "Specification", type: "text" },
        { key: "condition", label: "Preferred condition", type: "select", options: CONDITION },
      ],
    },
  },
];

export function parseCategorySchema(value: unknown): CategorySchema {
  const parsed = categorySchemaSchema.safeParse(value);
  return parsed.success ? parsed.data : { fields: [] };
}

/** The stored schema plus the built-in product types for this category, unless it defines its own. */
export function resolveCategorySchema(slug: string, value: unknown): CategorySchema {
  const schema = parseCategorySchema(value);
  return { ...schema, productTypes: schema.productTypes ?? DEFAULT_PRODUCT_TYPES[slug] ?? [] };
}

export function findProductType(schema: CategorySchema, name: unknown): ProductType | undefined {
  return typeof name === "string" ? schema.productTypes?.find((t) => t.name === name) : undefined;
}

/**
 * The fields to show for one item: the product type's own fields first, then
 * the category-wide ones it doesn't replace or hide, filtered to who is asked.
 */
export function fieldsFor(schema: CategorySchema, productType: unknown, audience: Audience = "recipient"): FieldDef[] {
  const type = findProductType(schema, productType);
  const replaced = new Set([...(type?.hide ?? []), ...(type?.fields.map((f) => f.key) ?? [])]);
  const all = [...(type?.fields ?? []), ...schema.fields.filter((f) => !replaced.has(f.key))];
  return all.filter((f) => {
    const ask = f.ask ?? "recipient";
    return ask === "both" || ask === audience;
  });
}

/**
 * What a donor is asked about one requested item. Every answer is optional for
 * donors — `required` describes what the recipient must specify. Requests made
 * before product types existed still get a size question when sizes were listed.
 */
export function donorFieldsFor(schema: CategorySchema, attributes: Record<string, unknown>): FieldDef[] {
  const fields: FieldDef[] = fieldsFor(schema, attributes[PRODUCT_TYPE_KEY], "donor").map((f) => ({ ...f, required: false }));
  if (typeof attributes.size === "string" && attributes.size.trim() && !fields.some((f) => f.key === "size")) {
    fields.unshift({ key: "size", label: "Size", type: "text", ask: "donor" });
  }
  return fields;
}

/**
 * Whether only new items can be given (e.g. diapers, innerwear, medical
 * supplies): the item's condition field allows nothing but "New".
 */
export function requiresNew(schema: CategorySchema, attributes: Record<string, unknown>): boolean {
  const condition = fieldsFor(schema, attributes[PRODUCT_TYPE_KEY], "recipient").find((f) => f.key === "condition");
  return condition?.type === "select" && condition.options?.length === 1 && condition.options[0] === "New";
}

/** Split a recipient's "28, 30 or 32" style list into choices; a single value gives none. */
export function listedChoices(value: unknown): string[] {
  if (typeof value !== "string") return [];
  const parts = value.split(/[,/]|\s+or\s+/).map((s) => s.trim()).filter(Boolean);
  return parts.length > 1 ? parts : [];
}

/** "chestSize" → "Chest size" — for showing stored attributes where the schema isn't at hand. */
export function humanizeKey(key: string): string {
  const words = key.replace(/([A-Z])/g, " $1").trim().toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export function formatAttributeValue(value: unknown): string {
  if (value === true || value === "true") return "Yes";
  if (value === false || value === "false") return "No";
  return String(value);
}

const LEADING_KEYS = [PRODUCT_TYPE_KEY, "condition"];

/**
 * Readable label/value pairs for stored attributes, skipping empty values.
 * Product type and condition come first; Postgres doesn't keep JSON key order.
 */
export function describeAttributes(attributes: Record<string, unknown> | null | undefined, skip: string[] = []): { key: string; label: string; value: string }[] {
  const rank = (k: string) => (LEADING_KEYS.includes(k) ? LEADING_KEYS.indexOf(k) : LEADING_KEYS.length);
  return Object.entries(attributes ?? {})
    .filter(([k, v]) => !skip.includes(k) && v !== "" && v !== null && v !== undefined)
    .sort(([a], [b]) => rank(a) - rank(b))
    .map(([k, v]) => ({ key: k, label: humanizeKey(k), value: formatAttributeValue(v) }));
}

/** Parse "5–8", "8-10 years", "Adult" into numeric bounds. */
export function parseAgeRange(value: string | undefined | null): { min: number; max: number } | null {
  if (!value) return null;
  const v = value.trim().toLowerCase();
  if (v === "adult") return { min: 18, max: 59 };
  if (v === "senior") return { min: 60, max: 120 };
  if (v === "any") return { min: 0, max: 120 };
  const m = v.match(/^(\d{1,2})\s*(?:[-–—]|to)\s*(\d{1,2})/);
  if (m) {
    const a = Number(m[1]);
    const b = Number(m[2]);
    return a <= b ? { min: a, max: b } : { min: b, max: a };
  }
  const single = v.match(/^(\d{1,2})\b/);
  if (single) return { min: Number(single[1]), max: Number(single[1]) };
  return null;
}

export type AttributeResult =
  | { ok: true; attributes: Record<string, string | number | boolean>; ageMin: number | null; ageMax: number | null }
  | { ok: false; errors: Record<string, string> };

/** Validate free-form item attributes against a list of fields. Unknown keys are dropped. */
export function validateAttributes(schema: { fields: FieldDef[] }, input: Record<string, unknown>): AttributeResult {
  const errors: Record<string, string> = {};
  const attributes: Record<string, string | number | boolean> = {};
  let ageMin: number | null = null;
  let ageMax: number | null = null;

  for (const field of schema.fields) {
    const raw = input?.[field.key];
    const empty = raw === undefined || raw === null || (typeof raw === "string" && raw.trim() === "");
    if (empty) {
      if (field.required) errors[field.key] = `${field.label} is required.`;
      continue;
    }
    switch (field.type) {
      case "number": {
        const n = typeof raw === "number" ? raw : Number(raw);
        if (!Number.isFinite(n) || n < 0 || n > 1_000_000) errors[field.key] = `${field.label} must be a valid number.`;
        else attributes[field.key] = n;
        break;
      }
      case "boolean":
        attributes[field.key] = raw === true || raw === "true";
        break;
      case "select": {
        const s = String(raw).trim();
        if (field.options && !field.options.includes(s)) errors[field.key] = `Choose a valid ${field.label.toLowerCase()}.`;
        else attributes[field.key] = s;
        break;
      }
      case "ageRange": {
        const s = String(raw).trim().slice(0, 40);
        const range = parseAgeRange(s);
        if (!range) {
          errors[field.key] = `${field.label} should look like "5–8", "Adult" or "Any".`;
        } else {
          attributes[field.key] = s;
          ageMin = ageMin === null ? range.min : Math.min(ageMin, range.min);
          ageMax = ageMax === null ? range.max : Math.max(ageMax, range.max);
        }
        break;
      }
      case "measure": {
        const units = field.units ?? [];
        const m = String(raw).trim().match(/^(\d+(?:\.\d+)?)\s*([A-Za-z]+)$/);
        const n = m ? Number(m[1]) : NaN;
        if (!m || !(n > 0) || n > 100_000 || !units.includes(m[2]!)) {
          errors[field.key] = `${field.label} should be a number with a unit (${units.join(", ")}).`;
        } else attributes[field.key] = `${Number(n.toFixed(2))} ${m[2]}`;
        break;
      }
      case "date": {
        const s = String(raw).trim();
        const d = /^\d{4}-\d{2}-\d{2}$/.test(s) ? new Date(`${s}T00:00:00Z`) : null;
        if (!d || Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== s) errors[field.key] = `Choose a valid ${field.label.toLowerCase()}.`;
        else if (d.getTime() < Date.now() - 2 * 86_400_000) errors[field.key] = `${field.label} can't be in the past.`;
        else attributes[field.key] = s;
        break;
      }
      default: {
        const s = String(raw).trim();
        if (s.length > 80) errors[field.key] = `${field.label} must be 80 characters or fewer.`;
        else if (detectPii(s).length) errors[field.key] = `${field.label} must not contain contact details.`;
        else attributes[field.key] = s;
      }
    }
  }

  if (Object.keys(errors).length) return { ok: false, errors };
  return { ok: true, attributes, ageMin, ageMax };
}

/**
 * Validate a request item's attributes: the chosen product type (if any) and
 * the fields that come with it. The product type is kept under `productType`.
 */
export function validateItemAttributes(schema: CategorySchema, input: Record<string, unknown>): AttributeResult {
  const raw = input?.[PRODUCT_TYPE_KEY];
  const productType = typeof raw === "string" && raw.trim() ? raw.trim() : undefined;
  if (productType && !findProductType(schema, productType)) {
    return { ok: false, errors: { [PRODUCT_TYPE_KEY]: "Choose one of the listed product types." } };
  }
  const result = validateAttributes({ fields: fieldsFor(schema, productType, "recipient") }, input ?? {});
  if (result.ok && productType) result.attributes = { [PRODUCT_TYPE_KEY]: productType, ...result.attributes };
  return result;
}
