import { describe, expect, it } from "vitest";
import { createRequestSchema } from "@/lib/validation/request";
import { createDonationSchema } from "@/lib/validation/donation";
import { registerSchema } from "@/lib/validation/auth";
import { detectPii } from "@/lib/pii-guard";
import { parseAgeRange, validateAttributes, DEFAULT_CATEGORIES } from "@/lib/categories";

const UUID = "4f9c1c62-6a8f-4c5e-9a43-2b1d1a6f8e11";
const validRequest = {
  categoryId: UUID,
  title: "School bags for the new year",
  description: "These bags are for children beginning the new academic year without suitable bags.",
  district: "Thrissur",
  items: [{ name: "School bag", quantity: 30, attributes: {} }],
};

describe("request validation", () => {
  it("accepts a well-formed request", () => expect(createRequestSchema.safeParse(validRequest).success).toBe(true));
  it("requires at least one item and positive whole quantities", () => {
    expect(createRequestSchema.safeParse({ ...validRequest, items: [] }).success).toBe(false);
    expect(createRequestSchema.safeParse({ ...validRequest, items: [{ name: "Bag", quantity: 0 }] }).success).toBe(false);
    expect(createRequestSchema.safeParse({ ...validRequest, items: [{ name: "Bag", quantity: 2.5 }] }).success).toBe(false);
  });
  it("rejects duplicate item names", () => {
    const r = createRequestSchema.safeParse({ ...validRequest, items: [{ name: "Bag", quantity: 1 }, { name: "bag", quantity: 2 }] });
    expect(r.success).toBe(false);
  });
  it("rejects contact details in public text (privacy)", () => {
    const r = createRequestSchema.safeParse({ ...validRequest, description: `${validRequest.description} Call 98470 12345 or mail us at x@y.org` });
    expect(r.success).toBe(false);
    expect(JSON.stringify(r.error?.issues)).toMatch(/phone number/);
  });
  it("rejects unknown districts", () => expect(createRequestSchema.safeParse({ ...validRequest, district: "Atlantis" }).success).toBe(false));
});

describe("donation validation", () => {
  const valid = { requestId: "NR-7KQ9XM", items: [{ requestItemId: UUID, quantity: 2 }], deliveryMethod: "PARTNER_DROPOFF", anonymousAcknowledged: true };
  it("accepts a valid donation", () => expect(createDonationSchema.safeParse(valid).success).toBe(true));
  it("requires the anonymity acknowledgement", () => expect(createDonationSchema.safeParse({ ...valid, anonymousAcknowledged: false }).success).toBe(false));
  it("requires a pickup address for platform pickup", () => expect(createDonationSchema.safeParse({ ...valid, deliveryMethod: "PLATFORM_PICKUP" }).success).toBe(false));
  it("rejects duplicate lines, zero and negative quantities", () => {
    expect(createDonationSchema.safeParse({ ...valid, items: [valid.items[0], valid.items[0]] }).success).toBe(false);
    expect(createDonationSchema.safeParse({ ...valid, items: [{ requestItemId: UUID, quantity: 0 }] }).success).toBe(false);
    expect(createDonationSchema.safeParse({ ...valid, items: [{ requestItemId: UUID, quantity: -3 }] }).success).toBe(false);
  });
  it("rejects malformed request references", () => expect(createDonationSchema.safeParse({ ...valid, requestId: "NR-1' OR 1=1" }).success).toBe(false));
});

describe("registration validation — users cannot pick privileged roles", () => {
  const base = { fullName: "Asha", email: "a@example.org", password: "longpassword1", acceptTerms: true };
  it("accepts DONOR", () => expect(registerSchema.safeParse({ ...base, role: "DONOR" }).success).toBe(true));
  it.each(["ADMIN", "SUPER_ADMIN", "admin"])("rejects role %s", (role) => expect(registerSchema.safeParse({ ...base, role }).success).toBe(false));
  it("enforces password strength", () => expect(registerSchema.safeParse({ ...base, role: "DONOR", password: "short" }).success).toBe(false));
  it("rejects filled honeypot", () => expect(registerSchema.safeParse({ ...base, role: "DONOR", website: "spam.example" }).success).toBe(false));
});

describe("PII detector", () => {
  it.each([
    ["Call +91 98470 12345", "phone"],
    ["mail info@school.org", "email"],
    ["see www.example.com", "link"],
    ["DM @school_kochi on instagram", "social"],
    ["near PIN 680307", "pin_code"],
    ["House no 12", "address"],
  ])("detects %s", (text, kind) => expect(detectPii(text)).toContain(kind));
  it("allows ordinary descriptions with sizes and quantities", () => expect(detectPii("40 bags, sizes 28-32, ages 8-10, 200 pages")).toEqual([]));
});

describe("schema-driven category attributes", () => {
  const clothing = DEFAULT_CATEGORIES.find((c) => c.slug === "clothing")!.fieldSchema;
  it("validates against the category schema and drops unknown keys", () => {
    const r = validateAttributes(clothing, { size: "28", ageGroup: "8–10", gender: "Any", hacker: "x" });
    expect(r.ok && r.attributes).toEqual({ size: "28", ageGroup: "8–10", gender: "Any" });
    expect(r.ok && [r.ageMin, r.ageMax]).toEqual([8, 10]);
  });
  it("enforces required fields and select options", () => {
    const r = validateAttributes(clothing, { gender: "Robot" });
    expect(r.ok).toBe(false);
    expect(!r.ok && Object.keys(r.errors).sort()).toEqual(["gender", "size"]);
  });
  it("blocks contact details in attribute text", () => expect(validateAttributes(clothing, { size: "call 9847012345" }).ok).toBe(false));
  it("parses age ranges", () => {
    expect(parseAgeRange("5–8")).toEqual({ min: 5, max: 8 });
    expect(parseAgeRange("10 to 12 years")).toEqual({ min: 10, max: 12 });
    expect(parseAgeRange("Adult")).toEqual({ min: 18, max: 59 });
    expect(parseAgeRange("abc")).toBeNull();
  });
});
