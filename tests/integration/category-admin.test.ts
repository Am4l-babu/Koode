/**
 * Admins edit a category's product types without a code change: organisations
 * can then ask for the new product with its own details, and donors are asked
 * what the admin marked for them.
 */
import { beforeAll, describe, expect, it } from "vitest";
import { call } from "../helpers/http";
import { activeRequest, db, makeFixtures, type Fixtures } from "../helpers/fixtures";
import * as productTypes from "@/app/api/admin/categories/[slug]/product-types/route";
import * as categories from "@/app/api/admin/categories/route";
import * as requestsRoute from "@/app/api/requests/route";
import * as requestRoute from "@/app/api/requests/[id]/route";
import { resolveCategorySchema, type ProductType } from "@/lib/categories";
import { DEFAULT_PRODUCT_TYPES } from "@/lib/product-types";

let f: Fixtures;
const SLUG = "medical-support";
const builtIn = DEFAULT_PRODUCT_TYPES[SLUG]!;
const hearingAid: ProductType = {
  name: "Hearing aid",
  unit: "pieces",
  hide: ["specification"],
  fields: [
    { key: "fit", label: "Fit", type: "select", options: ["Behind the ear", "In the ear"], required: true, ask: "both" },
    { key: "ear", label: "Ear", type: "select", options: ["Left", "Right", "Both"], required: true },
    { key: "batterySize", label: "Battery size", type: "text", ask: "donor" },
  ],
};

const get = (token = f.superAdmin.token, slug = SLUG) => call(productTypes.GET, { token, params: { slug } });
const put = (body: unknown, token = f.superAdmin.token, slug = SLUG) => call(productTypes.PUT, { token, method: "PUT", params: { slug }, body });
const stored = async () => (await db.category.findUniqueOrThrow({ where: { slug: SLUG } })).fieldSchema as { fields: unknown[]; productTypes?: ProductType[] };

beforeAll(async () => {
  f = await makeFixtures();
});

describe("who can edit product types", () => {
  it("needs the system settings permission", async () => {
    expect((await call(productTypes.GET, { params: { slug: SLUG } })).status).toBe(401);
    expect((await put({ productTypes: [] }, f.donorA.token)).status).toBe(403);
    expect((await put({ productTypes: [] }, f.recipientB.token)).status).toBe(403);
    expect((await put({ productTypes: [] }, f.identityAdmin.token)).status).toBe(403);
    expect((await get(f.moderator.token)).status).toBe(403);
    expect((await stored()).productTypes).toBeUndefined();
  });

  it("404s for an unknown category", async () => {
    expect((await get(undefined, "no-such-thing")).status).toBe(404);
    expect((await put({ productTypes: [] }, undefined, "no-such-thing")).status).toBe(404);
  });
});

