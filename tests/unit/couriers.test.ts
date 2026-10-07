import { describe, expect, it } from "vitest";
import { COURIERS, courierTrackingSchema, findCourier, trackingInfo } from "@/lib/couriers";

describe("courier catalogue", () => {
  it("has unique ids and https tracking pages", () => {
    expect(new Set(COURIERS.map((c) => c.id)).size).toBe(COURIERS.length);
    for (const c of COURIERS) {
      if ("trackingPage" in c) expect(c.trackingPage, c.id).toMatch(/^https:\/\//);
    }
  });

  it("puts the tracking number into direct links safely", () => {
    const link = findCourier("DELHIVERY")!.trackingLink!("AB 12/34");
    expect(link).toBe("https://www.delhivery.com/track-v2/package/AB%2012%2F34");
  });
});

describe("tracking input", () => {
  it("normalises the number (spaces removed, upper case)", () => {
    const r = courierTrackingSchema.parse({ courier: "DTDC", trackingNumber: " d123 456 78 " });
    expect(r.trackingNumber).toBe("D12345678");
  });

  it("checks India Post's known format", () => {
    expect(courierTrackingSchema.safeParse({ courier: "INDIA_POST", trackingNumber: "ee123456789in" }).success).toBe(true);
    const bad = courierTrackingSchema.safeParse({ courier: "INDIA_POST", trackingNumber: "123456789" });
    expect(!bad.success && bad.error.issues[0]!.message).toBe("India Post (Speed Post / Registered) numbers look like EE123456789IN.");
  });

  it("rejects unknown couriers and implausible numbers", () => {
    expect(courierTrackingSchema.safeParse({ courier: "FEDEX_MARS", trackingNumber: "ABC12345" }).success).toBe(false);
    expect(courierTrackingSchema.safeParse({ courier: "DTDC", trackingNumber: "12" }).success).toBe(false);
    expect(courierTrackingSchema.safeParse({ courier: "DTDC", trackingNumber: "<script>1</script>" }).success).toBe(false);
  });

  it("needs a name for other couriers, without contact details", () => {
    expect(courierTrackingSchema.safeParse({ courier: "OTHER", trackingNumber: "ABC12345" }).success).toBe(false);
    expect(courierTrackingSchema.safeParse({ courier: "OTHER", courierName: "Call 9847012345", trackingNumber: "ABC12345" }).success).toBe(false);
    expect(courierTrackingSchema.safeParse({ courier: "OTHER", courierName: "Local Express", trackingNumber: "ABC12345" }).success).toBe(true);
  });
});

describe("tracking display", () => {
  it("links straight to the parcel when the courier supports it", () => {
    expect(trackingInfo({ courier: "BLUE_DART", courierName: null, trackingNumber: "12345678901" })).toMatchObject({
      courierName: "Blue Dart",
      direct: true,
      url: "https://www.bluedart.com/web/guest/trackdartresult?trackFor=0&trackNo=12345678901",
    });
  });

  it("falls back to the courier's tracking page, or no link", () => {
    expect(trackingInfo({ courier: "DTDC", courierName: null, trackingNumber: "D12345678" })).toMatchObject({ direct: false, url: "https://www.dtdc.com/track-your-shipment/" });
    expect(trackingInfo({ courier: "KSRTC", courierName: null, trackingNumber: "KL123456" })).toMatchObject({ url: null });
    expect(trackingInfo({ courier: "OTHER", courierName: "Local Express", trackingNumber: "ABC12345" })).toMatchObject({ courierName: "Local Express", url: null });
  });

  it("is empty until a number is added", () => {
    expect(trackingInfo({ courier: null, courierName: null, trackingNumber: null })).toBeNull();
  });
});
