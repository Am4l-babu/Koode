import { describe, expect, it } from "vitest";
import { fulfillmentStage, isFullyFulfilled, itemPercent, remaining, requestPercent, totals, validateCommitment } from "@/lib/fulfillment";

describe("fulfillment calculations", () => {
  it("computes remaining and never goes negative", () => {
    expect(remaining({ quantityRequired: 10, quantityCommitted: 8 })).toBe(2);
    expect(remaining({ quantityRequired: 10, quantityCommitted: 12 })).toBe(0);
  });

  it("computes per-item and quantity-weighted request percentages", () => {
    expect(itemPercent({ quantityRequired: 30, quantityCommitted: 24 })).toBe(80);
    const items = [
      { quantityRequired: 100, quantityCommitted: 100 },
      { quantityRequired: 50, quantityCommitted: 30 },
      { quantityRequired: 30, quantityCommitted: 12 },
    ];
    // (100 + 30 + 12) / 180 = 78.9%
    expect(requestPercent(items)).toBe(79);
  });

  it("tracks each item independently — partially fulfilled until all complete (brief §40)", () => {
    const items = [
      { quantityRequired: 100, quantityCommitted: 100 },
      { quantityRequired: 50, quantityCommitted: 30 },
      { quantityRequired: 30, quantityCommitted: 12 },
    ];
    expect(isFullyFulfilled(items)).toBe(false);
    expect(fulfillmentStage(items)).toBe("ALMOST_COMPLETE");
    expect(fulfillmentStage([{ quantityRequired: 10, quantityCommitted: 3 }])).toBe("PARTIALLY_FULFILLED");
    expect(fulfillmentStage([{ quantityRequired: 10, quantityCommitted: 0 }])).toBe("JUST_POSTED");
    expect(fulfillmentStage([{ quantityRequired: 10, quantityCommitted: 10 }, { quantityRequired: 2, quantityCommitted: 2 }])).toBe("FULFILLED");
  });

  it("caps over-commitment in totals", () => {
    expect(totals([{ quantityRequired: 5, quantityCommitted: 9, quantityReceived: 2 }])).toEqual({ required: 5, committed: 5, received: 2, remaining: 0 });
  });

  it("an empty request is never 'fulfilled'", () => {
    expect(isFullyFulfilled([])).toBe(false);
    expect(requestPercent([])).toBe(0);
  });
});

describe("commitment validation", () => {
  const item = { quantityRequired: 10, quantityCommitted: 8 };
  it("accepts quantities within the remaining amount", () => expect(validateCommitment(item, 2)).toEqual({ ok: true }));
  it("rejects quantities that would exceed what is needed", () => {
    const r = validateCommitment(item, 3);
    expect(r.ok).toBe(false);
    expect(!r.ok && r.reason).toMatch(/Only 2 more/);
  });
  it("rejects zero, negative and fractional quantities", () => {
    expect(validateCommitment(item, 0).ok).toBe(false);
    expect(validateCommitment(item, -1).ok).toBe(false);
    expect(validateCommitment(item, 1.5).ok).toBe(false);
  });
  it("rejects when fully committed", () => expect(validateCommitment({ quantityRequired: 4, quantityCommitted: 4 }, 1).ok).toBe(false));
});
