/**
 * Security tests:
 *  - Normal users cannot access admin APIs
 *  - Users cannot modify roles
 *  - Users cannot access other users' private data
 *  - Client-supplied role information is never trusted
 *  - CSRF, signed documents, suspended accounts
 */
import { beforeAll, describe, expect, it } from "vitest";
import { call } from "../helpers/http";
import { db, makeFixtures, type Fixtures } from "../helpers/fixtures";

import * as register from "@/app/api/auth/register/route";
import * as login from "@/app/api/auth/login/route";
import * as donationsRoute from "@/app/api/donations/route";
import * as myDonation from "@/app/api/my-donations/[id]/route";
import * as myRequest from "@/app/api/my-requests/[id]/route";
import * as requestsRoute from "@/app/api/requests/route";
import * as receive from "@/app/api/recipient/donations/[id]/receive/route";
import * as notifications from "@/app/api/notifications/route";
import * as adminStats from "@/app/api/admin/stats/route";
import * as adminAnalytics from "@/app/api/admin/analytics/route";
import * as adminUsers from "@/app/api/admin/users/route";
import * as adminUser from "@/app/api/admin/users/[id]/route";
import * as adminRequests from "@/app/api/admin/requests/route";
import * as adminRequest from "@/app/api/admin/requests/[id]/route";
import * as adminDonations from "@/app/api/admin/donations/route";
import * as adminVerifications from "@/app/api/admin/verifications/route";
import * as adminDeliveries from "@/app/api/admin/deliveries/route";
import * as adminAudit from "@/app/api/admin/audit/route";
import * as adminSettings from "@/app/api/admin/settings/route";
import * as adminCategories from "@/app/api/admin/categories/route";
import * as adminExport from "@/app/api/admin/export/route";
import * as adminReports from "@/app/api/admin/reports/route";
import * as adminDocument from "@/app/api/admin/documents/[id]/route";

let f: Fixtures;
let donationPublicId: string;

beforeAll(async () => {
  f = await makeFixtures();
  const r = await call(donationsRoute.POST, {
    token: f.donorA.token,
    body: { requestId: f.request.publicId, items: [{ requestItemId: f.request.items[1]!.id, quantity: 5 }], deliveryMethod: "PARTNER_DROPOFF", anonymousAcknowledged: true },
  });
  donationPublicId = r.json.data.id;
});

const ADMIN_GETS = [
  ["stats", adminStats.GET],
  ["analytics", adminAnalytics.GET],
  ["users", adminUsers.GET],
  ["requests", adminRequests.GET],
  ["donations", adminDonations.GET],
  ["verifications", adminVerifications.GET],
  ["deliveries", adminDeliveries.GET],
  ["audit", adminAudit.GET],
  ["settings", adminSettings.GET],
  ["categories", adminCategories.GET],
  ["export", adminExport.GET],
  ["reports", adminReports.GET],
] as const;

describe("normal users cannot access admin APIs", () => {
  it.each(ADMIN_GETS)("anonymous → 401 on /api/admin/%s", async (_name, handler) => {
    expect((await call(handler as never, { path: "/api/admin/x" })).status).toBe(401);
  });
  it.each(ADMIN_GETS)("donor → 403 on /api/admin/%s", async (_name, handler) => {
    expect((await call(handler as never, { token: f.donorA.token, path: "/api/admin/x" })).status).toBe(403);
  });
  it.each(ADMIN_GETS)("recipient → 403 on /api/admin/%s", async (_name, handler) => {
    expect((await call(handler as never, { token: f.recipientB.token, path: "/api/admin/x" })).status).toBe(403);
  });

  it("ignores client-supplied role claims (headers, cookies, body)", async () => {
    const r = await call(adminUsers.GET, {
      path: "/api/admin/users?role=ADMIN",
      headers: { cookie: `sb_session=${f.donorA.token}; role=ADMIN; isAdmin=true`, "x-role": "SUPER_ADMIN", "x-user-role": "ADMIN" },
    });
    expect(r.status).toBe(403);
  });

  it("enforces per-permission access between admins (moderator lacks AUDIT_LOG_VIEW / USER_MANAGEMENT)", async () => {
    expect((await call(adminAudit.GET, { token: f.moderator.token, path: "/api/admin/audit" })).status).toBe(403);
    expect((await call(adminUsers.GET, { token: f.moderator.token, path: "/api/admin/users" })).status).toBe(403);
    expect((await call(adminRequests.GET, { token: f.moderator.token, path: "/api/admin/requests" })).status).toBe(200);
  });
});

