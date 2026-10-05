/**
 * Integration tests for the three core journeys (brief §75) end-to-end
 * through the real API handlers and database.
 */
import { beforeAll, describe, expect, it } from "vitest";
import { call } from "../helpers/http";
import { db, makeFixtures, type Fixtures } from "../helpers/fixtures";
import { outbox } from "@/lib/notifications/channels";

import * as register from "@/app/api/auth/register/route";
import * as login from "@/app/api/auth/login/route";
import * as docs from "@/app/api/organization/documents/route";
import * as submitVerification from "@/app/api/organization/verification/route";
import * as adminVerification from "@/app/api/admin/verifications/[id]/route";
import * as requestsRoute from "@/app/api/requests/route";
import * as requestRoute from "@/app/api/requests/[id]/route";
import * as adminRequest from "@/app/api/admin/requests/[id]/route";
import * as donationsRoute from "@/app/api/donations/route";
import * as myDonation from "@/app/api/my-donations/[id]/route";
import * as recipientDonations from "@/app/api/recipient/donations/route";
import * as receive from "@/app/api/recipient/donations/[id]/receive/route";
import * as adminDonation from "@/app/api/admin/donations/[id]/route";
import * as myRequest from "@/app/api/my-requests/[id]/route";
import * as report from "@/app/api/requests/[id]/report/route";
import * as forgot from "@/app/api/auth/forgot-password/route";
import * as reset from "@/app/api/auth/reset-password/route";
import * as verifyEmail from "@/app/api/auth/verify-email/route";

let f: Fixtures;
const cookieToken = (res: { headers: Headers }) => res.headers.get("set-cookie")!.match(/sb_session=([^;]+)/)![1]!;

beforeAll(async () => {
  f = await makeFixtures();
});

