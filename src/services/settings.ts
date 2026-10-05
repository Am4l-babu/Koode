import "server-only";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import type { SessionUser } from "@/lib/auth/session";
import type { settingsSchema } from "@/lib/validation/admin";
import type { z } from "zod";

export interface PlatformSettings {
  verificationPolicy: {
    requireDocuments: boolean;
    minDocuments: number;
    allowIndividuals: boolean;
    requirePhoneVerification: boolean;
  };
  retention: {
    auditLogDays: number;
    documentDays: number;
    closedRequestDays: number;
    deletedAccountGraceDays: number;
  };
  features: {
    monetaryDonations: boolean;
    groupDonations: boolean;
    recurringRequests: boolean;
    smsNotifications: boolean;
    whatsappNotifications: boolean;
  };
  security: {
    sessionDays: number;
    requireEmailVerificationToDonate: boolean;
  };
}

export const DEFAULT_SETTINGS: PlatformSettings = {
  verificationPolicy: { requireDocuments: true, minDocuments: 1, allowIndividuals: false, requirePhoneVerification: false },
  retention: { auditLogDays: 730, documentDays: 365, closedRequestDays: 365, deletedAccountGraceDays: 30 },
  features: {
    monetaryDonations: false,
    groupDonations: true,
    recurringRequests: true,
    smsNotifications: false,
    whatsappNotifications: false,
  },
  security: { sessionDays: 7, requireEmailVerificationToDonate: false },
};

const SECTIONS = Object.keys(DEFAULT_SETTINGS) as (keyof PlatformSettings)[];

export async function getSettings(): Promise<PlatformSettings> {
  const rows = await db.platformSetting.findMany({ where: { key: { in: SECTIONS } } });
  const result = structuredClone(DEFAULT_SETTINGS);
  for (const row of rows) {
    const key = row.key as keyof PlatformSettings;
    Object.assign(result[key], row.value as object);
  }
  return result;
}

export async function updateSettings(actor: SessionUser, patch: z.infer<typeof settingsSchema>, ip?: string) {
  const current = await getSettings();
  for (const section of SECTIONS) {
    const value = patch[section];
    if (!value) continue;
    const merged = { ...current[section], ...value } as Prisma.InputJsonObject;
    await db.platformSetting.upsert({
      where: { key: section },
      create: { key: section, value: merged },
      update: { value: merged },
    });
  }
  await audit(actor, "SETTINGS_CHANGED", { type: "settings", id: "platform" }, { sections: Object.keys(patch) }, ip);
  return getSettings();
}
