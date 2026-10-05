import { describe, expect, it } from "vitest";
import { priorityFromScore, priorityScore, suggestPriority } from "@/lib/priority";
import { parseSearchQuery, singularize } from "@/lib/search";

describe("priority engine", () => {
  const now = new Date("2026-10-05T00:00:00Z");
  it("scores urgency, deadline, people affected, remaining quantity and verification", () => {
    const high = priorityScore({ statedUrgency: "CRITICAL", neededBy: new Date("2026-10-07"), peopleAffected: 150, remainingFraction: 1, verified: true, now });
    const low = priorityScore({ statedUrgency: "NORMAL", neededBy: null, peopleAffected: 2, remainingFraction: 0.1, verified: false, now });
    expect(high).toBe(100);
    expect(low).toBeLessThan(15);
    expect(high).toBeGreaterThan(low);
  });
  it("maps scores to labels", () => {
    expect(priorityFromScore(85)).toBe("CRITICAL");
    expect(priorityFromScore(55)).toBe("HIGH");
    expect(priorityFromScore(35)).toBe("MEDIUM");
    expect(priorityFromScore(5)).toBe("NORMAL");
  });
  it("a nearer deadline never lowers priority", () => {
    const base = { statedUrgency: "MEDIUM" as const, peopleAffected: 20, remainingFraction: 0.5, verified: true, now };
    expect(suggestPriority({ ...base, neededBy: new Date("2026-10-08") }).score).toBeGreaterThanOrEqual(suggestPriority({ ...base, neededBy: new Date("2026-11-30") }).score);
  });
});

describe("natural-language search parser", () => {
  it("school bags for children", () => expect(parseSearchQuery("school bags for children")).toEqual({ terms: ["school", "bag"] }));
  it("shirts size 30", () => expect(parseSearchQuery("shirts size 30")).toEqual({ terms: ["shirt"], size: "30" }));
  it("food requirements near Thrissur", () => expect(parseSearchQuery("food requirements near Thrissur")).toEqual({ terms: [], categorySlug: "food", district: "Thrissur" }));
  it("toys for 5 year old children", () => expect(parseSearchQuery("toys for 5 year old children")).toEqual({ terms: [], categorySlug: "children", age: 5 }));
  it("maps cities to districts", () => expect(parseSearchQuery("blankets in Kochi").district).toBe("Ernakulam"));
  it("ignores punctuation and injection-like input safely", () => {
    const r = parseSearchQuery("'; DROP TABLE requests; --");
    expect(r.terms.every((t) => /^[\p{L}\p{N}–-]+$/u.test(t))).toBe(true);
  });
  it("singularises common plurals", () => {
    expect(singularize("bags")).toBe("bag");
    expect(singularize("supplies")).toBe("supply");
    expect(singularize("dress")).toBe("dress");
  });
});
