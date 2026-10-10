import { describe, expect, it } from "vitest";
import {
  DEFAULT_CATEGORIES,
  describeAttributes,
  donorFieldsFor,
  fieldsFor,
  listedChoices,
  productTypeProblems,
  productTypeSchema,
  resolveCategorySchema,
  toFieldKey,
  validateAttributes,
  validateItemAttributes,
} from "@/lib/categories";
import { DEFAULT_PRODUCT_TYPES } from "@/lib/product-types";

const schemaFor = (slug: string) => resolveCategorySchema(slug, DEFAULT_CATEGORIES.find((c) => c.slug === slug)!.fieldSchema);

describe("built-in product type catalogue", () => {
  for (const [slug, types] of Object.entries(DEFAULT_PRODUCT_TYPES)) {
    it(`${slug}: every product type is well-formed`, () => {
      expect(DEFAULT_CATEGORIES.some((c) => c.slug === slug)).toBe(true);
      expect(new Set(types.map((t) => t.name)).size).toBe(types.length);
      const common = new Set(DEFAULT_CATEGORIES.find((c) => c.slug === slug)!.fieldSchema.fields.map((f) => f.key));
      for (const t of types) {
        expect(productTypeSchema.safeParse(t).success, t.name).toBe(true);
        expect(new Set(t.fields.map((f) => f.key)).size, `${t.name} has duplicate keys`).toBe(t.fields.length);
        for (const key of t.hide ?? []) expect(common.has(key), `${t.name} hides unknown field ${key}`).toBe(true);
        for (const f of t.fields) {
          if (f.type === "select") expect(f.options?.length, `${t.name}.${f.key} needs options`).toBeGreaterThan(0);
          if (f.type === "measure") expect(f.units?.length, `${t.name}.${f.key} needs units`).toBeGreaterThan(0);
        }
      }
    });
  }
});

describe("fields per product type", () => {
  const clothing = schemaFor("clothing");

  it("a product type's own field replaces the category-wide one with the same key", () => {
    const size = fieldsFor(clothing, "Footwear").find((f) => f.key === "size")!;
    expect(size.label).toBe("Shoe size (UK)");
    expect(fieldsFor(clothing, "Footwear").filter((f) => f.key === "size")).toHaveLength(1);
  });

  it("hidden category-wide fields are left out", () => {
    const keys = fieldsFor(clothing, "Saree").map((f) => f.key);
    expect(keys).toContain("length");
    expect(keys).not.toContain("size");
    expect(keys).not.toContain("ageGroup");
  });

  it("without a product type only the category-wide fields apply", () => {
    expect(fieldsFor(clothing, undefined).map((f) => f.key)).toEqual(clothing.fields.map((f) => f.key));
  });

  it("donor-only fields are not asked of recipients, and vice versa", () => {
    const food = schemaFor("food");
    expect(fieldsFor(food, "Rice", "recipient").map((f) => f.key)).not.toContain("bestBefore");
    expect(fieldsFor(food, "Rice", "donor").map((f) => f.key)).toEqual(expect.arrayContaining(["packSize", "bestBefore", "variety"]));
    expect(fieldsFor(food, "Rice", "donor").map((f) => f.key)).not.toContain("dietary");
  });

  it("stored product types override the built-in ones", () => {
    const custom = resolveCategorySchema("clothing", { fields: [], productTypes: [{ name: "Cap", fields: [] }] });
    expect(custom.productTypes!.map((t) => t.name)).toEqual(["Cap"]);
    expect(resolveCategorySchema("custom-slug", { fields: [] }).productTypes).toEqual([]);
  });
});

