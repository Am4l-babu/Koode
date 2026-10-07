/**
 * Courier tracking: the donor adds the courier and tracking number, the
 * donation moves to in transit, and the recipient sees the same details.
 */
import { beforeAll, describe, expect, it } from "vitest";
import { call } from "../helpers/http";
import { db, makeFixtures, type Fixtures } from "../helpers/fixtures";
import * as donationsRoute from "@/app/api/donations/route";
import * as tracking from "@/app/api/my-donations/[id]/tracking/route";
import * as recipientDonations from "@/app/api/recipient/donations/route";

let f: Fixtures;

beforeAll(async () => {
  f = await makeFixtures();
});

async function donate(deliveryMethod: string) {
  const r = await call(donationsRoute.POST, {
    token: f.donorA.token,
    body: { requestId: f.request.publicId, items: [{ requestItemId: f.request.items[1]!.id, quantity: 1 }], deliveryMethod, anonymousAcknowledged: true },
  });
  expect(r.status).toBe(201);
  return r.json.data.id as string;
}

const put = (id: string, body: unknown, token = f.donorA.token) => call(tracking.PUT, { token, method: "PUT", params: { id }, body });

describe("courier tracking", () => {
  let id: string;

  beforeAll(async () => {
    id = await donate("DELIVERY");
  });

  it("adding tracking marks the donation as sent and notifies the organisation", async () => {
    const r = await put(id, { courier: "INDIA_POST", trackingNumber: "ee 123456789 in" });
    expect(r.status).toBe(200);
    expect(r.json.data.status).toBe("IN_TRANSIT");
    expect(r.json.data.tracking).toMatchObject({ courierName: "India Post (Speed Post / Registered)", trackingNumber: "EE123456789IN" });
    expect(r.json.data.timeline.at(-1)).toMatchObject({ status: "IN_TRANSIT", note: "Sent by India Post (Speed Post / Registered)." });
    const delivery = await db.delivery.findFirstOrThrow({ where: { donation: { publicId: id } } });
    expect(delivery.status).toBe("PICKED_UP");
    const note = await db.notification.findFirst({ where: { userId: f.recipientB.user.id }, orderBy: { createdAt: "desc" } });
    expect(note?.title).toBe("Donation sent by courier");
  });

  it("the recipient sees the courier and a link to follow it", async () => {
    const r = await call(recipientDonations.GET, { token: f.recipientB.token });
    const mine = (r.json.data as { id: string; tracking: unknown }[]).find((d) => d.id === id);
    expect(mine?.tracking).toMatchObject({ courierId: "INDIA_POST", trackingNumber: "EE123456789IN", url: "https://www.indiapost.gov.in/" });
  });

  it("the donor can correct it while in transit, without a second status change", async () => {
    const r = await put(id, { courier: "OTHER", courierName: "Local Express", trackingNumber: "LX-55501" });
    expect(r.status).toBe(200);
    expect(r.json.data.tracking).toMatchObject({ courierName: "Local Express", trackingNumber: "LX-55501", url: null });
    expect(r.json.data.timeline.filter((t: { status: string }) => t.status === "IN_TRANSIT")).toHaveLength(1);
    const note = await db.notification.findFirst({ where: { userId: f.recipientB.user.id }, orderBy: { createdAt: "desc" } });
    expect(note?.title).toBe("Tracking details updated");
  });

  it("rejects badly formed numbers with a field error", async () => {
    const r = await put(id, { courier: "INDIA_POST", trackingNumber: "12345678" });
    expect(r.status).toBe(422);
    expect(r.json.error.details.fields.trackingNumber).toMatch(/EE123456789IN/);
  });

  it("only the donor who made the donation can add tracking", async () => {
    expect((await put(id, { courier: "DTDC", trackingNumber: "D12345678" }, f.donorB.token)).status).toBe(404);
    expect((await put(id, { courier: "DTDC", trackingNumber: "D12345678" }, f.recipientB.token)).status).toBe(403);
  });

  it("is only for donations sent by courier", async () => {
    const dropOff = await donate("PARTNER_DROPOFF");
    const r = await put(dropOff, { courier: "DTDC", trackingNumber: "D12345678" });
    expect(r.status).toBe(409);
  });

  it("can't be changed once the items are received", async () => {
    await db.donation.update({ where: { publicId: id }, data: { status: "RECEIVED" } });
    expect((await put(id, { courier: "DTDC", trackingNumber: "D12345678" })).status).toBe(409);
  });
});
