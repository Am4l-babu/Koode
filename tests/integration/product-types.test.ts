/**
 * Product types end to end: recipients describe items by product type, donors
 * describe what they give per item, and both are validated on the server.
 */
import { beforeAll, describe, expect, it } from "vitest";
import { call } from "../helpers/http";
import { activeRequest, db, makeFixtures, type Fixtures } from "../helpers/fixtures";
import * as requestsRoute from "@/app/api/requests/route";
import * as requestRoute from "@/app/api/requests/[id]/route";
import * as donationsRoute from "@/app/api/donations/route";

let f: Fixtures;
const categoryId = async (slug: string) => (await db.category.findUniqueOrThrow({ where: { slug } })).id;

beforeAll(async () => {
  f = await makeFixtures();
});

describe("recipient requests with product types", () => {
  const base = {
    title: "Footwear and furniture for the hostel",
    description: "Children at the hostel need school shoes and a study table for the common room.",
    district: "Ernakulam",
  };

  it("stores the product type with its own measurements", async () => {
    const r = await call(requestsRoute.POST, {
      token: f.recipientB.token,
      body: {
        ...base,
        categoryId: await categoryId("clothing"),
        items: [{ name: "School shoes", quantity: 12, unit: "pairs", attributes: { productType: "Footwear", size: "UK 4, UK 5", footwearType: "School shoes", ageGroup: "8–10" } }],
      },
    });
    expect(r.status).toBe(201);
    const item = await db.requestItem.findFirstOrThrow({ where: { request: { publicId: r.json.data.id } } });
    expect(item.attributes).toEqual({ productType: "Footwear", size: "UK 4, UK 5", footwearType: "School shoes", ageGroup: "8–10" });
  });

  it("reports missing product details per item", async () => {
    const r = await call(requestsRoute.POST, {
      token: f.recipientB.token,
      body: { ...base, categoryId: await categoryId("household"), items: [{ name: "Study table", quantity: 1, attributes: { productType: "Table / desk", height: "75 ft" } }] },
    });
    expect(r.status).toBe(422);
    expect(r.json.error.details.fields).toMatchObject({
      "items.0.attributes.length": "Length is required.",
      "items.0.attributes.height": "Height should be a number with a unit (cm, in).",
    });
  });

  it("rejects a product type from another category", async () => {
    const r = await call(requestsRoute.POST, {
      token: f.recipientB.token,
      body: { ...base, categoryId: await categoryId("food"), items: [{ name: "Shoes", quantity: 1, attributes: { productType: "Footwear" } }] },
    });
    expect(r.status).toBe(422);
    expect(r.json.error.details.fields["items.0.attributes.productType"]).toBeDefined();
  });
});

describe("donors describing what they give", () => {
  let requestId: string;
  let riceId: string;
  let shirtId: string;

  beforeAll(async () => {
    const food = await activeRequest(
      f.recipientB.org.id,
      [
        { name: "Rice", quantity: 50, attributes: { productType: "Rice", variety: "Matta (red)", packSize: "5 kg" } },
        { name: "Shirt", quantity: 10, attributes: { size: "28, 30, 32" } },
      ],
      await categoryId("food"),
    );
    requestId = food.publicId;
    riceId = food.items[0]!.id;
    shirtId = food.items[1]!.id;
  });

  const donate = (items: unknown[]) =>
    call(donationsRoute.POST, { token: f.donorA.token, body: { requestId, items, deliveryMethod: "PARTNER_DROPOFF", anonymousAcknowledged: true } });

  it("tells donors which details to give for each item", async () => {
    const pub = await call(requestRoute.GET, { params: { id: requestId } });
    const [rice, shirt] = pub.json.data.items as { donorFields: { key: string }[] }[];
    expect(rice!.donorFields.map((d) => d.key)).toEqual(["variety", "packSize", "bestBefore"]);
    expect(shirt!.donorFields.map((d) => d.key)).toEqual(["size"]);
    expect(pub.json.data.category).not.toHaveProperty("fieldSchema");
  });

  it("stores per-item condition and details; the donation takes the least-new condition", async () => {
    const bestBefore = `${new Date().getFullYear() + 1}-03-31`;
    const r = await donate([
      { requestItemId: riceId, quantity: 10, condition: "NEW", variant: { packSize: "5kg", bestBefore, variety: "Ponni", notAsked: "x" } },
      { requestItemId: shirtId, quantity: 2, condition: "LIKE_NEW", variant: { size: "30" } },
    ]);
    expect(r.status).toBe(201);
    expect(r.json.data.condition).toBe("LIKE_NEW");
    const items = await db.donationItem.findMany({ where: { donation: { publicId: r.json.data.id } }, orderBy: { quantity: "desc" } });
    expect(items[0]!.variant).toEqual({ condition: "New", variety: "Ponni", packSize: "5 kg", bestBefore });
    expect(items[1]!.variant).toEqual({ condition: "Like new", size: "30" });
  });

  it("rejects invalid details with per-item errors", async () => {
    const r = await donate([{ requestItemId: riceId, quantity: 1, variant: { packSize: "5 litres", bestBefore: "2020-01-01" } }]);
    expect(r.status).toBe(422);
    expect(Object.keys(r.json.error.details.fields).sort()).toEqual(["items.0.variant.bestBefore", "items.0.variant.packSize"]);
  });

  it("blocks contact details in what donors write", async () => {
    const r = await donate([{ requestItemId: shirtId, quantity: 1, variant: { size: "call 9847012345" } }]);
    expect(r.status).toBe(422);
    expect(r.json.error.details.fields["items.0.variant.size"]).toMatch(/contact details/);
  });

  it("still accepts donations without any details", async () => {
    const r = await donate([{ requestItemId: riceId, quantity: 1 }]);
    expect(r.status).toBe(201);
    expect(r.json.data.condition).toBe("NEW");
  });
});
