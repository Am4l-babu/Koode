import "server-only";
import type { Prisma } from "@prisma/client";
import { db } from "./db";
import { encryptOptional } from "./crypto";

export const AUDIT_ACTIONS = [
  "LOGIN",
  "LOGIN_FAILED",
  "LOGOUT",
  "REGISTER",
  "PASSWORD_RESET",
  "EMAIL_VERIFIED",
  "PHONE_VERIFIED",
  "VIEW_PRIVATE_IDENTITY",
  "VIEW_VERIFICATION_DOCUMENT",
  "VIEW_DELIVERY_DETAILS",
  "VERIFICATION_DECISION",
  "REQUEST_APPROVED",
  "REQUEST_REJECTED",
  "REQUEST_INFO_REQUESTED",
  "REQUEST_PRIORITY_CHANGED",
  "REQUEST_CLOSED",
  "DONATION_STATUS_CHANGED",
  "DELIVERY_UPDATED",
  "MEDIA_MODERATED",
  "USER_STATUS_CHANGED",
  "USER_ROLE_CHANGED",
  "USER_PERMISSIONS_CHANGED",
  "USER_ACCESS_RESET",
  "ADMIN_CREATED",
  "CATEGORY_CHANGED",
  "SETTINGS_CHANGED",
  "DATA_EXPORT",
  "REPORT_UPDATED",
  "RETENTION_PURGE",
] as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export interface AuditActor {
  id: string;
  publicId: string;
  role: string;
}

export function actorLabel(actor: AuditActor | null): string {
  if (!actor) return "System";
  const kind = actor.role === "SUPER_ADMIN" ? "Super Admin" : actor.role === "ADMIN" ? "Admin" : actor.role === "RECIPIENT" ? "Partner" : "Donor";
  return `${kind} #${actor.publicId}`;
}

export async function audit(
  actor: AuditActor | null,
  action: AuditAction,
  target?: { type: string; id: string },
  metadata: Prisma.InputJsonObject = {},
  ip?: string | null,
  tx: Pick<typeof db, "auditLog"> = db,
) {
  await tx.auditLog.create({
    data: {
      actorId: actor?.id ?? null,
      actorLabel: actorLabel(actor),
      action,
      targetType: target?.type,
      targetId: target?.id,
      metadata,
      ipEnc: ip && ip !== "unknown" ? encryptOptional(ip) : null,
    },
  });
}
