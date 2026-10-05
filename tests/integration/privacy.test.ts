/**
 * CRITICAL PRIVACY TESTS — the platform's first-class security invariant.
 *
 *   DONOR A attempts to identify RECIPIENT B  → DENIED
 *   RECIPIENT B attempts to identify DONOR A  → DENIED
 *   AUTHORIZED ADMIN                          → ALLOWED (and audited)
 *
 * Every endpoint reachable by a donor or recipient is called and its full
 * response body is scanned for the other party's PII.
 */
import { beforeAll, describe, expect, it } from "vitest";
import { call, leaks } from "../helpers/http";
import { db, makeFixtures, PII, user, type Fixtures } from "../helpers/fixtures";

import * as donationsRoute from "@/app/api/donations/route";
import * as myDonations from "@/app/api/my-donations/route";
import * as myDonation from "@/app/api/my-donations/[id]/route";
import * as requestsRoute from "@/app/api/requests/route";
import * as requestRoute from "@/app/api/requests/[id]/route";
import * as notifications from "@/app/api/notifications/route";
import * as recommendations from "@/app/api/recommendations/route";
import * as recipientDonations from "@/app/api/recipient/donations/route";
import * as receive from "@/app/api/recipient/donations/[id]/receive/route";
import * as myRequests from "@/app/api/my-requests/route";
import * as myRequest from "@/app/api/my-requests/[id]/route";
import * as orgRoute from "@/app/api/organization/route";
import * as me from "@/app/api/me/route";
import * as impact from "@/app/api/impact/route";
import * as donationIdentity from "@/app/api/admin/donations/[id]/identity/route";
import * as userIdentity from "@/app/api/admin/users/[id]/identity/route";
import * as adminDonation from "@/app/api/admin/donations/[id]/route";
import * as adminDonations from "@/app/api/admin/donations/route";
import * as adminUsers from "@/app/api/admin/users/route";
import * as deliveryPacket from "@/app/api/admin/deliveries/[id]/packet/route";
import * as dossier from "@/app/api/admin/verifications/[id]/route";

let f: Fixtures;
let donationPublicId: string;
let donationId: string;

const recipientSecrets = () => [PII.orgB.legalName, PII.orgB.contact, PII.orgB.phone, PII.orgB.address, PII.orgB.email, PII.orgB.pin, f.recipientB.org.id, f.recipientB.user.id];
const donorSecrets = () => [PII.donorA.name, PII.donorA.email, PII.donorA.phone, f.donorA.id, f.donorA.publicId, "Demo pickup street 9"];

beforeAll(async () => {
  f = await makeFixtures();
  const res = await call(donationsRoute.POST, {
    token: f.donorA.token,
    body: {
      requestId: f.request.publicId,
      items: [{ requestItemId: f.request.items[0]!.id, quantity: 2 }],
      deliveryMethod: "PLATFORM_PICKUP",
      pickupAddress: "Demo pickup street 9, Kochi",
      pickupPhone: "+919811100001",
      anonymousAcknowledged: true,
    },
  });
  expect(res.status).toBe(201);
  donationPublicId = res.json.data.id;
  donationId = (await db.donation.findUniqueOrThrow({ where: { publicId: donationPublicId } })).id;
});

describe("DONOR A attempts to identify RECIPIENT B → DENIED", () => {
  it("no donor-reachable endpoint returns recipient PII", async () => {
    const responses = await Promise.all([
      call(requestsRoute.GET, { path: "/api/requests" }),
      call(requestRoute.GET, { params: { id: f.request.publicId } }),
      call(myDonations.GET, { token: f.donorA.token }),
      call(myDonation.GET, { token: f.donorA.token, params: { id: donationPublicId } }),
      call(notifications.GET, { token: f.donorA.token }),
      call(recommendations.GET, { token: f.donorA.token }),
      call(me.GET, { token: f.donorA.token }),
      call(impact.GET),
    ]);
    for (const r of responses) {
      expect(r.status).toBe(200);
      expect(leaks(r.text, recipientSecrets())).toEqual([]);
    }
  });

  it("the donor sees only an anonymous recipient reference", async () => {
    const r = await call(myDonation.GET, { token: f.donorA.token, params: { id: donationPublicId } });
    expect(r.json.data.recipient).toEqual({ ref: f.recipientB.org.publicId, descriptor: "Verified Children's Center", district: "Ernakulam" });
    expect(Object.keys(r.json.data)).not.toContain("organizationId");
  });

  it("the donor cannot call identity-resolution APIs", async () => {
    expect((await call(donationIdentity.GET, { token: f.donorA.token, params: { id: donationId } })).status).toBe(403);
    expect((await call(userIdentity.GET, { token: f.donorA.token, params: { id: f.recipientB.user.id } })).status).toBe(403);
    expect((await call(dossier.GET, { token: f.donorA.token, params: { id: f.recipientB.org.id } })).status).toBe(403);
    expect((await call(adminDonation.GET, { token: f.donorA.token, params: { id: donationId } })).status).toBe(403);
  });
});

