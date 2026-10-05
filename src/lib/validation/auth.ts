import { z } from "zod";
import { districtSchema, emailSchema, passwordSchema, phoneSchema, pinCodeSchema, trimmed } from "./common";

const ORG_TYPES = [
  "PLAY_SCHOOL",
  "SCHOOL",
  "ORPHANAGE",
  "OLD_AGE_HOME",
  "NGO",
  "COMMUNITY_ORGANIZATION",
  "SHELTER",
  "CARE_CENTER",
  "INDIVIDUAL",
] as const;

const botFields = {
  /** Honeypot: real users never see or fill this field. */
  website: z.string().max(0, "Bot check failed.").optional().default(""),
  captchaToken: z.string().max(4096).optional(),
  /** ms timestamp the form was rendered — submissions faster than 1.5s are bots. */
  formStartedAt: z.number().int().optional(),
};

export const donorRegisterSchema = z.object({
  role: z.literal("DONOR"),
  fullName: trimmed(2, 80, "Full name"),
  email: emailSchema,
  password: passwordSchema,
  phone: phoneSchema.optional().or(z.literal("").transform(() => undefined)),
  district: districtSchema.optional(),
  acceptTerms: z.literal(true, { errorMap: () => ({ message: "Please accept the privacy terms." }) }),
  ...botFields,
});

export const recipientRegisterSchema = z.object({
  role: z.literal("RECIPIENT"),
  fullName: trimmed(2, 80, "Your name"),
  email: emailSchema,
  password: passwordSchema,
  phone: phoneSchema,
  orgType: z.enum(ORG_TYPES, { errorMap: () => ({ message: "Choose an organisation type." }) }),
  orgLegalName: trimmed(2, 120, "Organisation name"),
  contactPerson: trimmed(2, 80, "Contact person"),
  registrationNumber: trimmed(0, 60, "Registration number").optional(),
  focusArea: trimmed(0, 60, "Focus area").optional(),
  address: trimmed(5, 240, "Address"),
  city: trimmed(2, 60, "City / town"),
  district: districtSchema,
  pinCode: pinCodeSchema,
  acceptTerms: z.literal(true, { errorMap: () => ({ message: "Please accept the privacy terms." }) }),
  ...botFields,
});

/**
 * Registration only ever accepts DONOR or RECIPIENT. There is no way for a
 * client to self-register as ADMIN / SUPER_ADMIN.
 */
export const registerSchema = z.discriminatedUnion("role", [donorRegisterSchema, recipientRegisterSchema]);
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Password is required.").max(128),
  captchaToken: z.string().max(4096).optional(),
});

export const forgotPasswordSchema = z.object({ email: emailSchema, captchaToken: z.string().max(4096).optional() });

export const resetPasswordSchema = z.object({
  token: z.string().min(20).max(200),
  password: passwordSchema,
});

export const verifyEmailSchema = z.object({ token: z.string().min(20).max(200) });

export const phoneOtpVerifySchema = z.object({ code: z.string().regex(/^\d{6}$/, "Enter the 6-digit code.") });
