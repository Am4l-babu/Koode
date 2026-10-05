/**
 * Development / demo seed.
 *
 * Run: npm run db:seed
 * Credentials come from environment variables — nothing is hard-coded:
 *   ADMIN_EMAIL / ADMIN_PASSWORD   → super admin
 *   DEMO_PASSWORD                  → password for demo donor/recipient/admin accounts
 * Refuses to run in production unless ALLOW_PRODUCTION_SEED=true.
 */
import { PrismaClient, type DonationStatus, type OrganizationType, type Priority } from "@prisma/client";
import { encrypt } from "@/lib/crypto";
import { hashPassword } from "@/lib/auth/password";
import { generatePublicId } from "@/lib/ids";
import { DEFAULT_CATEGORIES, parseAgeRange } from "@/lib/categories";
import { ORG_DESCRIPTORS } from "@/lib/descriptors";
import { DEFAULT_ADMIN_PERMISSIONS } from "@/lib/permissions";
import { requestPercent } from "@/lib/fulfillment";

const db = new PrismaClient();

if (process.env.NODE_ENV === "production" && process.env.ALLOW_PRODUCTION_SEED !== "true") {
  console.error("Refusing to seed demo data in production.");
  process.exit(1);
}

const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const DEMO_PASSWORD = process.env.DEMO_PASSWORD || ADMIN_PASSWORD;
if (!ADMIN_EMAIL || !ADMIN_PASSWORD || !DEMO_PASSWORD) {
  console.error("Set ADMIN_EMAIL and ADMIN_PASSWORD (and optionally DEMO_PASSWORD) before seeding.");
  process.exit(1);
}

const DAY = 86_400_000;
const daysFromNow = (n: number) => new Date(Date.now() + n * DAY);

async function reset() {
  // Order respects foreign keys.
  await db.$executeRawUnsafe(`TRUNCATE "audit_logs","notifications","reports","delivery_private","deliveries","donation_events","donation_items","donations","request_items","requests","verification_documents","verifications","organization_private","organizations","donor_profiles","private_profiles","auth_tokens","sessions","users","categories","platform_settings" CASCADE`);
}

async function createUser(opts: {
  email: string;
  name: string;
  role: "DONOR" | "RECIPIENT" | "ADMIN" | "SUPER_ADMIN";
  password: string;
  phone?: string;
  permissions?: (typeof DEFAULT_ADMIN_PERMISSIONS)[number][];
  createdAt?: Date;
}) {
  const kind = opts.role === "RECIPIENT" ? "recipient" : opts.role === "DONOR" ? "donor" : "admin";
  return db.user.create({
    data: {
      publicId: generatePublicId(kind),
      email: opts.email,
      emailVerifiedAt: new Date(),
      passwordHash: await hashPassword(opts.password),
      role: opts.role,
      permissions: opts.permissions ?? [],
      createdAt: opts.createdAt,
      private: { create: { fullNameEnc: encrypt(opts.name), phoneEnc: opts.phone ? encrypt(opts.phone) : null, phoneVerifiedAt: opts.phone ? new Date() : null } },
      ...(opts.role === "DONOR" ? { donorProfile: { create: {} } } : {}),
    },
  });
}

async function createOrg(opts: {
  email: string;
  contact: string;
  legalName: string;
  orgType: OrganizationType;
  district: string;
  city: string;
  focusArea: string;
  verified: boolean;
  phone: string;
  address: string;
  pin: string;
}) {
  const user = await createUser({ email: opts.email, name: opts.contact, role: "RECIPIENT", password: DEMO_PASSWORD!, phone: opts.phone });
  const org = await db.recipientOrganization.create({
    data: {
      publicId: user.publicId,
      userId: user.id,
      orgType: opts.orgType,
      publicDescriptor: ORG_DESCRIPTORS[opts.orgType],
      focusArea: opts.focusArea,
      district: opts.district,
      city: opts.city,
      verificationStatus: opts.verified ? "VERIFIED" : "PENDING",
      verifiedAt: opts.verified ? daysFromNow(-40) : null,
      private: {
        create: {
          legalNameEnc: encrypt(opts.legalName),
          contactPersonEnc: encrypt(opts.contact),
          phoneEnc: encrypt(opts.phone),
          addressEnc: encrypt(opts.address),
          pinCodeEnc: encrypt(opts.pin),
          registrationNumberEnc: encrypt(`KL/${opts.district.slice(0, 3).toUpperCase()}/${Math.floor(Math.random() * 9000 + 1000)}/2019`),
        },
      },
      verifications: {
        create: {
          status: opts.verified ? "VERIFIED" : "PENDING",
          checklist: opts.verified ? { registration: true, contactPerson: true, location: true, documents: true, proofOfNeed: true, previousActivity: true } : {},
          reviewedAt: opts.verified ? daysFromNow(-40) : null,
          applicantNote: opts.verified ? null : "Registered trust running an after-school programme. Documents attached.",
        },
      },
    },
  });
  return { user, org };
}