describe("recipient request flow: register → verify → create → approve → published", () => {
  let token: string;
  let orgId: string;
  let requestId: string;

  it("registers an organisation (pending verification, nothing public)", async () => {
    const r = await call(register.POST, {
      body: {
        role: "RECIPIENT", fullName: "Anita Varghese", email: "newschool@x.test", password: "longpassword1", phone: "+91 98470 55555",
        orgType: "SCHOOL", orgLegalName: "Little Lamps School", contactPerson: "Anita Varghese", address: "Ward 4, Market Road", city: "Aluva", district: "Ernakulam", pinCode: "683101", acceptTerms: true,
      },
    });
    expect(r.status).toBe(201);
    expect(r.json.data.role).toBe("RECIPIENT");
    token = cookieToken(r);
    const org = await db.recipientOrganization.findFirstOrThrow({ where: { user: { email: "newschool@x.test" } } });
    orgId = org.id;
    expect(org.verificationStatus).toBe("PENDING");
    expect(org.publicDescriptor).toBe("Verified Learning Center");
    expect(outbox.some((m) => m.subject === "Confirm your email")).toBe(true);
  });

  it("can create a request, which stays private until approved", async () => {
    const r = await call(requestsRoute.POST, {
      token,
      body: {
        categoryId: (await db.category.findUniqueOrThrow({ where: { slug: "clothing" } })).id,
        title: "Shirts for primary students",
        description: "Cotton school shirts for children who currently share uniforms between siblings.",
        urgency: "HIGH",
        district: "Ernakulam",
        city: "Aluva",
        peopleAffected: 30,
        items: [{ name: "School shirt", quantity: 12, attributes: { size: "28, 30, 32", ageGroup: "8–10", gender: "Any" } }],
      },
    });
    expect(r.status).toBe(201);
    expect(r.json.data.status).toBe("PENDING_VERIFICATION");
    requestId = r.json.data.id;
    expect((await call(requestRoute.GET, { params: { id: requestId } })).status).toBe(404);
    const row = await db.requestItem.findFirstOrThrow({ where: { request: { publicId: requestId } } });
    expect([row.ageMin, row.ageMax]).toEqual([8, 10]);
  });

  it("validates variants against the category schema", async () => {
    const r = await call(requestsRoute.POST, {
      token,
      body: {
        categoryId: (await db.category.findUniqueOrThrow({ where: { slug: "clothing" } })).id,
        title: "Shirts without size info",
        description: "A request that is missing the required size attribute for clothing items.",
        district: "Ernakulam",
        items: [{ name: "Shirt", quantity: 3, attributes: {} }],
      },
    });
    expect(r.status).toBe(422);
    expect(r.json.error.details.fields["items.0.attributes.size"]).toBe("Size is required.");
  });

  it("uploads a document (magic-byte validated) and submits verification", async () => {
    const bad = new FormData();
    bad.set("kind", "REGISTRATION_CERTIFICATE");
    bad.set("file", new File(["<html>not a pdf</html>"], "cert.pdf", { type: "application/pdf" }));
    expect((await call(docs.POST, { token, formData: bad })).status).toBe(400);

    const good = new FormData();
    good.set("kind", "REGISTRATION_CERTIFICATE");
    good.set("file", new File(["%PDF-1.4 test certificate"], "cert.pdf", { type: "application/pdf" }));
    expect((await call(docs.POST, { token, formData: good })).status).toBe(201);
    expect((await call(submitVerification.POST, { token, body: { note: "Please review" } })).status).toBe(200);
  });

  it("admin cannot approve the request before the organisation is verified", async () => {
    const req = await db.request.findUniqueOrThrow({ where: { publicId: requestId } });
    const r = await call(adminRequest.PATCH, { token: f.moderator.token, method: "PATCH", params: { id: req.id }, body: { decision: "APPROVE" } });
    expect(r.status).toBe(409);
  });

  it("admin reviews the dossier (audited) and verifies the organisation", async () => {
    const dossier = await call(adminVerification.GET, { token: f.moderator.token, params: { id: orgId } });
    expect(dossier.status).toBe(200);
    expect(dossier.json.data.private.legalName).toBe("Little Lamps School");
    expect(dossier.json.data.documents[0].url).toMatch(/^\/api\/admin\/documents\/.+\?exp=\d+&sig=/);
    expect(await db.auditLog.count({ where: { action: "VIEW_PRIVATE_IDENTITY", targetId: dossier.json.data.publicId } })).toBe(1);

    const decide = await call(adminVerification.PATCH, {
      token: f.moderator.token, method: "PATCH", params: { id: orgId },
      body: { status: "VERIFIED", checklist: { registration: true, contactPerson: true, location: true, documents: true, proofOfNeed: true, previousActivity: true } },
    });
    expect(decide.status).toBe(200);
    expect((await db.recipientOrganization.findUniqueOrThrow({ where: { id: orgId } })).verificationStatus).toBe("VERIFIED");
  });

  it("admin approves with a final priority → request is published anonymously", async () => {
    const req = await db.request.findUniqueOrThrow({ where: { publicId: requestId } });
    const r = await call(adminRequest.PATCH, { token: f.moderator.token, method: "PATCH", params: { id: req.id }, body: { decision: "APPROVE", priority: "CRITICAL" } });
    expect(r.status).toBe(200);
    const pub = await call(requestRoute.GET, { params: { id: requestId } });
    expect(pub.status).toBe(200);
    expect(pub.json.data.priority).toBe("CRITICAL");
    expect(pub.json.data.recipient.descriptor).toBe("Verified Learning Center");
    expect(pub.text).not.toContain("Little Lamps");
    expect(pub.text).not.toContain("priorityScore");
    const own = await call(myRequest.GET, { token, params: { id: requestId } });
    expect(own.json.data.status).toBe("ACTIVE");
  });

  it("is discoverable via natural-language search", async () => {
    const r = await call(requestsRoute.GET, { path: "/api/requests?q=shirts%20size%2030%20near%20Aluva" });
    expect(r.json.data.items.map((i: { id: string }) => i.id)).toContain(requestId);
    const age = await call(requestsRoute.GET, { path: "/api/requests?q=shirt%20for%209%20year%20old" });
    expect(age.json.data.items.map((i: { id: string }) => i.id)).toContain(requestId);
    const wrongAge = await call(requestsRoute.GET, { path: "/api/requests?q=shirt%20for%2015%20year%20old" });
    expect(wrongAge.json.data.items.map((i: { id: string }) => i.id)).not.toContain(requestId);
  });
});