describe("validating item details", () => {
  const clothing = schemaFor("clothing");

  it("keeps the product type and validates its fields", () => {
    const r = validateItemAttributes(clothing, { productType: "Footwear", size: "UK 4, UK 5", footwearType: "School shoes", chest: "40 cm" });
    expect(r.ok && r.attributes).toEqual({ productType: "Footwear", size: "UK 4, UK 5", footwearType: "School shoes" });
  });

  it("requires the product type's required fields", () => {
    const r = validateItemAttributes(clothing, { productType: "Footwear" });
    expect(!r.ok && Object.keys(r.errors).sort()).toEqual(["footwearType", "size"]);
  });

  it("rejects product types that aren't offered", () => {
    const r = validateItemAttributes(clothing, { productType: "Spaceship", size: "M" });
    expect(!r.ok && r.errors.productType).toMatch(/listed product types/);
  });

  it("normalises measurements and checks their units", () => {
    const household = schemaFor("household");
    const ok = validateItemAttributes(household, { productType: "Table / desk", length: "120.50cm", height: " 30 in " });
    expect(ok.ok && ok.attributes).toMatchObject({ length: "120.5 cm", height: "30 in" });
    const bad = validateItemAttributes(household, { productType: "Table / desk", length: "120 ft" });
    expect(!bad.ok && bad.errors.length).toBe("Length should be a number with a unit (cm, in).");
    expect(validateItemAttributes(household, { productType: "Table / desk", length: "-3 cm" }).ok).toBe(false);
  });

  it("checks dates and rejects past ones", () => {
    const fields = [{ key: "bestBefore", label: "Best before", type: "date" as const }];
    const nextYear = `${new Date().getFullYear() + 1}-01-31`;
    expect(validateAttributes({ fields }, { bestBefore: nextYear }).ok).toBe(true);
    expect(validateAttributes({ fields }, { bestBefore: "2020-01-01" }).ok).toBe(false);
    expect(validateAttributes({ fields }, { bestBefore: "2027-02-30" }).ok).toBe(false);
  });
});

describe("what donors are asked", () => {
  it("asks about the product type's donor fields", () => {
    const keys = donorFieldsFor(schemaFor("clothing"), { productType: "Trousers / shorts", size: "28, 30" }).map((f) => f.key);
    expect(keys).toEqual(expect.arrayContaining(["size", "waist", "length"]));
  });

  it("still asks for a size on older requests that listed sizes but have no product type", () => {
    const fields = donorFieldsFor(schemaFor("clothing"), { size: "28, 30, 32" });
    expect(fields.map((f) => f.key)).toEqual(["size"]);
    expect(donorFieldsFor(schemaFor("education"), {})).toEqual([]);
  });

  it("turns a recipient's size list into choices", () => {
    expect(listedChoices("28, 30 or 32")).toEqual(["28", "30", "32"]);
    expect(listedChoices("M")).toEqual([]);
    expect(listedChoices(4)).toEqual([]);
  });
});

describe("showing stored details", () => {
  it("labels keys and formats yes/no values", () => {
    expect(describeAttributes({ productType: "Walker", maxUserWeight: "100 kg", foldable: true, notes: "" })).toEqual([
      { key: "productType", label: "Product type", value: "Walker" },
      { key: "maxUserWeight", label: "Max user weight", value: "100 kg" },
      { key: "foldable", label: "Foldable", value: "Yes" },
    ]);
  });
});

describe("admin-edited product types", () => {
  it("every built-in list can be saved unchanged", () => {
    for (const c of DEFAULT_CATEGORIES) {
      expect(productTypeProblems(c.fieldSchema.fields, DEFAULT_PRODUCT_TYPES[c.slug] ?? []), c.slug).toEqual({});
    }
  });

  it("flags duplicate names, missing choices and units, reserved or repeated keys and unknown hidden fields", () => {
    const fields = DEFAULT_CATEGORIES.find((c) => c.slug === "medical-support")!.fieldSchema.fields;
    expect(
      productTypeProblems(fields, [
        { name: "Hearing aid", hide: ["specification", "colour"], fields: [{ key: "fit", label: "Fit", type: "select" }, { key: "productType", label: "Type", type: "text" }] },
        { name: " hearing AID ", fields: [{ key: "range", label: "Range", type: "measure" }, { key: "range", label: "Range again", type: "text" }] },
      ]),
    ).toEqual({
      "productTypes.0.hide.1": `"colour" isn't one of this category's fields.`,
      "productTypes.0.fields.0.options": "List at least one choice.",
      "productTypes.0.fields.1.key": `"productType" is reserved.`,
      "productTypes.1.name": `"hearing AID" is listed twice.`,
      "productTypes.1.fields.0.units": "Pick at least one unit.",
      "productTypes.1.fields.1.key": `Two details share the key "range". Rename one.`,
    });
  });

  it("turns labels into stable keys", () => {
    expect(toFieldKey("Battery size (mAh)")).toBe("batterySizeMah");
    expect(toFieldKey("  Ear  side ")).toBe("earSide");
    expect(toFieldKey("Café hours")).toBe("cafeHours");
    expect(toFieldKey("2 pin plug")).toBe("");
    expect(toFieldKey("x".repeat(50))).toHaveLength(31);
  });
});