describe("editing product types", () => {
  it("starts from the built-in list and shows how many open requests use each type", async () => {
    const category = await db.category.findUniqueOrThrow({ where: { slug: SLUG } });
    await activeRequest(f.recipientB.org.id, [{ name: "Crutches", quantity: 2, attributes: { productType: "Crutches" } }, { name: "Pads", quantity: 9, attributes: { productType: "Sanitary pads" } }], category.id);
    await activeRequest(f.recipientB.org.id, [{ name: "More crutches", quantity: 1, attributes: { productType: "Crutches" } }], category.id);
    const r = await get();
    expect(r.status).toBe(200);
    expect(r.json.data).toMatchObject({ slug: SLUG, customised: false, hasBuiltIn: true, usage: { Crutches: 2, "Sanitary pads": 1 } });
    expect(r.json.data.productTypes.map((t: ProductType) => t.name)).toEqual(builtIn.map((t) => t.name));
  });

  it("saves an added product type, tidying settings that don't apply", async () => {
    const extra = { ...hearingAid, fields: [...hearingAid.fields, { key: "notes", label: "Notes", type: "text", options: ["ignored"], units: ["cm"], placeholder: "  " }] };
    const r = await put({ productTypes: [...builtIn, extra] });
    expect(r.status).toBe(200);
    expect(r.json.data.customised).toBe(true);
    const saved = (await stored()).productTypes!;
    expect(saved).toHaveLength(builtIn.length + 1);
    expect(saved.at(-1)!.fields.at(-1)).toEqual({ key: "notes", label: "Notes", type: "text" });
    expect(saved.find((t) => t.name === "Crutches")).toEqual(builtIn.find((t) => t.name === "Crutches"));
    const log = await db.auditLog.findFirst({ where: { action: "CATEGORY_CHANGED", targetId: SLUG }, orderBy: { createdAt: "desc" } });
    expect(log?.metadata).toEqual({ productTypes: builtIn.length + 1 });
  });

  it("lets organisations ask for the new product with its own details", async () => {
    const category = await db.category.findUniqueOrThrow({ where: { slug: SLUG } });
    const body = (attributes: Record<string, string>) => ({
      title: "Hearing aids for two residents",
      description: "Two of our elderly residents have lost most of their hearing and cannot afford hearing aids.",
      district: "Ernakulam",
      categoryId: category.id,
      items: [{ name: "Hearing aid", quantity: 2, attributes }],
    });
    const missing = await call(requestsRoute.POST, { token: f.recipientB.token, body: body({ productType: "Hearing aid", fit: "In the ear" }) });
    expect(missing.status).toBe(422);
    expect(missing.json.error.details.fields).toEqual({ "items.0.attributes.ear": "Ear is required." });

    const r = await call(requestsRoute.POST, { token: f.recipientB.token, body: body({ productType: "Hearing aid", fit: "In the ear", ear: "Both", specification: "dropped", batterySize: "dropped" }) });
    expect(r.status).toBe(201);
    const item = await db.requestItem.findFirstOrThrow({ where: { request: { publicId: r.json.data.id } } });
    expect(item.attributes).toEqual({ productType: "Hearing aid", fit: "In the ear", ear: "Both" });

    await db.request.update({ where: { publicId: r.json.data.id }, data: { status: "ACTIVE", approvedAt: new Date() } });
    const pub = await call(requestRoute.GET, { params: { id: r.json.data.id } });
    expect(pub.json.data.items[0].donorFields.map((d: { key: string }) => d.key)).toEqual(["fit", "batterySize"]);
  });

  it("rejects unusable product types with a message per field", async () => {
    const r = await put({
      productTypes: [
        hearingAid,
        { name: "hearing aid", hide: ["colour"], fields: [{ key: "size", label: "Size", type: "select" }, { key: "size", label: "", type: "measure" }] },
      ],
    });
    expect(r.status).toBe(422);
    expect(r.json.error.details.fields).toMatchObject({ "productTypes.1.fields.1.label": "Give this detail a label." });

    const r2 = await put({
      productTypes: [hearingAid, { name: "hearing aid", hide: ["colour"], fields: [{ key: "size", label: "Size", type: "select" }, { key: "size", label: "Size 2", type: "measure" }] }],
    });
    expect(r2.status).toBe(422);
    expect(Object.keys(r2.json.error.details.fields).sort()).toEqual([
      "productTypes.1.fields.0.options",
      "productTypes.1.fields.1.key",
      "productTypes.1.fields.1.units",
      "productTypes.1.hide.0",
      "productTypes.1.name",
    ]);
    expect((await stored()).productTypes).toHaveLength(builtIn.length + 1);
  });

  it("keeps product types when the quick category form saves the same category", async () => {
    const r = await call(categories.POST, {
      token: f.superAdmin.token,
      body: { slug: SLUG, name: "Medical Support", icon: "🩺", fieldSchema: { fields: [{ key: "specification", label: "Specification", type: "text" }] } },
    });
    expect(r.status).toBe(201);
    expect((await stored()).productTypes?.at(-1)?.name).toBe("Hearing aid");
  });

  it("can remove every product type, or go back to the built-in list", async () => {
    expect((await put({ productTypes: [] })).status).toBe(200);
    expect(resolveCategorySchema(SLUG, await stored()).productTypes).toEqual([]);

    const r = await put({ productTypes: null });
    expect(r.status).toBe(200);
    expect(r.json.data.customised).toBe(false);
    expect((await stored()).productTypes).toBeUndefined();
    expect(r.json.data.productTypes.map((t: ProductType) => t.name)).toEqual(builtIn.map((t) => t.name));
  });
});