describe("donor donation flow: browse → commit → track → received", () => {
  let donationId: string;

  it("filters and finds the education request", async () => {
    const r = await call(requestsRoute.GET, { path: "/api/requests?category=education&sort=urgent" });
    expect(r.json.data.items[0].id).toBe(f.request.publicId);
  });

  it("commits 2 school bags anonymously", async () => {
    const r = await call(donationsRoute.POST, {
      token: f.donorA.token,
      body: { requestId: f.request.publicId, items: [{ requestItemId: f.request.items[0]!.id, quantity: 2 }], deliveryMethod: "PARTNER_DROPOFF", anonymousAcknowledged: true },
    });
    expect(r.status).toBe(201);
    donationId = r.json.data.id;
    expect(donationId).toMatch(/^DN-[23456789A-Z]{6}$/);
    expect(r.json.data.status).toBe("CONFIRMED");
    expect(r.json.data.estimatedValue).toBe(1000);

    const pub = await call(requestRoute.GET, { params: { id: f.request.publicId } });
    const bag = pub.json.data.items.find((i: { name: string }) => i.name === "School bag");
    expect(bag).toMatchObject({ committed: 2, remaining: 8 });
  });

  it("rejects donations that exceed the remaining quantity", async () => {
    const r = await call(donationsRoute.POST, {
      token: f.donorB.token,
      body: { requestId: f.request.publicId, items: [{ requestItemId: f.request.items[0]!.id, quantity: 9 }], deliveryMethod: "PARTNER_DROPOFF", anonymousAcknowledged: true },
    });
    expect(r.status).toBe(409);
    expect(r.json.error.code).toBe("INSUFFICIENT_QUANTITY");
    expect(r.json.error.details.remaining).toBe(8);
  });

  it("donor marks preparation and confirms handover", async () => {
    expect((await call(myDonation.PATCH, { token: f.donorA.token, method: "PATCH", params: { id: donationId }, body: { action: "PREPARING" } })).json.data.status).toBe("PREPARING");
    const r = await call(myDonation.PATCH, { token: f.donorA.token, method: "PATCH", params: { id: donationId }, body: { action: "HANDED_OVER" } });
    expect(r.json.data.status).toBe("IN_TRANSIT");
    expect(r.json.data.timeline.map((t: { status: string }) => t.status)).toEqual(["CREATED", "CONFIRMED", "PREPARING", "IN_TRANSIT"]);
  });

  it("recipient sees the donation and confirms receipt; donor is notified", async () => {
    const list = await call(recipientDonations.GET, { token: f.recipientB.token, path: "/api/recipient/donations" });
    expect(list.json.data.find((d: { id: string }) => d.id === donationId).items[0]).toMatchObject({ name: "School bag", quantity: 2 });
    const r = await call(receive.POST, { token: f.recipientB.token, params: { id: donationId }, body: {} });
    expect(r.json.data.status).toBe("RECEIVED");
    expect((await db.requestItem.findUniqueOrThrow({ where: { id: f.request.items[0]!.id } })).quantityReceived).toBe(2);
    const notes = await db.notification.findMany({ where: { userId: f.donorA.id, type: "DONATION_RECEIVED" } });
    expect(notes).toHaveLength(1);
  });

  it("admin closes the donation as completed", async () => {
    const d = await db.donation.findUniqueOrThrow({ where: { publicId: donationId } });
    expect((await call(adminDonation.PATCH, { token: f.moderator.token, method: "PATCH", params: { id: d.id }, body: { status: "COMPLETED" } })).status).toBe(200);
    expect((await call(myDonation.GET, { token: f.donorA.token, params: { id: donationId } })).json.data.status).toBe("COMPLETED");
  });

  it("cancelling a donation releases its quantity", async () => {
    const r = await call(donationsRoute.POST, {
      token: f.donorB.token,
      body: { requestId: f.request.publicId, items: [{ requestItemId: f.request.items[1]!.id, quantity: 10 }], deliveryMethod: "DELIVERY", anonymousAcknowledged: true },
    });
    const id = r.json.data.id;
    expect((await db.requestItem.findUniqueOrThrow({ where: { id: f.request.items[1]!.id } })).quantityCommitted).toBe(10);
    await call(myDonation.PATCH, { token: f.donorB.token, method: "PATCH", params: { id }, body: { action: "CANCEL" } });
    expect((await db.requestItem.findUniqueOrThrow({ where: { id: f.request.items[1]!.id } })).quantityCommitted).toBe(0);
  });

  it("a fully committed request flips to FULFILLED and leaves the active listing", async () => {
    await call(donationsRoute.POST, {
      token: f.donorB.token,
      body: { requestId: f.request.publicId, items: [{ requestItemId: f.request.items[0]!.id, quantity: 8 }, { requestItemId: f.request.items[1]!.id, quantity: 50 }], deliveryMethod: "DELIVERY", anonymousAcknowledged: true },
    });
    const req = await db.request.findUniqueOrThrow({ where: { id: f.request.id } });
    expect(req.status).toBe("FULFILLED");
    expect(req.percentFulfilled).toBe(100);
    const list = await call(requestsRoute.GET, { path: "/api/requests" });
    expect(list.json.data.items.map((i: { id: string }) => i.id)).not.toContain(f.request.publicId);
  });

  it("anyone can report a request into the investigation queue", async () => {
    const other = await db.request.findFirstOrThrow({ where: { status: "ACTIVE" } });
    const r = await call(report.POST, { params: { id: other.publicId }, body: { reason: "DUPLICATE_REQUEST", details: "Seen twice" } });
    expect(r.status).toBe(201);
    expect(await db.report.count({ where: { requestId: other.id, status: "OPEN" } })).toBe(1);
  });
});