interface SeedItem {
  name: string;
  quantity: number;
  committed?: number;
  unit?: string;
  value?: number;
  attributes?: Record<string, string>;
}

async function createRequest(opts: {
  orgId: string;
  category: string;
  title: string;
  description: string;
  priority: Priority;
  district: string;
  city?: string;
  neededInDays?: number;
  people?: number;
  items: SeedItem[];
  status?: "ACTIVE" | "PENDING_VERIFICATION" | "NEEDS_INFO";
  createdDaysAgo?: number;
  recurrence?: "NONE" | "MONTHLY";
}) {
  const category = await db.category.findUniqueOrThrow({ where: { slug: opts.category } });
  const createdAt = daysFromNow(-(opts.createdDaysAgo ?? 10));
  const status = opts.status ?? "ACTIVE";
  return db.request.create({
    data: {
      publicId: generatePublicId("request"),
      organizationId: opts.orgId,
      categoryId: category.id,
      title: opts.title,
      description: opts.description,
      status,
      priority: opts.priority,
      priorityScore: { CRITICAL: 80, HIGH: 60, MEDIUM: 40, NORMAL: 20 }[opts.priority],
      peopleAffected: opts.people ?? null,
      neededBy: opts.neededInDays ? daysFromNow(opts.neededInDays) : null,
      district: opts.district,
      city: opts.city ?? null,
      recurrence: opts.recurrence ?? "NONE",
      approvedAt: status === "ACTIVE" ? daysFromNow(-(opts.createdDaysAgo ?? 10) + 1) : null,
      createdAt,
      popularity: Math.floor(Math.random() * 60),
      items: {
        create: opts.items.map((i, idx) => {
          const age = parseAgeRange(i.attributes?.ageGroup ?? i.attributes?.ageRange);
          return {
            name: i.name,
            unit: i.unit ?? "pcs",
            quantityRequired: i.quantity,
            estimatedUnitValue: i.value ?? null,
            attributes: i.attributes ?? {},
            ageMin: age?.min ?? null,
            ageMax: age?.max ?? null,
            sortOrder: idx,
          };
        }),
      },
    },
    include: { items: true },
  });
}