describe("users cannot modify roles", () => {
  it("self-registration as ADMIN is rejected", async () => {
    const r = await call(register.POST, { body: { role: "ADMIN", fullName: "Eve", email: "eve@x.test", password: "longpassword1", acceptTerms: true } });
    expect(r.status).toBe(422);
    expect(await db.user.count({ where: { email: "eve@x.test" } })).toBe(0);
  });

  it("extra fields like role/permissions in a donor registration are ignored", async () => {
    const r = await call(register.POST, {
      body: { role: "DONOR", fullName: "Mallory", email: "mallory@x.test", password: "longpassword1", acceptTerms: true, permissions: ["VIEW_PRIVATE_IDENTITY"], isAdmin: true },
    });
    expect(r.status).toBe(201);
    const u = await db.user.findUniqueOrThrow({ where: { email: "mallory@x.test" } });
    expect(u.role).toBe("DONOR");
    expect(u.permissions).toEqual([]);
  });

  it("donors and recipients cannot call the user-management API", async () => {
    for (const token of [f.donorA.token, f.recipientB.token]) {
      const r = await call(adminUser.PATCH, { token, method: "PATCH", params: { id: f.donorA.id }, body: { role: "SUPER_ADMIN" } });
      expect(r.status).toBe(403);
    }
    expect((await db.user.findUniqueOrThrow({ where: { id: f.donorA.id } })).role).toBe("DONOR");
  });

  it("a regular admin cannot promote anyone to admin, or change their own role", async () => {
    const promote = await call(adminUser.PATCH, { token: f.identityAdmin.token, method: "PATCH", params: { id: f.donorB.id }, body: { role: "ADMIN" } });
    expect(promote.status).toBe(403);
    const self = await call(adminUser.PATCH, { token: f.identityAdmin.token, method: "PATCH", params: { id: f.identityAdmin.id }, body: { status: "ACTIVE" } });
    expect(self.status).toBe(403);
    const otherAdmin = await call(adminUser.PATCH, { token: f.identityAdmin.token, method: "PATCH", params: { id: f.moderator.id }, body: { status: "SUSPENDED" } });
    expect(otherAdmin.status).toBe(403);
  });

  it("a super admin can, and the change is audited", async () => {
    const r = await call(adminUser.PATCH, { token: f.superAdmin.token, method: "PATCH", params: { id: f.moderator.id }, body: { permissions: ["REQUEST_REVIEW", "ADMIN_MANAGEMENT"] } });
    expect(r.status).toBe(200);
    // super-admin-only permissions can never be granted to an ADMIN
    expect((await db.user.findUniqueOrThrow({ where: { id: f.moderator.id } })).permissions).toEqual(["REQUEST_REVIEW"]);
    expect(await db.auditLog.count({ where: { action: "USER_PERMISSIONS_CHANGED" } })).toBe(1);
  });
});

describe("users cannot access other users' private data", () => {
  it("donor B cannot read or modify donor A's donation (404, no existence leak)", async () => {
    expect((await call(myDonation.GET, { token: f.donorB.token, params: { id: donationPublicId } })).status).toBe(404);
    const patch = await call(myDonation.PATCH, { token: f.donorB.token, method: "PATCH", params: { id: donationPublicId }, body: { action: "CANCEL" } });
    expect(patch.status).toBe(404);
  });

  it("recipient C cannot read recipient B's request or confirm its donations", async () => {
    expect((await call(myRequest.GET, { token: f.recipientC.token, params: { id: f.request.publicId } })).status).toBe(404);
    expect((await call(receive.POST, { token: f.recipientC.token, params: { id: donationPublicId }, body: {} })).status).toBe(404);
  });

  it("notifications are scoped to the caller", async () => {
    const a = await call(notifications.GET, { token: f.donorA.token });
    const b = await call(notifications.GET, { token: f.donorB.token });
    expect(a.json.data.items.length).toBeGreaterThan(0);
    expect(b.json.data.items).toEqual([]);
    const ids = a.json.data.items.map((n: { id: string }) => n.id);
    await call(notifications.PATCH, { token: f.donorB.token, method: "PATCH", body: { ids } });
    expect(await db.notification.count({ where: { id: { in: ids }, readAt: { not: null } } })).toBe(0);
  });

  it("role-restricted mutations reject the wrong role", async () => {
    const asRecipient = await call(donationsRoute.POST, { token: f.recipientB.token, body: {} });
    expect(asRecipient.status).toBe(403);
    const asDonor = await call(requestsRoute.POST, { token: f.donorA.token, body: {} });
    expect(asDonor.status).toBe(403);
  });
});

