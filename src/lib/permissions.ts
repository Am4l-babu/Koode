import type { Permission, Role } from "@prisma/client";

export const ALL_PERMISSIONS = [
  "REQUEST_REVIEW",
  "USER_MANAGEMENT",
  "DONATION_MANAGEMENT",
  "VIEW_PRIVATE_IDENTITY",
  "VERIFICATION_REVIEW",
  "DELIVERY_MANAGEMENT",
  "ANALYTICS_VIEW",
  "AUDIT_LOG_VIEW",
  "SYSTEM_SETTINGS",
  "ADMIN_MANAGEMENT",
] as const satisfies readonly Permission[];

/** Permissions a newly created ADMIN receives unless a super admin changes them. */
export const DEFAULT_ADMIN_PERMISSIONS: Permission[] = [
  "REQUEST_REVIEW",
  "USER_MANAGEMENT",
  "DONATION_MANAGEMENT",
  "VERIFICATION_REVIEW",
  "DELIVERY_MANAGEMENT",
  "ANALYTICS_VIEW",
];

/** Permissions only a SUPER_ADMIN can hold. */
export const SUPER_ADMIN_ONLY: Permission[] = ["ADMIN_MANAGEMENT", "SYSTEM_SETTINGS"];

export const PERMISSION_LABELS: Record<Permission, string> = {
  REQUEST_REVIEW: "Review requests",
  USER_MANAGEMENT: "Manage users",
  DONATION_MANAGEMENT: "Manage donations",
  VIEW_PRIVATE_IDENTITY: "View private identities",
  VERIFICATION_REVIEW: "Review verifications",
  DELIVERY_MANAGEMENT: "Manage deliveries",
  ANALYTICS_VIEW: "View analytics",
  AUDIT_LOG_VIEW: "View audit logs",
  SYSTEM_SETTINGS: "System settings",
  ADMIN_MANAGEMENT: "Manage administrators",
};

export interface PermissionSubject {
  role: Role;
  permissions: Permission[];
  status?: string;
}

export function isAdminRole(role: Role): boolean {
  return role === "ADMIN" || role === "SUPER_ADMIN";
}

/**
 * Effective permissions are always resolved from the database record of the
 * authenticated user — never from anything the client sends.
 */
export function effectivePermissions(subject: PermissionSubject): Set<Permission> {
  if (subject.status && subject.status !== "ACTIVE") return new Set();
  if (subject.role === "SUPER_ADMIN") return new Set(ALL_PERMISSIONS);
  if (subject.role === "ADMIN") {
    return new Set(subject.permissions.filter((p) => !SUPER_ADMIN_ONLY.includes(p)));
  }
  return new Set();
}

export function hasPermission(subject: PermissionSubject, permission: Permission): boolean {
  return effectivePermissions(subject).has(permission);
}

/** Can `actor` assign `targetRole` to another user? */
export function canAssignRole(actor: PermissionSubject, targetRole: Role): boolean {
  if (targetRole === "DONOR" || targetRole === "RECIPIENT") return hasPermission(actor, "USER_MANAGEMENT");
  // Creating/changing admins requires ADMIN_MANAGEMENT, which only SUPER_ADMIN holds.
  return actor.role === "SUPER_ADMIN" && hasPermission(actor, "ADMIN_MANAGEMENT");
}

/** Can `actor` change the account of a user who currently holds `targetRole`? */
export function canManageUser(actor: PermissionSubject, targetRole: Role): boolean {
  if (isAdminRole(targetRole)) return actor.role === "SUPER_ADMIN";
  return hasPermission(actor, "USER_MANAGEMENT");
}
