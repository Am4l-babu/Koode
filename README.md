# Koode

> **Give what is needed. Receive what is given. Keep identities private.**

### 👉 [**Try the interactive preview**](https://am4l-babu.github.io/Koode/)

[![Koode interactive preview: need cards with product details and a product-type filter, the donation form with condition, pack size, best-before date and photos, a courier donation in transit with DTDC tracking, and the admin product-type editor adding a Hearing aid type](docs/preview-koode.png)](https://am4l-babu.github.io/Koode/)

A click-through demo with sample data: search needs in plain language or narrow a category to one product type, make an anonymous donation — describing each item's condition, size or pack, with a description and photos — then send it by courier, add the tracking number and watch it travel. As an admin, add a product type (say *Medical support → Hearing aid*) with its own details and preview the form organisations will see. Switch between donor / recipient / moderator / admin to see the privacy rules in action, and flip dark mode or Malayalam / Hindi. It runs entirely in your browser — no real donations, and nothing you enter or attach leaves the page. Source: [`docs/index.html`](docs/index.html).

A privacy-first donation platform that connects people who want to donate specific items with **verified** schools, children's homes, elder-care homes, shelters and community organisations — without either side ever seeing the other's identity. The platform (and only authorised administrators) act as the trusted intermediary.

| | |
|---|---|
| **Stack** | Next.js 15 (App Router) · React 19 · TypeScript · Tailwind CSS 4 · Prisma 6 · PostgreSQL 16 |
| **Auth** | Database-backed sessions, Argon2id passwords, httpOnly `SameSite=Lax` cookies (`__Host-` + `Secure` in production) |
| **Tests** | 235 Vitest unit/integration/security tests · 23 Playwright E2E tests (desktop + mobile) |
| **i18n** | English · Malayalam · Hindi |

---

## Contents

1. [Features](#features)
2. [Privacy architecture](#privacy-architecture)
3. [Quick start](#quick-start)
4. [Demo accounts](#demo-accounts)
5. [Scripts](#scripts)
6. [Testing](#testing)
7. [Project structure](#project-structure)
8. [API overview](#api-overview)
9. [Deployment](#deployment)
10. [Configuration](#configuration)
11. [Known limitations & next steps](#known-limitations--next-steps)

---

## Features

**Donors** — browse/search/filter verified needs (natural-language search such as *"shirts size 30"*, *"food near Thrissur"*, *"toys for 5 year old children"*), **filter by product type** within a category (e.g. *Clothing → Footwear*, *Food → Rice* — only types with open needs are offered, with counts), guided 4-step anonymous donation modal, **per-item details** (condition for each item plus the product's own questions — actual size, pack size, best-before date, height…, with the recipient's requirement shown alongside), a description and **photos / a short video** of the items, **courier tracking** (pick from 14 courier services used in Kerala and enter the tracking number; the donation moves to *in transit* and the organisation can follow it), live fulfilment counters (Server-Sent Events), animated donation tracking timeline, personal impact + private milestones, "Needs you can fulfil" recommendations, account deletion.

**Recipients** — organisation registration with encrypted private details, document upload to private storage, verification workflow, **schema-driven Smart Request Builder** (category fields come from the database, so admins can add categories without code) with **product types**: choosing e.g. *Footwear*, *Saree*, *Table / desk* or *Wheelchair* shows that product's own measurements (cm/in, kg/g, L/ml), required fields and default unit — 64 built-in product types in [`src/lib/product-types.ts`](src/lib/product-types.ts), which admins can change. Per-item fulfilment tracking, recurring requests, donors' photos/descriptions/courier tracking on each donation, confirm receipt, anonymous donor references.

**Administrators** — operations dashboard (KPIs, line/donut/bar charts, district tile-map, fulfilment ring, monthly impact), request moderation with automatic quality checks (PII in text, duplicates, quantity sanity, documents) and a priority engine, verification dossier with signed document links, donation management with **photo/video moderation**, **audited identity resolution**, user/role management, least-privilege delivery coordination (including donors' courier and tracking numbers), report/investigation queue, analytics, append-only audit log, platform settings, dynamic categories, data export and retention purge.

**Super admins** — create/manage admins, grant granular permissions, system settings, export.

**Platform** — light + true dark mode (selected palettes, not inverted), WCAG 2.2 AA-minded components (skip link, native accessible dialogs, focus rings, 44px targets, reduced-motion support, table views for every chart), mobile-first layouts, SEO-friendly public pages (`/needs/education`, JSON-LD, canonical URLs), friendly error states with reference IDs and no stack traces, show/hide toggle on every password field.

**Admins: product types without code** — *Settings → Categories → Product types →* opens an editor per category: add, rename, reorder or remove product types; give each its default unit, hide category-wide fields it doesn't need, and add up to 12 details (short text, number, pick-list, yes/no, age range, measurement with chosen units, date) — each marked required or not, and asked of the organisation, the donor or both. A live preview shows the organisation's form and the donor's questions; the list shows how many open requests use each type, and renaming or removing a used type warns first (existing requests keep their details). Saved lists are validated (unique names and keys, choices for pick-lists, units for measurements), audited, and can be restored to the built-in list at any time.

## Privacy architecture

Privacy is enforced in **four layers**, not just hidden in the UI:

| Layer | Mechanism |
|---|---|
| **Database** | PII lives in separate tables (`private_profiles`, `organization_private`, `delivery_private`) encrypted with **AES-256-GCM**. Public tables hold only random references (`D-7KQ9XM`, `R-4HT2WP`, `NR-…`, `DN-…`) — never row counts. Audit logs are append-only (DB trigger). Quantity bounds are DB `CHECK` constraints. |
| **API** | Every non-admin response is built from an explicit Prisma `select` + mapper (`src/lib/dto/*`) that physically cannot reach PII tables. Ownership is part of each query (another user's record is a 404, not a 403). Roles and permissions are always resolved from the database session — client claims are ignored. |
| **Identity resolution** | Exactly one code path links a donor to a recipient (`getDonationIdentity`). It requires the `VIEW_PRIVATE_IDENTITY` permission and writes an audit record (with encrypted IP) before returning. Email lookups of users are gated by the same permission. |
| **Media** | Donor photos are decoded and re-encoded (EXIF, GPS and XMP dropped). MP4/MOV videos have their metadata boxes (location, device, XMP) wiped in place, then wait for a moderator before the organisation can see them. Files live in private storage under random keys and are served only through a permission check, streamed by byte range. |
| **Interface** | Donors see "Verified Learning Center · Partner #R-…, Thrissur". Recipients see "Community Donor #D7K2Q" — an HMAC alias that is **different for every organisation**, so donors cannot be correlated across recipients. Notifications are built from templates that accept references only. Logistics staff get one leg of a delivery at a time (donor → hub, hub → recipient) and never names. Free text donors and recipients write (descriptions, item details, courier names) is checked for phone numbers, emails, links and addresses. |

The core promise is covered by automated tests — see `tests/integration/privacy.test.ts` (*Donor A → Recipient B: DENIED; Recipient B → Donor A: DENIED; authorised admin: ALLOWED + audited*). The full review is in [`docs/SECURITY_REVIEW.md`](docs/SECURITY_REVIEW.md).

## Quick start

Requirements: **Node 20.11+** (22 recommended) and **PostgreSQL 14+**.

```bash
git clone <repo> && cd Koode
npm install

# 1. Configure environment
cp .env.example .env
#    then set DATABASE_URL and generate secrets:
#    DATA_ENCRYPTION_KEY=$(openssl rand -base64 32)
#    APP_SECRET=$(openssl rand -base64 32)
#    ADMIN_EMAIL / ADMIN_PASSWORD / DEMO_PASSWORD (development only)

# 2. Create schema and demo data
npm run db:migrate
npm run db:seed

# 3. Run
npm run dev            # http://localhost:3000
```

> 💡 `npm run test:e2e` builds into the same `.next` folder as `npm run dev` — stop the dev server first, or it will serve pages without styles until restarted.

> ⚠️ `DATA_ENCRYPTION_KEY` encrypts all personal data. Back it up securely — data encrypted with a lost key cannot be recovered. Never commit `.env`.

## Demo accounts

Created by `npm run db:seed` (refuses to run with `NODE_ENV=production`). Passwords come from your environment — nothing is hard-coded.

| Account | Email | Password env | Notes |
|---|---|---|---|
| Super admin | `$ADMIN_EMAIL` | `ADMIN_PASSWORD` | All permissions |
| Ops admin | `ops.admin@koode.local` | `DEMO_PASSWORD` | Includes `VIEW_PRIVATE_IDENTITY`, `AUDIT_LOG_VIEW` |
| Moderator | `moderator@koode.local` | `DEMO_PASSWORD` | Requests, verification, donations — **no identity access** |
| Donor | `donor@demo.local` | `DEMO_PASSWORD` | Has donation history |
| Recipient (verified) | `learning@demo.local` | `DEMO_PASSWORD` | "Verified Learning Center", Thrissur |
| Recipient (pending) | `pending@demo.local` | `DEMO_PASSWORD` | Awaiting verification |

Seed data includes the four requests from the brief (school bags in Thrissur, children's shirts in Ernakulam, blankets in Palakkad, educational toys in Kochi) plus food, uniforms, walking aids and sports kit — each item with its product type and details — and donations spread over six months for analytics.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build / server (standalone output) |
| `npm run lint` · `npm run typecheck` | ESLint · TypeScript |
| `npm run db:migrate` | Apply migrations (`prisma migrate deploy`) |
| `npm run db:migrate:dev` | Create a new migration during development |
| `npm run db:seed` | Reset and load demo data |
| `npm test` | All Vitest tests (unit + integration + security) |
| `npm run test:unit` · `npm run test:integration` | Subsets |
| `npm run test:e2e` | Playwright (builds the app, seeds an e2e DB) |

## Testing

```bash
# one-time: create the test databases
createdb donation_test
createdb donation_e2e

npm test            # 235 tests, ~10s — uses TEST_DATABASE_URL (default: localhost/donation_test)
npm run test:e2e    # 23 tests — uses E2E_DATABASE_URL (default: localhost/donation_e2e)
```

| Suite | Covers |
|---|---|
| `tests/unit/fulfillment` | Per-item and weighted progress, stages, commitment validation |
| `tests/unit/validation` | Request/donation/registration schemas, PII detector, schema-driven attributes |
| `tests/unit/permissions` | RBAC, super-admin-only grants, donation state machine |
| `tests/unit/priority-search` | Priority engine, natural-language search parser |
| `tests/unit/security-primitives` | AES-GCM tamper detection, random IDs, donor aliases, rate limiting, magic-byte upload checks, signed URLs |
| `tests/unit/product-types` · `couriers` | Product-type catalogue integrity, per-type fields, measurement/date validation, donor questions; courier list, tracking-number formats, tracking links |
| `tests/unit/donation-media` · `media-privacy` | Photo re-encoding, MP4/MOV metadata wiping (GPS, device, XMP), AVIF/HEIC detection, storage round-trip |
| `tests/integration/privacy` | **Critical privacy invariant**, encryption at rest, audited identity resolution, logistics legs, back-door linkage |
| `tests/integration/api-security` | Admin APIs vs anonymous/donor/recipient (36 cases), role tampering, cross-user access, CSRF, enumeration, suspension, signed documents |
| `tests/integration/flows` | Recipient → verification → request → approval; donor → donate → track → receive; password reset; email verification |
| `tests/integration/concurrency` | Racing donors never over-commit (2 vs 2 for last 2; 30 vs 7); all-or-nothing multi-item; DB constraints |
| `tests/integration/category-admin` | Product-type editor permissions, saving and tidying, per-field validation errors, new types usable in requests and donor questions, restoring the built-in list, quick category form keeps custom types |
| `tests/integration/product-types` · `courier-tracking` · `review-fixes` | Requests with product types, browsing by product type, donor details per item, new-only items, courier tracking and status changes, media upload limits, byte ranges and moderation |
| `e2e/*` | Full browser journeys for donor, recipient, admin approval, identity reveal, keyboard/a11y, i18n, dark mode, mobile flow, security headers, photos/videos with moderation, courier tracking, product-type filter, admin product-type editor, password visibility |

Route handlers are tested by invoking them directly with real `NextRequest` objects against a real PostgreSQL database — the same authorization middleware, validation and SQL that production uses.

## Project structure

```
prisma/
  schema.prisma            # data model (public vs private tables)
  migrations/              # SQL migrations incl. CHECK constraints + audit trigger
  seed.ts                  # demo data (env-driven credentials)
src/
  app/                     # pages (public, /donor, /recipient, /admin) + /api route handlers
  components/              # ui primitives, brand, needs, donations, recipient, admin, charts
  lib/
    api.ts                 # route() wrapper: session → RBAC → CSRF → rate limit → errors
    auth/                  # sessions, Argon2id, page/API guards
    dto/                   # privacy boundary: explicit selects + mappers
    crypto.ts              # AES-256-GCM, HMAC
    permissions.ts         # roles & granular admin permissions
    fulfillment.ts priority.ts search.ts pii-guard.ts categories.ts donation-status.ts
    product-types.ts       # built-in product types and their measurements
    couriers.ts            # Kerala courier services, tracking links, number validation
    notifications/         # templates (references only) + email/SMS/WhatsApp drivers
    storage/               # private document + donation media storage, signed URLs, media sanitising
    realtime.ts            # SSE pub/sub
    i18n/                  # en / ml / hi dictionaries
  services/                # business logic (auth, requests, donations, organizations, admin, impact)
tests/                     # vitest unit + integration
e2e/                       # playwright
docs/SECURITY_REVIEW.md
```

## API overview

All endpoints return `{ data }` or `{ error: { code, message, details?, errorId? } }`. Mutations require a same-origin request.

| Audience | Endpoints |
|---|---|
| Public | `GET /api/requests` (filters: `q, category, product, district, urgency, stage, donationType, sort, near, page`) · `GET /api/requests/:id` · `GET /api/requests/:id/stream` (SSE) · `POST /api/requests/:id/report` · `GET /api/categories` · `GET /api/impact` |
| Auth | `POST /api/auth/{register,login,logout,forgot-password,reset-password,verify-email}` · `POST /api/auth/phone/{send,verify}` · `GET/DELETE /api/me` · `GET/PATCH /api/notifications` · `GET /api/notifications/stream` |
| Donor | `POST /api/donations` · `GET /api/my-donations` · `GET/PATCH /api/my-donations/:id` · `GET/POST /api/my-donations/:id/media` · `DELETE /api/my-donations/:id/media/:mediaId` · `PUT /api/my-donations/:id/tracking` · `GET /api/recommendations` |
| Media | `GET /api/media/:id` — donor, addressed organisation (approved files only) or moderating admin; supports byte ranges |
| Recipient | `POST /api/requests` · `GET /api/my-requests` · `GET/PATCH /api/my-requests/:id` · `GET /api/recipient/donations` · `POST /api/recipient/donations/:id/receive` · `GET /api/organization` · `POST /api/organization/documents` · `POST /api/organization/verification` |
| Admin (per permission) | `/api/admin/stats` · `analytics` · `users[/:id[/identity]]` · `requests[/:id]` · `reports[/:id]` · `donations[/:id[/identity]]` · `verifications[/:id]` · `documents/:id` · `deliveries[/:id[/packet?leg=]]` · `media/:id` · `audit` · `categories` · `categories/:slug/product-types` (GET, PUT; `{ productTypes: null }` restores the built-in list) · `settings` · `export` · `retention` |

## Deployment

### Docker Compose (single host)

```bash
cp .env.example .env       # fill in secrets; set APP_URL to your https origin
export POSTGRES_PASSWORD=$(openssl rand -base64 24)
docker compose up -d --build   # db → migrate → app on :3000
```

Run the seed only for demos: `docker compose run --rm migrate node --conditions=react-server --import tsx prisma/seed.ts` (requires `ALLOW_PRODUCTION_SEED=true` if `NODE_ENV=production`).

### Any Node host / PaaS

```bash
npm ci && npm run build
npm run db:migrate
node .next/standalone/server.js     # copy .next/static and public alongside, or use `npm start`
```

### Production checklist

- Serve over **HTTPS** behind a reverse proxy that sets `X-Forwarded-For` (used for rate limiting and audit IPs); cookies become `__Host-` + `Secure` automatically in production.
- Generate unique `DATA_ENCRYPTION_KEY` and `APP_SECRET`; store them in your secret manager. Never reuse the development values.
- Mount persistent, private storage for `STORAGE_DIR` (or implement the S3/R2 adapter in `src/lib/storage`).
- Configure `EMAIL_DRIVER=resend` + `RESEND_API_KEY` (or add a driver) and optionally Cloudflare Turnstile keys.
- Do **not** set `ADMIN_*`/`DEMO_PASSWORD` in production and do not run the seed. Create the first super admin once with a one-off script or the seed + immediate password reset.
- Schedule the retention purge (Admin → Settings → "Run retention purge", or `POST /api/admin/retention`).

## Configuration

See [`.env.example`](.env.example). Runtime platform settings (verification policy, retention days, feature flags such as monetary/group/recurring donations, email verification before donating) are edited in **Admin → Settings** and stored in `platform_settings`.

## Known limitations & next steps

- **Multi-instance scaling:** rate limiting and SSE pub/sub are in-process. For more than one app instance, swap `src/lib/rate-limit.ts` and `src/lib/realtime.ts` for Redis (interfaces are already isolated).
- **CSP** allows `'unsafe-inline'` scripts because Next.js injects inline bootstrap scripts; moving to nonce-based CSP via middleware is a recommended hardening step.
- **Object storage:** only the local private-disk driver is implemented; an S3/R2 adapter fits behind `src/lib/storage`.
- **Monetary donations** are architecture-only (feature flag + `DonationType`); integrate a compliant provider (e.g. Razorpay/UPI) before enabling.
- **Translations** cover navigation, hero, CTAs and common labels; deeper pages still use English copy and need translator review for Malayalam/Hindi.
- **Courier tracking** links to each courier's own tracking page; there is no live status feed (courier APIs need business accounts). Blue Dart, Delhivery, Ekart and XpressBees links include the number, but whether their sites fill it in automatically wasn't confirmed. KSRTC Courier has no link. The organisation sees the tracking number, and courier pages can show the town a parcel was booked from — donors are told this before saving.
- **Media formats:** HEIC photos aren't accepted yet (iPhones can save "Most Compatible" JPEGs); WebM videos keep their metadata (only MP4/MOV are cleaned) — phones record MP4/MOV, so this mainly affects desktop recordings.
- **Product types** edited by admins replace the built-in list for that category as a whole, so later changes to [`src/lib/product-types.ts`](src/lib/product-types.ts) don't reach a customised category until an admin restores the built-in list. A detail's key is fixed once saved, and renaming a product type doesn't rename it on existing requests.
- **Category-wide fields** are still edited in the quick `key:type[:options]` text form in Settings.
- The Docker image was written for this project but could not be built in the authoring environment (no Docker daemon); the standalone Next.js output it packages was built and E2E-tested.
