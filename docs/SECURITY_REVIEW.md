# Security review — donor ↔ recipient identity leakage

**Scope:** every path by which a donor could learn a recipient's identity, a recipient could learn a donor's identity, or an administrator without `VIEW_PRIVATE_IDENTITY` could link the two.
**Method:** walked each data flow (DB → service → DTO → API/RSC → UI/notification/log), then encoded each guarantee as an automated test.
**Result:** 3 issues found and fixed (below). All invariants are covered by `tests/integration/privacy.test.ts` and `tests/integration/api-security.test.ts`.

## Threat model

| Actor | Must never obtain |
|---|---|
| Donor | Recipient organisation name, contact person, phone, email, exact address, PIN, documents |
| Recipient | Donor name, email, phone, address, account reference, photo |
| Admin without `VIEW_PRIVATE_IDENTITY` | Any way to resolve a reference to a person, or to link a known person to the other party |
| Anyone | Another user's private records; the ability to elevate their role |

## Checklist

| # | Vector | Status | Control / test |
|---|---|---|---|
| 1 | Public & donor API responses | ✅ | Explicit `select` in `lib/dto/requests.ts`, `lib/dto/donations.ts`; response bodies scanned for PII strings in tests |
| 2 | Recipient API responses | ✅ | `toRecipientDonation` drops `donorId`/`organizationId`; donor shown as per-org HMAC alias (`lib/anonymity.ts`) |
| 3 | React Server Component payloads | ✅ | Client components receive DTOs only (`DonatePanel`, `DonationModal`, admin actions get ids/refs) |
| 4 | Notifications (in-app, email, SMS) | ✅ | `lib/notifications/templates.ts` accept references only; DB rows scanned in tests |
| 5 | Real-time SSE | ✅ | Request channel publishes counts only; user channel keyed by the authenticated user's id |
| 6 | Free text written by recipients | ✅ | `publicText()` + `detectPii()` reject phones, emails, links, social handles, PIN codes, house numbers in titles, descriptions, item names and attributes; moderation quality check repeats it |
| 7 | Logistics | ✅ fixed | Donors never send to a recipient's address (pickup / partner drop-off / courier to hub). **Fixed:** delivery packets are now split per leg so no single view contains both ends |
| 8 | Error messages | ✅ | `jsonError` returns safe messages + `ERR-xxxxxx` reference; stack traces logged server-side only |
| 9 | Enumeration via 403/404 | ✅ | Ownership is part of each query → other users' records are 404 |
| 10 | Role/permission tampering | ✅ | Registration schema only accepts `DONOR`/`RECIPIENT`; permissions resolved from DB session; super-admin-only permissions stripped from admins; self-modification blocked |
| 11 | Admin back-door linkage | ✅ fixed | **Fixed:** email search and (masked) emails in the users table now require `VIEW_PRIVATE_IDENTITY` |
| 12 | Audit log contents | ✅ fixed | **Fixed:** identity-access records no longer store the donor↔recipient reference pair. IPs are AES-GCM encrypted; table is append-only via trigger |
| 13 | Data at rest | ✅ | Names, phones, addresses, PIN, registration numbers, document file names encrypted (AES-256-GCM); verified by raw-SQL dump test |
| 14 | Documents | ✅ | Private storage outside `/public`, random keys, magic-byte validation, 5 MB limit, HMAC-signed 5-minute URLs **and** permission check, `CSP: sandbox`, each view audited |
| 15 | Public identifiers | ✅ | Random 6-char base-31 codes; nothing derived from row counts; donor aliases differ per organisation |
| 16 | Data exports | ✅ | Super-admin only, audited, operational data only — no PII |
| 17 | Sessions & CSRF | ✅ | Random 256-bit tokens, HMAC-hashed at rest, httpOnly, SameSite=Lax, `__Host-`/Secure in production; Origin / `Sec-Fetch-Site` checks on mutations |
| 18 | Brute force / bots | ✅ | Per-route rate limits, honeypot + minimum fill time, optional Turnstile, generic login errors, Argon2id with dummy-hash timing equaliser |
| 19 | XSS / injection | ✅ | React escaping, JSON-LD `<` escaped, strict CSP (`frame-ancestors 'none'`, no third-party scripts), Prisma parameterised queries (raw SQL uses tagged templates) |
| 20 | Over-commitment races | ✅ | Atomic conditional `UPDATE … WHERE committed + q <= required` + DB `CHECK` constraint |

## Issues found and fixed

1. **Back-door identity lookup by email (medium).** An admin holding `USER_MANAGEMENT` + `DONATION_MANAGEMENT` but not `VIEW_PRIVATE_IDENTITY` could search the users table by a donor's email, obtain their reference, and then see which recipients that reference donated to. *Fix:* email search and masked-email display are gated on `VIEW_PRIVATE_IDENTITY` (`services/admin.ts › listUsers`). *Test:* "an admin WITHOUT identity permission cannot look a donor up by email".
2. **Audit metadata linked both parties (low).** `VIEW_PRIVATE_IDENTITY` audit rows stored `{ donor, recipient }` references, readable by `AUDIT_LOG_VIEW` holders. *Fix:* metadata now records context only; the target is the donation. *Test:* "identity-access audit records do not store the donor↔recipient pair".
3. **Delivery packet combined both locations (low).** One packet showed the donor's pickup address and the recipient's address. *Fix:* `?leg=pickup|dropoff`, each leg separately audited. *Test:* "delivery packets are split per leg".

## Residual risks (accepted / documented)

- Recipient-written descriptions could still mention people by first name; automated detection covers contact details, and every request is human-moderated before publishing.
- Admins with `VIEW_PRIVATE_IDENTITY` can, by design, see both identities. Mitigation: granular permission, every access audited with encrypted IP.
- Registration reveals whether an email is already registered (409). Mitigated by rate limiting; password reset is fully enumeration-safe.
- `X-Forwarded-For` is trusted for rate-limit keys and audit IPs — deploy behind a proxy that overwrites it.
- CSP permits inline scripts (Next.js bootstrap). Nonce-based CSP is a recommended next step.
