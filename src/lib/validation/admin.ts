import { z } from "zod";
import { ALL_PERMISSIONS } from "../permissions";
import { emailSchema, passwordSchema, trimmed } from "./common";
import { categorySchemaSchema, productTypeSchema } from "../categories";
import { PRIORITIES } from "./request";

export const requestDecisionSchema = z.discriminatedUnion("decision", [
  z.object({ decision: z.literal("APPROVE"), priority: z.enum(PRIORITIES).optional(), note: trimmed(0, 500, "Note").optional() }),
  z.object({ decision: z.literal("REJECT"), reason: trimmed(5, 500, "Reason") }),
  z.object({ decision: z.literal("REQUEST_INFO"), note: trimmed(5, 500, "Message") }),
  z.object({ decision: z.literal("SET_PRIORITY"), priority: z.enum(PRIORITIES) }),
  z.object({ decision: z.literal("CLOSE"), note: trimmed(0, 500, "Note").optional() }),
]);

export const verificationDecisionSchema = z.object({
  status: z.enum(["UNDER_REVIEW", "VERIFIED", "REJECTED", "SUSPENDED"]),
  note: trimmed(0, 500, "Note").optional(),
  checklist: z
    .object({
      registration: z.boolean(),
      contactPerson: z.boolean(),
      location: z.boolean(),
      documents: z.boolean(),
      proofOfNeed: z.boolean(),
      previousActivity: z.boolean(),
    })
    .partial()
    .default({}),
});

export const adminDonationUpdateSchema = z.object({
  status: z.enum(["CONFIRMED", "PREPARING", "IN_TRANSIT", "RECEIVED", "COMPLETED", "CANCELLED"]),
  note: trimmed(0, 300, "Note").optional(),
});

export const deliveryUpdateSchema = z.object({
  status: z.enum(["UNASSIGNED", "SCHEDULED", "PICKED_UP", "DELIVERED", "FAILED"]),
  pickupScheduledAt: z.coerce.date().optional(),
  assigneeLabel: trimmed(0, 60, "Volunteer / partner").optional(),
  notes: trimmed(0, 500, "Notes").optional(),
  proofNote: trimmed(0, 500, "Proof of delivery").optional(),
});

export const userUpdateSchema = z
  .object({
    status: z.enum(["ACTIVE", "SUSPENDED", "DISABLED"]).optional(),
    role: z.enum(["DONOR", "RECIPIENT", "ADMIN", "SUPER_ADMIN"]).optional(),
    permissions: z.array(z.enum(ALL_PERMISSIONS)).optional(),
    resetAccess: z.boolean().optional(),
    reason: trimmed(0, 300, "Reason").optional(),
  })
  .refine((v) => v.status || v.role || v.permissions || v.resetAccess, "Nothing to update.");

export const createAdminSchema = z.object({
  email: emailSchema,
  fullName: trimmed(2, 80, "Full name"),
  password: passwordSchema,
  role: z.enum(["ADMIN", "SUPER_ADMIN"]).default("ADMIN"),
  permissions: z.array(z.enum(ALL_PERMISSIONS)).default([]),
});

export const categoryUpsertSchema = z.object({
  slug: z.string().trim().toLowerCase().regex(/^[a-z][a-z0-9-]{1,30}$/, "Use lowercase letters, numbers and dashes."),
  name: trimmed(2, 40, "Name"),
  icon: z.string().trim().min(1).max(8),
  description: trimmed(0, 200, "Description").optional(),
  fieldSchema: categorySchemaSchema,
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().min(0).max(1000).default(100),
});

/** A category's product types as edited by an admin; `null` goes back to the built-in list. */
export const productTypesUpdateSchema = z.object({
  productTypes: z.array(productTypeSchema).max(30, "A category can have up to 30 product types.").nullable(),
});

export const settingsSchema = z.object({
  verificationPolicy: z
    .object({
      requireDocuments: z.boolean(),
      minDocuments: z.number().int().min(0).max(5),
      allowIndividuals: z.boolean(),
      requirePhoneVerification: z.boolean(),
    })
    .partial()
    .optional(),
  retention: z
    .object({
      auditLogDays: z.number().int().min(30).max(3650),
      documentDays: z.number().int().min(30).max(3650),
      closedRequestDays: z.number().int().min(30).max(3650),
      deletedAccountGraceDays: z.number().int().min(0).max(365),
    })
    .partial()
    .optional(),
  features: z
    .object({
      monetaryDonations: z.boolean(),
      groupDonations: z.boolean(),
      recurringRequests: z.boolean(),
      smsNotifications: z.boolean(),
      whatsappNotifications: z.boolean(),
    })
    .partial()
    .optional(),
  security: z
    .object({
      sessionDays: z.number().int().min(1).max(30),
      requireEmailVerificationToDonate: z.boolean(),
    })
    .partial()
    .optional(),
});

export const reportSchema = z.object({
  reason: z.enum(["SUSPICIOUS_INFORMATION", "DUPLICATE_REQUEST", "INCORRECT_REQUIREMENT", "MISUSE", "FAKE_ORGANIZATION", "OTHER"]),
  details: trimmed(0, 600, "Details").optional(),
});

export const reportUpdateSchema = z.object({
  status: z.enum(["OPEN", "INVESTIGATING", "RESOLVED", "DISMISSED"]),
  resolution: trimmed(0, 500, "Resolution").optional(),
});
