import { describe, expect, it } from "vitest";
import { decrypt, encrypt, hmac } from "@/lib/crypto";
import { generatePublicId, isPublicId } from "@/lib/ids";
import { rateLimit, resetRateLimits } from "@/lib/rate-limit";
import { sniffFile, signDocumentUrl, verifyDocumentSignature } from "@/lib/storage";
import { donorAliasFor } from "@/lib/anonymity";
import { templates } from "@/lib/notifications/templates";

describe("encryption at rest", () => {
  it("round-trips and uses a fresh IV every time", () => {
    const a = encrypt("Sister Mary Thomas");
    const b = encrypt("Sister Mary Thomas");
    expect(a).not.toBe(b);
    expect(a).not.toContain("Mary");
    expect(decrypt(a)).toBe("Sister Mary Thomas");
  });
  it("detects tampering (GCM auth tag)", () => {
    const parts = encrypt("secret").split(".");
    parts[3] = Buffer.from("tampered").toString("base64url");
    expect(() => decrypt(parts.join("."))).toThrow();
  });
});

describe("public identifiers", () => {
  it("are random, prefixed and not sequential", () => {
    const ids = new Set(Array.from({ length: 500 }, () => generatePublicId("donation")));
    expect(ids.size).toBe(500);
    for (const id of ids) expect(isPublicId(id, "donation")).toBe(true);
    expect(isPublicId("DN-000001")).toBe(false); // ambiguous digits excluded
  });
});

describe("donor aliases", () => {
  it("are stable per recipient but unlinkable across recipients", () => {
    const donor = "11111111-1111-4111-8111-111111111111";
    const a1 = donorAliasFor(donor, "org-a");
    expect(donorAliasFor(donor, "org-a")).toBe(a1);
    expect(donorAliasFor(donor, "org-b")).not.toBe(a1);
    expect(a1).toMatch(/^D[23456789A-Z]{5}$/);
  });
});

describe("rate limiting", () => {
  it("blocks after the limit within a window", () => {
    const prev = process.env.DISABLE_RATE_LIMIT;
    process.env.DISABLE_RATE_LIMIT = "false";
    resetRateLimits();
    const t = 1_000_000;
    for (let i = 0; i < 3; i++) expect(rateLimit("k", 3, 1000, t).allowed).toBe(true);
    const blocked = rateLimit("k", 3, 1000, t);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBe(1);
    expect(rateLimit("k", 3, 1000, t + 1001).allowed).toBe(true);
    process.env.DISABLE_RATE_LIMIT = prev;
  });
});

describe("secure uploads", () => {
  it("validates by magic bytes, not the declared type", () => {
    expect(sniffFile(Buffer.from("%PDF-1.7 ..."))?.mime).toBe("application/pdf");
    expect(sniffFile(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0])) ?.mime).toBe("image/png");
    expect(sniffFile(Buffer.from("<script>alert(1)</script>"))).toBeNull();
    expect(sniffFile(Buffer.from("MZ\x90\x00 executable"))).toBeNull();
  });
  it("signed document URLs expire and cannot be forged", () => {
    const now = Date.now();
    const url = new URL(signDocumentUrl("doc-1", now), "http://x");
    const exp = url.searchParams.get("exp");
    const sig = url.searchParams.get("sig");
    expect(verifyDocumentSignature("doc-1", exp, sig, now)).toBe(true);
    expect(verifyDocumentSignature("doc-2", exp, sig, now)).toBe(false);
    expect(verifyDocumentSignature("doc-1", exp, `${sig}x`, now)).toBe(false);
    expect(verifyDocumentSignature("doc-1", exp, sig, now + 10 * 60_000)).toBe(false);
    expect(hmac("a", "p1")).not.toBe(hmac("a", "p2"));
  });
});

describe("notification templates", () => {
  it("are built from references only (no identity fields can be passed)", () => {
    const t = templates.donationCommittedRecipient("NR-ABCDEF", [{ quantity: 2, name: "School bag" }]);
    expect(t.body).toBe("An anonymous donor has committed 2 × School bag to your request NR-ABCDEF.");
  });
});