describe("account flows", () => {
  it("password reset: same response for unknown emails, token works once, sessions revoked", async () => {
    outbox.length = 0;
    const unknown = await call(forgot.POST, { body: { email: "ghost@x.test" } });
    const known = await call(forgot.POST, { body: { email: "zarina.donor@leaktest.example" } });
    expect(unknown.json).toEqual(known.json);
    expect(outbox).toHaveLength(1);
    const token = outbox[0]!.text.match(/token=([A-Za-z0-9_-]+)/)![1]!;
    expect((await call(reset.POST, { body: { token, password: "brandNewPass99" } })).status).toBe(200);
    expect((await call(reset.POST, { body: { token, password: "anotherPass99" } })).status).toBe(400);
    expect(await db.session.count({ where: { userId: f.donorA.id } })).toBe(0);
    expect((await call(login.POST, { body: { email: "zarina.donor@leaktest.example", password: "brandNewPass99" } })).status).toBe(200);
  });

  it("email verification tokens are single-use", async () => {
    outbox.length = 0;
    const r = await call(register.POST, { body: { role: "DONOR", fullName: "Vera Fy", email: "verify@x.test", password: "longpassword1", acceptTerms: true } });
    expect(r.status).toBe(201);
    const token = outbox.find((m) => m.subject === "Confirm your email")!.text.match(/token=([A-Za-z0-9_-]+)/)![1]!;
    expect((await call(verifyEmail.POST, { body: { token } })).status).toBe(200);
    expect((await db.user.findUniqueOrThrow({ where: { email: "verify@x.test" } })).emailVerifiedAt).not.toBeNull();
    expect((await call(verifyEmail.POST, { body: { token } })).status).toBe(400);
  });
});