async function seedDonation(opts: {
  donorId: string;
  request: Awaited<ReturnType<typeof createRequest>>;
  itemName: string;
  quantity: number;
  status: DonationStatus;
  daysAgo: number;
  method?: "PLATFORM_PICKUP" | "PARTNER_DROPOFF" | "DELIVERY";
}) {
  const item = opts.request.items.find((i) => i.name === opts.itemName)!;
  const createdAt = daysFromNow(-opts.daysAgo);
  const flow: DonationStatus[] = ["CREATED", "CONFIRMED", "PREPARING", "IN_TRANSIT", "RECEIVED", "COMPLETED"];
  const reached = flow.slice(0, flow.indexOf(opts.status) + 1);
  const received = flow.indexOf(opts.status) >= flow.indexOf("RECEIVED");
  await db.donation.create({
    data: {
      publicId: generatePublicId("donation"),
      donorId: opts.donorId,
      requestId: opts.request.id,
      organizationId: opts.request.organizationId,
      status: opts.status,
      deliveryMethod: opts.method ?? "PLATFORM_PICKUP",
      estimatedValue: item.estimatedUnitValue ? item.estimatedUnitValue * opts.quantity : null,
      expectedBy: new Date(createdAt.getTime() + 7 * DAY),
      createdAt,
      items: { create: { requestItemId: item.id, quantity: opts.quantity } },
      events: {
        create: reached.map((s, i) => ({
          status: s,
          actorRole: s === "RECEIVED" ? "RECIPIENT" : s === "PREPARING" || s === "CREATED" ? "DONOR" : "ADMIN",
          createdAt: new Date(createdAt.getTime() + i * 0.8 * DAY),
        })),
      },
      delivery: {
        create: {
          status: received ? "DELIVERED" : opts.status === "IN_TRANSIT" ? "PICKED_UP" : "UNASSIGNED",
          deliveredAt: received ? new Date(createdAt.getTime() + 4 * DAY) : null,
          assigneeLabel: received ? "Volunteer team V-12" : null,
          private: { create: { pickupAddressEnc: encrypt("Demo pickup address, Kerala") } },
        },
      },
    },
  });
  await db.requestItem.update({
    where: { id: item.id },
    data: { quantityCommitted: { increment: opts.quantity }, quantityReceived: received ? { increment: opts.quantity } : undefined },
  });
}

async function refresh(requestId: string) {
  const items = await db.requestItem.findMany({ where: { requestId } });
  const remaining = items.reduce((s, i) => s + i.quantityRequired - i.quantityCommitted, 0);
  await db.request.update({
    where: { id: requestId },
    data: { percentFulfilled: requestPercent(items), quantityRemaining: remaining, ...(remaining === 0 ? { status: "FULFILLED", fulfilledAt: new Date() } : {}) },
  });
}

