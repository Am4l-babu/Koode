import { z } from "zod";
import { detectPii } from "./pii-guard";

/**
 * Schema-driven request builder. Each category stores a `fieldSchema` in the
 * database; the UI renders fields from it and the server validates against it.
 * Admins can create new categories with their own schemas — nothing here is
 * hard-coded per category at the component level.
 */
export const fieldDefSchema = z.object({
  key: z.string().regex(/^[a-zA-Z][a-zA-Z0-9]{0,30}$/),
  label: z.string().min(1).max(60),
  type: z.enum(["text", "number", "select", "boolean", "ageRange"]),
  options: z.array(z.string().min(1).max(40)).max(20).optional(),
  required: z.boolean().optional(),
  placeholder: z.string().max(80).optional(),
  help: z.string().max(140).optional(),
});

export const categorySchemaSchema = z.object({ fields: z.array(fieldDefSchema).max(12) });

export type FieldDef = z.infer<typeof fieldDefSchema>;
export type CategorySchema = z.infer<typeof categorySchemaSchema>;

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

/** Validate free-form item attributes against a category schema. Unknown keys are dropped. */
export function validateAttributes(schema: CategorySchema, input: Record<string, unknown>): AttributeResult {
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
