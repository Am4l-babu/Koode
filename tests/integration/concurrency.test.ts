/**
 * Data consistency (brief §66): donation quantities can never exceed what was
 * requested, even under concurrent donations.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { activeRequest, db, makeFixtures, type Fixtures } from "../helpers/fixtures";
import { createDonation } from "@/services/donations";
import { resolveSession, type SessionUser } from "@/lib/auth/session";
import { AppError } from "@/lib/errors";

let f: Fixtures;
let donors: SessionUser[];

beforeEach(async () => {
  f = await makeFixtures();
  donors = [(await resolveSession(f.donorA.token))!, (await resolveSession(f.donorB.token))!];
});

function donate(donor: SessionUser, requestId: string, itemId: string, quantity: number) {
  return createDonation(donor, { requestId, items: [{ requestItemId: itemId, quantity }], deliveryMethod: "DELIVERY", condition: "NEW", groupType: "INDIVIDUAL", anonymousAcknowledged: true });
}

describe("concurrent donations", () => {
  it("required 10, fulfilled 8, two donors each try 2 at once → exactly one succeeds", async () => {
    const req = await activeRequest(f.recipientB.org.id, [{ name: "Blanket", quantity: 10, committed: 8 }], f.education.id);
    const item = req.items[0]!;
    const results = await Promise.allSettled([donate(donors[0]!, req.publicId, item.id, 2), donate(donors[1]!, req.publicId, item.id, 2)]);
    const ok = results.filter((r) => r.status === "fulfilled");
    const failed = results.filter((r) => r.status === "rejected") as PromiseRejectedResult[];
    expect(ok).toHaveLength(1);
    expect(failed).toHaveLength(1);
    // The winner can fill the request, flipping it to FULFILLED before the loser looks it up.
    expect(["INSUFFICIENT_QUANTITY", "NOT_FOUND"]).toContain((failed[0]!.reason as AppError).code);
    const after = await db.requestItem.findUniqueOrThrow({ where: { id: item.id } });
    expect(after.quantityCommitted).toBe(10);
    expect(await db.donation.count({ where: { requestId: req.id } })).toBe(1);
  });

  it("30 simultaneous single-unit donations against 7 remaining → exactly 7 succeed", async () => {
    const req = await activeRequest(f.recipientB.org.id, [{ name: "Notebook", quantity: 7 }], f.education.id);
    const item = req.items[0]!;
    const results = await Promise.allSettled(Array.from({ length: 30 }, (_, i) => donate(donors[i % 2]!, req.publicId, item.id, 1)));
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(7);
    const after = await db.requestItem.findUniqueOrThrow({ where: { id: item.id } });
    expect(after.quantityCommitted).toBe(7);
    const sum = await db.donationItem.aggregate({ _sum: { quantity: true }, where: { requestItemId: item.id } });
    expect(sum._sum.quantity).toBe(7);
    expect((await db.request.findUniqueOrThrow({ where: { id: req.id } })).status).toBe("FULFILLED");
  });

  it("a multi-item donation is all-or-nothing", async () => {
    const req = await activeRequest(f.recipientB.org.id, [{ name: "Pen", quantity: 10 }, { name: "Ruler", quantity: 1, committed: 1 }], f.education.id);
    await expect(
      createDonation(donors[0]!, {
        requestId: req.publicId,
        items: [{ requestItemId: req.items[0]!.id, quantity: 5 }, { requestItemId: req.items[1]!.id, quantity: 1 }],
        deliveryMethod: "DELIVERY", condition: "NEW", groupType: "INDIVIDUAL", anonymousAcknowledged: true,
      }),
    ).rejects.toMatchObject({ code: "INSUFFICIENT_QUANTITY" });
    expect((await db.requestItem.findUniqueOrThrow({ where: { id: req.items[0]!.id } })).quantityCommitted).toBe(0);
    expect(await db.donation.count({ where: { requestId: req.id } })).toBe(0);
  });

  it("the database CHECK constraint is the final guard", async () => {
    const req = await activeRequest(f.recipientB.org.id, [{ name: "Bag", quantity: 3 }], f.education.id);
    await expect(db.requestItem.update({ where: { id: req.items[0]!.id }, data: { quantityCommitted: 4 } })).rejects.toThrow(/request_items_committed_bounds/);
  });

  it("audit logs are append-only at the database level", async () => {
    const log = await db.auditLog.create({ data: { actorLabel: "System", action: "TEST" } });
    await expect(db.auditLog.update({ where: { id: log.id }, data: { action: "TAMPERED" } })).rejects.toThrow(/append-only/);
  });
});
