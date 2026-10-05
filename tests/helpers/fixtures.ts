import type { Permission, Role } from "@prisma/client";
import { encrypt } from "@/lib/crypto";
import { hashPassword } from "@/lib/auth/password";
import { createSession } from "@/lib/auth/session";
import { generatePublicId } from "@/lib/ids";
import { DEFAULT_CATEGORIES } from "@/lib/categories";
import { db } from "@/lib/db";

export { db };

export const PASSWORD = "CorrectHorse42!";

/** Distinctive PII strings so leaks are easy to detect in any response body. */
export const PII = {
  donorA: { name: "Zarina Donorperson", email: "zarina.donor@leaktest.example", phone: "+919811100001" },
  donorB: { name: "Bruno Otherdonor", email: "bruno.donor@leaktest.example", phone: "+919811100002" },
  orgB: {
    legalName: "Secret Haven Orphanage Trust",
    contact: "Father Hidden Contact",
    phone: "+919822200002",
    address: "42 Confidential Lane, Hidden Nagar",
    pin: "680999",
    email: "haven.org@leaktest.example",
  },
  orgC: { legalName: "Private Elders Home Society", contact: "Madam Concealed", phone: "+919822200003", address: "7 Undisclosed Road", pin: "682999", email: "elders.org@leaktest.example" },
};

export async function resetDb() {
  await db.$executeRawUnsafe(
    `TRUNCATE "audit_logs","notifications","reports","delivery_private","deliveries","donation_events","donation_items","donations","request_items","requests","verification_documents","verifications","organization_private","organizations","donor_profiles","private_profiles","auth_tokens","sessions","users","categories","platform_settings" CASCADE`,
  );
}

export async function user(email: string, name: string, role: Role, permissions: Permission[] = [], phone?: string) {
  const kind = role === "RECIPIENT" ? "recipient" : role === "DONOR" ? "donor" : "admin";
  const u = await db.user.create({
    data: {
      publicId: generatePublicId(kind),
      email,
      emailVerifiedAt: new Date(),
      passwordHash: await hashPassword(PASSWORD),
      role,
      permissions,
      private: { create: { fullNameEnc: encrypt(name), phoneEnc: phone ? encrypt(phone) : null } },
      ...(role === "DONOR" ? { donorProfile: { create: {} } } : {}),
    },
  });
  const session = await createSession(u.id);
  return { ...u, token: session.token };
}

async function org(email: string, p: typeof PII.orgB, verified = true) {
  const u = await user(email, p.contact, "RECIPIENT", [], p.phone);
  const o = await db.recipientOrganization.create({
    data: {
      publicId: u.publicId,
      userId: u.id,
      orgType: "ORPHANAGE",
      publicDescriptor: "Verified Children's Center",
      district: "Ernakulam",
      city: "Kochi",
      verificationStatus: verified ? "VERIFIED" : "PENDING",
      verifiedAt: verified ? new Date() : null,
      private: { create: { legalNameEnc: encrypt(p.legalName), contactPersonEnc: encrypt(p.contact), phoneEnc: encrypt(p.phone), addressEnc: encrypt(p.address), pinCodeEnc: encrypt(p.pin) } },
      verifications: { create: { status: verified ? "VERIFIED" : "PENDING" } },
    },
  });
  return { user: u, org: o, token: u.token };
}

export async function activeRequest(organizationId: string, items: { name: string; quantity: number; committed?: number }[], categoryId: string) {
  const total = items.reduce((s, i) => s + i.quantity - (i.committed ?? 0), 0);
  return db.request.create({
    data: {
      publicId: generatePublicId("request"),
      organizationId,
      categoryId,
      title: "School bags for the new academic year",
      description: "These bags are intended for children beginning the academic year without suitable bags.",
      status: "ACTIVE",
      priority: "HIGH",
      district: "Ernakulam",
      city: "Kochi",
      approvedAt: new Date(),
      quantityRemaining: total,
      items: {
        create: items.map((i, idx) => ({ name: i.name, quantityRequired: i.quantity, quantityCommitted: i.committed ?? 0, estimatedUnitValue: 500, sortOrder: idx })),
      },
    },
    include: { items: true },
  });
}

export async function makeFixtures() {
  await resetDb();
  for (const c of DEFAULT_CATEGORIES) {
    await db.category.create({ data: { slug: c.slug, name: c.name, icon: c.icon, description: c.description, sortOrder: c.sortOrder, fieldSchema: c.fieldSchema } });
  }
  const education = await db.category.findUniqueOrThrow({ where: { slug: "education" } });
  const donorA = await user(PII.donorA.email, PII.donorA.name, "DONOR", [], PII.donorA.phone);
  const donorB = await user(PII.donorB.email, PII.donorB.name, "DONOR", [], PII.donorB.phone);
  const recipientB = await org(PII.orgB.email, PII.orgB);
  const recipientC = await org(PII.orgC.email, PII.orgC);
  const identityAdmin = await user("ops@admin.test", "Ops Admin", "ADMIN", ["VIEW_PRIVATE_IDENTITY", "DONATION_MANAGEMENT", "USER_MANAGEMENT", "REQUEST_REVIEW", "VERIFICATION_REVIEW", "DELIVERY_MANAGEMENT", "AUDIT_LOG_VIEW"]);
  const moderator = await user("mod@admin.test", "Moderator", "ADMIN", ["REQUEST_REVIEW", "DONATION_MANAGEMENT", "VERIFICATION_REVIEW"]);
  const superAdmin = await user("super@admin.test", "Super", "SUPER_ADMIN");
  const request = await activeRequest(recipientB.org.id, [{ name: "School bag", quantity: 10 }, { name: "Notebook", quantity: 50 }], education.id);
  return { education, donorA, donorB, recipientB, recipientC, identityAdmin, moderator, superAdmin, request };
}

export type Fixtures = Awaited<ReturnType<typeof makeFixtures>>;
