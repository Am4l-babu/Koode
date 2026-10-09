/**
 * Regression tests for issues found in code review: donor product questions,
 * new-only items, media upload limits and moderation, and courier tracking.
 */
import { beforeAll, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import sharp from "sharp";
import { call } from "../helpers/http";
import { activeRequest, db, makeFixtures, type Fixtures } from "../helpers/fixtures";
import * as donationsRoute from "@/app/api/donations/route";
import * as requestRoute from "@/app/api/requests/[id]/route";
import * as mediaUpload from "@/app/api/my-donations/[id]/media/route";
import * as mediaFile from "@/app/api/media/[id]/route";
import * as adminMedia from "@/app/api/admin/media/[id]/route";
import * as tracking from "@/app/api/my-donations/[id]/tracking/route";
import { MAX_MEDIA_REQUEST_BYTES } from "@/lib/storage/media";

let f: Fixtures;
const categoryId = async (slug: string) => (await db.category.findUniqueOrThrow({ where: { slug } })).id;
const mp4 = () => Buffer.concat([Buffer.from([0, 0, 0, 16]), Buffer.from("ftypisom"), Buffer.alloc(4), Buffer.from([0, 0, 0, 12]), Buffer.from("mdat"), Buffer.from("DATA")]);

beforeAll(async () => {
  f = await makeFixtures();
});

async function donate(requestId: string, items: unknown[], deliveryMethod = "PARTNER_DROPOFF") {
  return call(donationsRoute.POST, { token: f.donorA.token, body: { requestId, items, deliveryMethod, anonymousAcknowledged: true } });
}

function upload(donationId: string, file: Buffer, name: string, type: string) {
  const form = new FormData();
  form.set("file", new Blob([new Uint8Array(file)], { type }), name);
  return call(mediaUpload.POST, { token: f.donorA.token, params: { id: donationId }, formData: form });
}

describe("donor product questions", () => {
  it("a product type's required question is optional for donors", async () => {
    const req = await activeRequest(f.recipientB.org.id, [{ name: "Shirt", quantity: 5, attributes: { productType: "Shirt / T-shirt", size: "28, 30, 32" } }], await categoryId("clothing"));
    const pub = await call(requestRoute.GET, { params: { id: req.publicId } });
    expect(pub.json.data.items[0].donorFields.every((d: { required: boolean }) => d.required === false)).toBe(true);
    // "Mixed / any listed" sends no size at all.
    const r = await donate(req.publicId, [{ requestItemId: req.items[0]!.id, quantity: 1, variant: {} }]);
    expect(r.status).toBe(201);
  });

  it("a dropdown answer with a slash in it is accepted whole", async () => {
    const req = await activeRequest(f.recipientB.org.id, [{ name: "Cot", quantity: 2, attributes: { productType: "Stroller / cot / high chair", babyItem: "Cot / crib" } }], await categoryId("children"));
    const r = await donate(req.publicId, [{ requestItemId: req.items[0]!.id, quantity: 1, variant: { babyItem: "Cot / crib" } }]);
    expect(r.status).toBe(201);
  });
});

describe("new-only items", () => {
  let reqId: string;
  let itemId: string;
  beforeAll(async () => {
    const req = await activeRequest(f.recipientB.org.id, [{ name: "Baby diapers", quantity: 20, attributes: { productType: "Baby diapers", size: "M", ageRange: "0–2" } }], await categoryId("children"));
    reqId = req.publicId;
    itemId = req.items[0]!.id;
  });

  it("are flagged for the donation form", async () => {
    const pub = await call(requestRoute.GET, { params: { id: reqId } });
    expect(pub.json.data.items[0].newOnly).toBe(true);
  });

  it("refuse anything but new", async () => {
    const r = await donate(reqId, [{ requestItemId: itemId, quantity: 1, condition: "GOOD" }]);
    expect(r.status).toBe(422);
    expect(r.json.error.details.fields["items.0.condition"]).toBe("Only new baby diapers can be accepted.");
    expect((await donate(reqId, [{ requestItemId: itemId, quantity: 1, condition: "NEW" }])).status).toBe(201);
  });
});

describe("media uploads", () => {
  let donationId: string;
  beforeAll(async () => {
    const r = await donate(f.request.publicId, [{ requestItemId: f.request.items[1]!.id, quantity: 1 }]);
    donationId = r.json.data.id;
  });

  it("stops reading an oversized body even without a Content-Length", async () => {
    let sent = 0;
    const chunk = new Uint8Array(1024 * 1024);
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        sent += chunk.byteLength;
        if (sent > MAX_MEDIA_REQUEST_BYTES * 4) controller.close();
        else controller.enqueue(chunk);
      },
    });
    const req = new NextRequest(new URL(`/api/my-donations/${donationId}/media`, "http://localhost:3000"), {
      method: "POST",
      headers: { cookie: `sb_session=${f.donorA.token}`, "content-type": "multipart/form-data; boundary=x" },
      body: stream,
      duplex: "half",
      // Node needs "duplex" for a streamed request body; the DOM typings don't know it yet.
    } as unknown as ConstructorParameters<typeof NextRequest>[1]);
    const res = await mediaUpload.POST(req, { params: Promise.resolve({ id: donationId }) });
    expect(res.status).toBe(400);
    expect(sent).toBeLessThan(MAX_MEDIA_REQUEST_BYTES * 2);
  });

  it("serves byte ranges and whole files", async () => {
    const png = await sharp({ create: { width: 8, height: 8, channels: 3, background: "#d33" } }).png().toBuffer();
    const up = await upload(donationId, png, "a.png", "image/png");
    expect(up.status).toBe(201);
    const id = up.json.data.id;
    const whole = await call(mediaFile.GET, { token: f.donorA.token, params: { id } });
    expect(whole.status).toBe(200);
    const size = Number(whole.headers.get("content-length"));
    expect(size).toBeGreaterThan(10);
    const part = await call(mediaFile.GET, { token: f.donorA.token, params: { id }, headers: { range: "bytes=0-3" } });
    expect(part.status).toBe(206);
    expect(part.headers.get("content-range")).toBe(`bytes 0-3/${size}`);
    expect(part.headers.get("content-length")).toBe("4");
    expect((await call(mediaFile.GET, { token: f.donorA.token, params: { id }, headers: { range: `bytes=${size}-` } })).status).toBe(416);
  });

  it("re-approving a rejected video can't exceed the one-video limit; notices name the file kind", async () => {
    const first = await upload(donationId, mp4(), "a.mp4", "video/mp4");
    expect(first.status).toBe(201);
    const moderate = (id: string, status: string) => call(adminMedia.PATCH, { token: f.moderator.token, method: "PATCH", params: { id }, body: { status } });
    expect((await moderate(first.json.data.id, "REJECTED")).status).toBe(200);
    const second = await upload(donationId, mp4(), "b.mp4", "video/mp4");
    expect(second.status).toBe(201);
    const again = await moderate(first.json.data.id, "APPROVED");
    expect(again.status).toBe(409);

    const photo = (await db.donationMedia.findFirstOrThrow({ where: { donation: { publicId: donationId }, kind: "IMAGE" } })).id;
    expect((await moderate(photo, "REJECTED")).status).toBe(200);
    const note = await db.notification.findFirst({ where: { userId: f.donorA.id, type: "MEDIA_DECISION" }, orderBy: { createdAt: "desc" } });
    expect(note?.title).toBe("A photo was not approved");
    // Repeating the same decision doesn't notify again.
    const before = await db.notification.count({ where: { userId: f.donorA.id, type: "MEDIA_DECISION" } });
    await moderate(photo, "REJECTED");
    expect(await db.notification.count({ where: { userId: f.donorA.id, type: "MEDIA_DECISION" } })).toBe(before);
  });
});

describe("courier tracking keeps admin delivery outcomes", () => {
  it("correcting a tracking number doesn't reset a delivery marked delivered", async () => {
    const r = await donate(f.request.publicId, [{ requestItemId: f.request.items[1]!.id, quantity: 1 }], "DELIVERY");
    const id = r.json.data.id;
    const put = (body: unknown) => call(tracking.PUT, { token: f.donorA.token, method: "PUT", params: { id }, body });
    expect((await put({ courier: "DTDC", trackingNumber: "D12345678" })).status).toBe(200);
    await db.delivery.updateMany({ where: { donation: { publicId: id } }, data: { status: "DELIVERED" } });
    expect((await put({ courier: "DTDC", trackingNumber: "D12345679" })).status).toBe(200);
    const delivery = await db.delivery.findFirstOrThrow({ where: { donation: { publicId: id } } });
    expect(delivery).toMatchObject({ status: "DELIVERED", trackingNumber: "D12345679" });
  });
});