describe("RECIPIENT B attempts to identify DONOR A → DENIED", () => {
  it("no recipient-reachable endpoint returns donor PII or donor account references", async () => {
    const responses = await Promise.all([
      call(recipientDonations.GET, { token: f.recipientB.token, path: "/api/recipient/donations" }),
      call(myRequests.GET, { token: f.recipientB.token }),
      call(myRequest.GET, { token: f.recipientB.token, params: { id: f.request.publicId } }),
      call(notifications.GET, { token: f.recipientB.token }),
      call(orgRoute.GET, { token: f.recipientB.token }),
      call(me.GET, { token: f.recipientB.token }),
    ]);
    for (const r of responses) {
      expect(r.status).toBe(200);
      expect(leaks(r.text, donorSecrets())).toEqual([]);
    }
  });

  it("the recipient sees an anonymous per-organisation alias, not the donor's account id", async () => {
    const r = await call(recipientDonations.GET, { token: f.recipientB.token, path: "/api/recipient/donations" });
    const d = r.json.data[0];
    expect(d.donor.displayName).toMatch(/^Community Donor #D[23456789A-Z]{5}$/);
    expect(d.donor.alias).not.toBe(f.donorA.publicId);
    expect(Object.keys(d)).not.toEqual(expect.arrayContaining(["donorId", "organizationId"]));
  });

  it("confirming receipt does not reveal the donor either", async () => {
    const r = await call(receive.POST, { token: f.recipientB.token, params: { id: donationPublicId }, body: {} });
    expect(r.status).toBe(200);
    expect(leaks(r.text, donorSecrets())).toEqual([]);
  });

  it("the recipient cannot call identity-resolution APIs", async () => {
    expect((await call(donationIdentity.GET, { token: f.recipientB.token, params: { id: donationId } })).status).toBe(403);
    expect((await call(userIdentity.GET, { token: f.recipientB.token, params: { id: f.donorA.id } })).status).toBe(403);
    expect((await call(adminDonations.GET, { token: f.recipientB.token })).status).toBe(403);
  });

  it("notification bodies for the recipient never include donor identity", async () => {
    const rows = await db.notification.findMany({ where: { userId: f.recipientB.user.id } });
    expect(rows.length).toBeGreaterThan(0);
    expect(leaks(JSON.stringify(rows), donorSecrets())).toEqual([]);
    expect(rows.some((n) => n.body.startsWith("An anonymous donor has committed"))).toBe(true);
  });
});

describe("Only an AUTHORIZED ADMIN → ALLOWED", () => {
  it("an admin WITHOUT VIEW_PRIVATE_IDENTITY is denied", async () => {
    const r = await call(donationIdentity.GET, { token: f.moderator.token, params: { id: donationId } });
    expect(r.status).toBe(403);
    expect(leaks(r.text, [...donorSecrets(), ...recipientSecrets()])).toEqual([]);
  });

  it("the admin 'public view' of a donation shows references only", async () => {
    const r = await call(adminDonation.GET, { token: f.moderator.token, params: { id: donationId } });
    expect(r.status).toBe(200);
    expect(leaks(r.text, [PII.donorA.name, PII.donorA.email, PII.orgB.legalName, PII.orgB.address])).toEqual([]);
    expect(r.json.data.donor.publicId).toBe(f.donorA.publicId);
  });

  it("the authorized admin resolves both identities and the access is audited", async () => {
    const before = await db.auditLog.count({ where: { action: "VIEW_PRIVATE_IDENTITY", actorId: f.identityAdmin.id } });
    const r = await call(donationIdentity.GET, { token: f.identityAdmin.token, params: { id: donationId }, headers: { "x-forwarded-for": "203.0.113.9" } });
    expect(r.status).toBe(200);
    expect(r.json.data.donor).toMatchObject({ name: PII.donorA.name, email: PII.donorA.email, phone: PII.donorA.phone });
    expect(r.json.data.recipient).toMatchObject({ organization: PII.orgB.legalName, contactPerson: PII.orgB.contact, address: PII.orgB.address });
    const logs = await db.auditLog.findMany({ where: { action: "VIEW_PRIVATE_IDENTITY", actorId: f.identityAdmin.id } });
    expect(logs.length).toBe(before + 1);
    const log = logs.at(-1)!;
    expect(log.targetId).toBe(donationPublicId);
    expect(log.ipEnc).toBeTruthy();
    expect(log.ipEnc).not.toContain("203.0.113.9"); // IP stored encrypted
  });

  it("super admins are also allowed", async () => {
    expect((await call(donationIdentity.GET, { token: f.superAdmin.token, params: { id: donationId } })).status).toBe(200);
  });
});

describe("Data at rest", () => {
  it("PII columns are encrypted in the database", async () => {
    const rows = await db.$queryRawUnsafe<{ t: string }[]>(
      `SELECT row_to_json(p)::text AS t FROM private_profiles p UNION ALL SELECT row_to_json(o)::text FROM organization_private o UNION ALL SELECT row_to_json(d)::text FROM delivery_private d`,
    );
    const dump = rows.map((r) => r.t).join("\n");
    expect(leaks(dump, [PII.donorA.name, PII.donorA.phone, PII.orgB.legalName, PII.orgB.address, PII.orgB.contact, "Demo pickup street 9"])).toEqual([]);
  });

  it("public tables contain no PII", async () => {
    const rows = await db.$queryRawUnsafe<{ t: string }[]>(
      `SELECT row_to_json(r)::text AS t FROM requests r UNION ALL SELECT row_to_json(o)::text FROM organizations o UNION ALL SELECT row_to_json(n)::text FROM notifications n`,
    );
    expect(leaks(rows.map((r) => r.t).join("\n"), [...donorSecrets().slice(0, 3), ...recipientSecrets().slice(0, 5)])).toEqual([]);
  });

  it("delivery packets are split per leg: no single view links donor and recipient locations", async () => {
    const delivery = await db.delivery.findUniqueOrThrow({ where: { donationId } });
    const denied = await call(deliveryPacket.GET, { token: f.moderator.token, params: { id: delivery.id } });
    expect(denied.status).toBe(403);
    const names = [PII.donorA.name, PII.donorA.email, PII.orgB.legalName, PII.orgB.contact, PII.orgB.email];
    const pickup = await call(deliveryPacket.GET, { token: f.identityAdmin.token, params: { id: delivery.id }, path: `/api/x?leg=pickup` });
    expect(pickup.status).toBe(200);
    expect(pickup.text).toContain("Demo pickup street 9");
    expect(leaks(pickup.text, [...names, PII.orgB.address, PII.orgB.phone])).toEqual([]);
    const drop = await call(deliveryPacket.GET, { token: f.identityAdmin.token, params: { id: delivery.id }, path: `/api/x?leg=dropoff` });
    expect(drop.text).toContain(PII.orgB.address);
    expect(leaks(drop.text, [...names, "Demo pickup street 9", PII.donorA.phone])).toEqual([]);
  });

  it("the admin users table masks emails even for identity-permitted admins", async () => {
    const r = await call(adminUsers.GET, { token: f.identityAdmin.token, path: "/api/admin/users" });
    expect(r.status).toBe(200);
    expect(leaks(r.text, [PII.donorA.email, PII.orgB.email, PII.donorA.name])).toEqual([]);
  });

  it("an admin WITHOUT identity permission cannot look a donor up by email (no back-door linkage)", async () => {
    const userAdmin = await user("users-only@admin.test", "User Admin", "ADMIN", ["USER_MANAGEMENT", "DONATION_MANAGEMENT"]);
    const search = await call(adminUsers.GET, { token: userAdmin.token, path: `/api/admin/users?q=${encodeURIComponent(PII.donorA.email)}` });
    expect(search.status).toBe(200);
    expect(search.json.data.rows).toEqual([]);
    const all = await call(adminUsers.GET, { token: userAdmin.token, path: "/api/admin/users" });
    expect(all.json.data.rows.every((u: { emailMasked: string | null }) => u.emailMasked === null)).toBe(true);
    // The identity-permitted admin can search by email.
    const allowed = await call(adminUsers.GET, { token: f.identityAdmin.token, path: `/api/admin/users?q=${encodeURIComponent(PII.donorA.email)}` });
    expect(allowed.json.data.rows.map((u: { publicId: string }) => u.publicId)).toEqual([f.donorA.publicId]);
  });

  it("identity-access audit records do not store the donor↔recipient pair", async () => {
    const logs = await db.auditLog.findMany({ where: { action: "VIEW_PRIVATE_IDENTITY", targetType: "donation" } });
    expect(logs.length).toBeGreaterThan(0);
    expect(leaks(JSON.stringify(logs.map((l) => l.metadata)), [f.donorA.publicId, f.recipientB.org.publicId])).toEqual([]);
  });
});