describe("transport & session protections", () => {
  it("rejects cross-site mutations (CSRF)", async () => {
    const r = await call(donationsRoute.POST, { token: f.donorA.token, headers: { origin: "https://evil.example" }, body: {} });
    expect(r.status).toBe(403);
    const r2 = await call(donationsRoute.POST, { token: f.donorA.token, headers: { "sec-fetch-site": "cross-site" }, body: {} });
    expect(r2.status).toBe(403);
  });

  it("login errors are generic (no account enumeration)", async () => {
    const unknown = await call(login.POST, { body: { email: "nobody@x.test", password: "whatever123" } });
    const wrong = await call(login.POST, { body: { email: "zarina.donor@leaktest.example", password: "whatever123" } });
    expect(unknown.status).toBe(401);
    expect(wrong.status).toBe(401);
    expect(unknown.json.error.message).toBe(wrong.json.error.message);
  });

  it("suspended accounts lose access immediately", async () => {
    await call(adminUser.PATCH, { token: f.superAdmin.token, method: "PATCH", params: { id: f.donorB.id }, body: { status: "SUSPENDED" } });
    expect((await call(notifications.GET, { token: f.donorB.token })).status).toBe(401);
  });

  it("errors never expose stack traces", async () => {
    const r = await call(donationsRoute.POST, { token: f.donorA.token, headers: { "content-type": "application/json" }, body: undefined, method: "POST" });
    expect(r.text).not.toMatch(/at .*\.ts:\d+|PrismaClient|node_modules/);
  });

  it("verification documents require a valid signature AND permission", async () => {
    const doc = await db.verificationDocument.create({
      data: { organizationId: f.recipientB.org.id, kind: "REGISTRATION_CERTIFICATE", storageKey: "abcdefghijklmnopqrstuvwxyz012345.pdf", originalNameEnc: "x", mimeType: "application/pdf", sizeBytes: 1, sha256: "x" },
    });
    const forged = await call(adminDocument.GET, { token: f.identityAdmin.token, params: { id: doc.id }, path: `/api/admin/documents/${doc.id}?exp=9999999999&sig=forged` });
    expect(forged.status).toBe(403);
    const asDonor = await call(adminDocument.GET, { token: f.donorA.token, params: { id: doc.id } });
    expect(asDonor.status).toBe(403);
  });
});

describe("admin request moderation authorization", () => {
  it("only REQUEST_REVIEW holders can decide", async () => {
    const pending = await db.request.create({
      data: { publicId: "NR-PENDNG", organizationId: f.recipientB.org.id, categoryId: f.education.id, title: "Pending request title", description: "x".repeat(40), district: "Ernakulam", status: "PENDING_VERIFICATION", items: { create: { name: "Pen", quantityRequired: 5 } } },
    });
    const donorTry = await call(adminRequest.PATCH, { token: f.donorA.token, method: "PATCH", params: { id: pending.id }, body: { decision: "APPROVE" } });
    expect(donorTry.status).toBe(403);
    const ok = await call(adminRequest.PATCH, { token: f.moderator.token, method: "PATCH", params: { id: pending.id }, body: { decision: "APPROVE", priority: "HIGH" } });
    expect(ok.status).toBe(200);
    expect((await db.request.findUniqueOrThrow({ where: { id: pending.id } })).status).toBe("ACTIVE");
  });
});
