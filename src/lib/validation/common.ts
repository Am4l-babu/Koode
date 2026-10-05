import { z } from "zod";
import { detectPii, piiMessage } from "../pii-guard";
import { INDIAN_PHONE_RE, KERALA_DISTRICTS, PIN_CODE_RE } from "../geo";

export const trimmed = (min: number, max: number, label: string) =>
  z
    .string({ required_error: `${label} is required.` })
    .trim()
    .min(min, min <= 1 ? `${label} is required.` : `${label} must be at least ${min} characters.`)
    .max(max, `${label} must be ${max} characters or fewer.`);

/** Text that will be shown publicly — must not contain contact details. */
export const publicText = (min: number, max: number, label: string) =>
  trimmed(min, max, label).superRefine((value, ctx) => {
    const kinds = detectPii(value);
    if (kinds.length) ctx.addIssue({ code: z.ZodIssueCode.custom, message: piiMessage(kinds) });
  });

export const emailSchema = z
  .string({ required_error: "Email is required." })
  .trim()
  .toLowerCase()
  .max(254)
  .email("Enter a valid email address.");

export const passwordSchema = z
  .string({ required_error: "Password is required." })
  .min(10, "Use at least 10 characters.")
  .max(128, "Use 128 characters or fewer.")
  .refine((v) => /[A-Za-z]/.test(v) && /\d/.test(v), "Include at least one letter and one number.");

export const phoneSchema = z
  .string()
  .trim()
  .regex(INDIAN_PHONE_RE, "Enter a valid Indian mobile number, e.g. +91 98765 43210.");

export const pinCodeSchema = z.string().trim().regex(PIN_CODE_RE, "Enter a valid 6-digit PIN code.");

export const districtSchema = z.enum(KERALA_DISTRICTS, {
  errorMap: () => ({ message: "Choose a district." }),
});

export const uuidSchema = z.string().uuid("Invalid identifier.");

export const publicIdSchema = (prefix: string) =>
  z
    .string()
    .trim()
    .toUpperCase()
    .regex(new RegExp(`^${prefix}-[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{6,10}$`), "Invalid reference.");