async function main() {
  console.log("Resetting demo data…");
  await reset();

  for (const c of DEFAULT_CATEGORIES) {
    await db.category.create({ data: { slug: c.slug, name: c.name, icon: c.icon, description: c.description, sortOrder: c.sortOrder, fieldSchema: c.fieldSchema } });
  }

  // ── Admins ──
  const superAdmin = await createUser({ email: ADMIN_EMAIL!.toLowerCase(), name: "Platform Super Admin", role: "SUPER_ADMIN", password: ADMIN_PASSWORD! });
  await createUser({
    email: "ops.admin@sahaya.local",
    name: "Operations Admin",
    role: "ADMIN",
    password: DEMO_PASSWORD!,
    permissions: [...DEFAULT_ADMIN_PERMISSIONS, "VIEW_PRIVATE_IDENTITY", "AUDIT_LOG_VIEW"],
  });
  await createUser({
    email: "moderator@sahaya.local",
    name: "Content Moderator",
    role: "ADMIN",
    password: DEMO_PASSWORD!,
    permissions: ["REQUEST_REVIEW", "VERIFICATION_REVIEW", "DONATION_MANAGEMENT", "ANALYTICS_VIEW"],
  });

  // ── Donors ──
  const donor = await createUser({ email: "donor@demo.local", name: "Anjali Menon", role: "DONOR", password: DEMO_PASSWORD!, phone: "+919847000001" });
  const donors = [donor];
  const names = ["Rahul Nair", "Fathima Beevi", "Joseph Mathew", "Lakshmi Pillai", "Arjun Das", "Meera Krishnan", "Thomas Varghese", "Sneha Raj"];
  for (let i = 0; i < names.length; i++) {
    donors.push(await createUser({ email: `donor${i + 2}@demo.local`, name: names[i]!, role: "DONOR", password: DEMO_PASSWORD!, createdAt: daysFromNow(-(150 - i * 15)) }));
  }

  // ── Recipient organisations ──
  const learning = await createOrg({
    email: "learning@demo.local", contact: "Sister Mary Thomas", legalName: "St. Alphonsa Learning Centre Trust", orgType: "SCHOOL",
    district: "Thrissur", city: "Chalakudy", focusArea: "Children's Education", verified: true, phone: "+919847100001",
    address: "Near Railway Station Road, Chalakudy", pin: "680307",
  });
  const childrenHome = await createOrg({
    email: "childrenhome@demo.local", contact: "Mr. Abdul Rasheed", legalName: "Nanma Children's Home Society", orgType: "ORPHANAGE",
    district: "Ernakulam", city: "Kochi", focusArea: "Child Welfare", verified: true, phone: "+919847100002",
    address: "Palarivattom, Kochi", pin: "682025",
  });
  const elder = await createOrg({
    email: "eldercare@demo.local", contact: "Ms. Geetha Kumari", legalName: "Snehatheeram Old Age Home", orgType: "OLD_AGE_HOME",
    district: "Palakkad", city: "Ottapalam", focusArea: "Elder Care", verified: true, phone: "+919847100003",
    address: "Temple Road, Ottapalam", pin: "679101",
  });
  const play = await createOrg({
    email: "playschool@demo.local", contact: "Mrs. Bindu Joseph", legalName: "Kunjikkuruvi Play School", orgType: "PLAY_SCHOOL",
    district: "Ernakulam", city: "Kochi", focusArea: "Early Childhood", verified: true, phone: "+919847100004",
    address: "Edappally, Kochi", pin: "682024",
  });
  const community = await createOrg({
    email: "community@demo.local", contact: "Mr. Suresh Babu", legalName: "Janasevana Community Kitchen", orgType: "COMMUNITY_ORGANIZATION",
    district: "Kozhikode", city: "Vadakara", focusArea: "Food Security", verified: true, phone: "+919847100005",
    address: "Market Road, Vadakara", pin: "673101",
  });
  const pending = await createOrg({
    email: "pending@demo.local", contact: "Mr. Varun Pillai", legalName: "Prathyasha Tuition Collective", orgType: "NGO",
    district: "Kollam", city: "Karunagappally", focusArea: "After-school learning", verified: false, phone: "+919847100006",
    address: "Beach Road, Karunagappally", pin: "690518",
  });

  // ── Requests (from the brief's demo data) ──
  const r1 = await createRequest({
    orgId: learning.org.id, category: "education", title: "School Bags for the New Academic Year", priority: "HIGH",
    district: "Thrissur", city: "Chalakudy", neededInDays: 15, people: 40, createdDaysAgo: 25,
    description: "These bags are intended for children who are beginning the new academic year and currently do not have suitable school bags. Sturdy bags with two compartments work best.",
    items: [
      { name: "School bag", quantity: 40, value: 600, attributes: { ageGroup: "8–12", condition: "New or excellent", specification: "Two compartments" } },
      { name: "Notebook", quantity: 100, value: 45, attributes: { ageGroup: "8–12", specification: "200 pages, ruled", condition: "New" } },
      { name: "Geometry kit", quantity: 20, value: 120, attributes: { ageGroup: "10–12", condition: "New" } },
    ],
  });
  const r2 = await createRequest({
    orgId: childrenHome.org.id, category: "clothing", title: "Children's Shirts for Daily Wear", priority: "MEDIUM",
    district: "Ernakulam", city: "Kochi", neededInDays: 30, people: 25, createdDaysAgo: 18,
    description: "Comfortable cotton shirts for children at a residential home. Boys and girls aged 8–10; sizes 28, 30 and 32 are most needed.",
    items: [{ name: "Children's shirt", quantity: 25, value: 350, attributes: { size: "28, 30, 32", ageGroup: "8–10", gender: "Any", condition: "New or excellent", colour: "Any" } }],
  });
  const r3 = await createRequest({
    orgId: elder.org.id, category: "elder-care", title: "Warm Blankets for the Monsoon", priority: "HIGH",
    district: "Palakkad", city: "Ottapalam", neededInDays: 10, people: 15, createdDaysAgo: 12,
    description: "Residents need warm, washable blankets for the cooler monsoon nights. Single-bed size, medium weight, easy to wash and dry.",
    items: [{ name: "Warm blanket", quantity: 15, value: 700, attributes: { size: "Single", condition: "New", notes: "Washable" } }],
  });
  const r4 = await createRequest({
    orgId: play.org.id, category: "children", title: "Educational Toys for the Play Corner", priority: "NORMAL",
    district: "Ernakulam", city: "Kochi", neededInDays: 45, people: 30, createdDaysAgo: 6,
    description: "Our play corner needs educational toys that build early motor and counting skills. Durable, child-safe toys for ages 5 to 8.",
    items: [
      { name: "Educational toy", quantity: 20, value: 400, attributes: { ageRange: "5–8", purpose: "Educational", condition: "New or excellent", safetyNotes: "No small parts" } },
      { name: "Picture book", quantity: 30, value: 150, attributes: { ageRange: "5–8", purpose: "Educational", condition: "Good" } },
    ],
  });
  const r5 = await createRequest({
    orgId: community.org.id, category: "food", title: "Monthly Rice & Groceries for the Community Kitchen", priority: "CRITICAL",
    district: "Kozhikode", city: "Vadakara", neededInDays: 5, people: 120, createdDaysAgo: 4, recurrence: "MONTHLY",
    description: "The community kitchen serves daily lunches to elderly residents and daily-wage workers. Rice and dal stocks run out before month end.",
    items: [
      { name: "Rice", quantity: 50, unit: "kg", value: 55, attributes: { weight: "5 kg bags", packaging: "Sealed bags", expiry: "At least 3 months", dietary: "Vegetarian" } },
      { name: "Toor dal", quantity: 20, unit: "kg", value: 140, attributes: { weight: "1 kg packs", expiry: "At least 3 months", dietary: "Vegetarian" } },
    ],
  });
  const r6 = await createRequest({
    orgId: learning.org.id, category: "clothing", title: "School Uniforms for Grade 3 and 4", priority: "MEDIUM",
    district: "Thrissur", city: "Chalakudy", neededInDays: 20, people: 18, createdDaysAgo: 3,
    description: "Uniform sets for children starting in grades 3 and 4 whose families cannot purchase new uniforms this term.",
    items: [{ name: "Uniform set", quantity: 18, value: 650, attributes: { size: "26, 28", ageGroup: "8–10", gender: "Any", condition: "New", colour: "Blue and white" } }],
  });
  const r7 = await createRequest({
    orgId: elder.org.id, category: "elder-care", title: "Walking Aids for Residents", priority: "NORMAL",
    district: "Palakkad", city: "Ottapalam", neededInDays: 60, people: 8, createdDaysAgo: 30,
    description: "Several residents need sturdy walking sticks and one adjustable walker to move around safely within the home.",
    items: [
      { name: "Walking stick", quantity: 6, value: 450, attributes: { condition: "New or excellent", notes: "Adjustable height" } },
      { name: "Walker", quantity: 2, value: 2200, attributes: { condition: "New or excellent", notes: "Foldable" } },
    ],
  });
  const r8 = await createRequest({
    orgId: childrenHome.org.id, category: "sports", title: "Football Kit for the Weekend Club", priority: "NORMAL",
    district: "Ernakulam", city: "Kochi", neededInDays: 40, people: 22, createdDaysAgo: 2,
    description: "Children at the home started a weekend football club. Balls and shin guards would let everyone play together safely.",
    items: [
      { name: "Football", quantity: 4, value: 600, attributes: { ageGroup: "10–12", size: "Size 4", condition: "New" } },
      { name: "Shin guard pair", quantity: 22, value: 250, attributes: { ageGroup: "10–12", size: "Small", condition: "Good" } },
    ],
  });
  await createRequest({
    orgId: learning.org.id, category: "education", title: "Science Kits for the Lab Corner", priority: "MEDIUM",
    district: "Thrissur", city: "Chalakudy", neededInDays: 35, people: 60, createdDaysAgo: 1, status: "PENDING_VERIFICATION",
    description: "Basic science kits (magnets, lenses, circuits) so upper-primary students can do hands-on experiments in small groups.",
    items: [{ name: "Science kit", quantity: 12, value: 900, attributes: { ageGroup: "10–12", specification: "Magnets, lenses, simple circuits", condition: "New" } }],
  });
  await createRequest({
    orgId: pending.org.id, category: "education", title: "Notebooks for Evening Tuition Batch", priority: "NORMAL",
    district: "Kollam", city: "Karunagappally", neededInDays: 25, people: 35, createdDaysAgo: 1, status: "PENDING_VERIFICATION",
    description: "Ruled notebooks for students who attend the free evening tuition batch and currently share books between siblings.",
    items: [{ name: "Notebook", quantity: 70, value: 45, attributes: { ageGroup: "10–12", specification: "172 pages", condition: "New" } }],
  });

  // ── Donations (spread across months for analytics) ──
  const pick = (i: number) => donors[i % donors.length]!.id;
  await seedDonation({ donorId: donor.id, request: r1, itemName: "School bag", quantity: 2, status: "IN_TRANSIT", daysAgo: 4 });
  await seedDonation({ donorId: pick(1), request: r1, itemName: "School bag", quantity: 10, status: "COMPLETED", daysAgo: 20 });
  await seedDonation({ donorId: pick(2), request: r1, itemName: "School bag", quantity: 16, status: "RECEIVED", daysAgo: 15 });
  await seedDonation({ donorId: pick(3), request: r1, itemName: "Notebook", quantity: 100, status: "COMPLETED", daysAgo: 22 });
  await seedDonation({ donorId: pick(4), request: r1, itemName: "Geometry kit", quantity: 8, status: "CONFIRMED", daysAgo: 2 });
  await seedDonation({ donorId: donor.id, request: r2, itemName: "Children's shirt", quantity: 3, status: "COMPLETED", daysAgo: 16 });
  await seedDonation({ donorId: pick(5), request: r2, itemName: "Children's shirt", quantity: 5, status: "PREPARING", daysAgo: 3 });
  await seedDonation({ donorId: pick(6), request: r3, itemName: "Warm blanket", quantity: 9, status: "RECEIVED", daysAgo: 9 });
  await seedDonation({ donorId: pick(7), request: r5, itemName: "Rice", quantity: 20, status: "CONFIRMED", daysAgo: 1, method: "PARTNER_DROPOFF" });
  await seedDonation({ donorId: pick(8), request: r7, itemName: "Walking stick", quantity: 6, status: "COMPLETED", daysAgo: 28 });
  await seedDonation({ donorId: pick(2), request: r7, itemName: "Walker", quantity: 2, status: "COMPLETED", daysAgo: 26 });
  await seedDonation({ donorId: pick(3), request: r8, itemName: "Football", quantity: 1, status: "CONFIRMED", daysAgo: 1 });
  await seedDonation({ donorId: donor.id, request: r4, itemName: "Picture book", quantity: 4, status: "COMPLETED", daysAgo: 70 });
  await seedDonation({ donorId: pick(4), request: r4, itemName: "Picture book", quantity: 6, status: "COMPLETED", daysAgo: 100 });
  await seedDonation({ donorId: pick(5), request: r4, itemName: "Educational toy", quantity: 3, status: "COMPLETED", daysAgo: 130 });
  for (const r of [r1, r2, r3, r4, r5, r6, r7, r8]) await refresh(r.id);

  await db.report.create({ data: { requestId: r6.id, reason: "DUPLICATE_REQUEST", details: "Looks similar to another uniform request I saw last month." } });
  await db.notification.createMany({
    data: [
      { userId: donor.id, type: "DONATION_STATUS", title: "Donation in transit", body: "Your donation is on its way to a verified learning center.", link: "/donor/donations" },
      { userId: learning.user.id, type: "DONATION_COMMITTED", title: "New anonymous donation", body: "An anonymous donor has committed 8 geometry kits to your request.", link: "/recipient/donations" },
    ],
  });
  await db.auditLog.create({ data: { actorId: superAdmin.id, actorLabel: `Super Admin #${superAdmin.publicId}`, action: "SEED", metadata: { note: "Demo data loaded" } } });

  console.log("\nSeed complete.");
  console.log(`  Super admin     : ${ADMIN_EMAIL}`);
  console.log("  Ops admin       : ops.admin@sahaya.local      (all admin perms incl. VIEW_PRIVATE_IDENTITY)");
  console.log("  Moderator       : moderator@sahaya.local      (no identity access)");
  console.log("  Donor           : donor@demo.local");
  console.log("  Recipient       : learning@demo.local  (verified)  ·  pending@demo.local (pending)");
  console.log("  Demo password   : value of DEMO_PASSWORD (or ADMIN_PASSWORD)\n");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
