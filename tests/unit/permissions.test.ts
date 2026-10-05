import { describe, expect, it } from "vitest";
import { canAssignRole, canManageUser, effectivePermissions, hasPermission } from "@/lib/permissions";
import { canActorTransition, canTransition } from "@/lib/donation-status";

const donor = { role: "DONOR" as const, permissions: [] };
const recipient = { role: "RECIPIENT" as const, permissions: [] };
const moderator = { role: "ADMIN" as const, permissions: ["REQUEST_REVIEW" as const] };
const opsAdmin = { role: "ADMIN" as const, permissions: ["USER_MANAGEMENT" as const, "VIEW_PRIVATE_IDENTITY" as const] };
const superAdmin = { role: "SUPER_ADMIN" as const, permissions: [] };

describe("permissions", () => {
  it("donors and recipients hold no admin permissions — even if the field is tampered", () => {
    expect(effectivePermissions(donor).size).toBe(0);
    expect(hasPermission({ role: "DONOR", permissions: ["VIEW_PRIVATE_IDENTITY"] }, "VIEW_PRIVATE_IDENTITY")).toBe(false);
    expect(hasPermission({ role: "RECIPIENT", permissions: ["ADMIN_MANAGEMENT"] }, "ADMIN_MANAGEMENT")).toBe(false);
  });
  it("admins only get granted permissions; super-admin-only ones are stripped", () => {
    expect(hasPermission(moderator, "REQUEST_REVIEW")).toBe(true);
    expect(hasPermission(moderator, "VIEW_PRIVATE_IDENTITY")).toBe(false);
    expect(hasPermission({ role: "ADMIN", permissions: ["ADMIN_MANAGEMENT", "SYSTEM_SETTINGS"] }, "ADMIN_MANAGEMENT")).toBe(false);
  });
  it("super admins hold every permission", () => {
    expect(hasPermission(superAdmin, "ADMIN_MANAGEMENT")).toBe(true);
    expect(hasPermission(superAdmin, "VIEW_PRIVATE_IDENTITY")).toBe(true);
  });
  it("suspended accounts lose all permissions", () => expect(effectivePermissions({ ...superAdmin, status: "SUSPENDED" }).size).toBe(0));
  it("only super admins can assign admin roles or manage admins", () => {
    expect(canAssignRole(opsAdmin, "DONOR")).toBe(true);
    expect(canAssignRole(opsAdmin, "ADMIN")).toBe(false);
    expect(canAssignRole(superAdmin, "SUPER_ADMIN")).toBe(true);
    expect(canAssignRole(donor, "DONOR")).toBe(false);
    expect(canManageUser(opsAdmin, "ADMIN")).toBe(false);
    expect(canManageUser(superAdmin, "ADMIN")).toBe(true);
    expect(canManageUser(recipient, "DONOR")).toBe(false);
  });
});

describe("donation state machine", () => {
  it("allows the happy path", () => {
    expect(canTransition("CONFIRMED", "PREPARING")).toBe(true);
    expect(canTransition("IN_TRANSIT", "RECEIVED")).toBe(true);
    expect(canTransition("RECEIVED", "COMPLETED")).toBe(true);
    expect(canTransition("CONFIRMED", "RECEIVED")).toBe(true);
  });
  it("forbids skipping backwards or cancelling after transit", () => {
    expect(canTransition("COMPLETED", "CONFIRMED")).toBe(false);
    expect(canTransition("IN_TRANSIT", "CANCELLED")).toBe(false);
  });
  it("enforces who may drive each transition", () => {
    expect(canActorTransition("DONOR", "CONFIRMED", "PREPARING")).toBe(true);
    expect(canActorTransition("DONOR", "IN_TRANSIT", "RECEIVED")).toBe(false);
    expect(canActorTransition("RECIPIENT", "IN_TRANSIT", "RECEIVED")).toBe(true);
    expect(canActorTransition("RECIPIENT", "CONFIRMED", "CANCELLED")).toBe(false);
    expect(canActorTransition("ADMIN", "RECEIVED", "COMPLETED")).toBe(true);
  });
});
