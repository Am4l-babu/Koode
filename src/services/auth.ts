import "server-only";
import type { TokenType } from "@prisma/client";
import { db } from "@/lib/db";
import { decrypt, encrypt, hmac, randomDigits, randomToken } from "@/lib/crypto";
import { burnPasswordCheck, hashPassword, verifyPassword } from "@/lib/auth/password";
import { createSession, destroyAllSessionsForUser, type SessionUser } from "@/lib/auth/session";
import { generatePublicId, withUniqueRetry } from "@/lib/ids";
import { audit } from "@/lib/audit";
import { AppError } from "@/lib/errors";
import { ORG_DESCRIPTORS } from "@/lib/descriptors";
import { normalizeIndianPhone } from "@/lib/geo";
import { emailChannel, smsChannel } from "@/lib/notifications/channels";
import { templates } from "@/lib/notifications/templates";
import { env } from "@/lib/env";
import type { RegisterInput } from "@/lib/validation/auth";
import { notifyAdmins } from "./notifications";
import { getSettings } from "./settings";

interface Meta {
  ip?: string;
  userAgent?: string | null;
}

const TOKEN_TTL: Record<TokenType, number> = {
  EMAIL_VERIFICATION: 48 * 3600_000,
  PASSWORD_RESET: 3600_000,
  PHONE_OTP: 10 * 60_000,
};

async function issueToken(userId: string, type: TokenType, value = randomToken(32)) {
  // Invalidate previous unused tokens of the same type.
  await db.authToken.updateMany({ where: { userId, type, usedAt: null }, data: { usedAt: new Date() } });
  await db.authToken.create({
    data: { userId, type, tokenHash: hmac(value, `token:${type}`), expiresAt: new Date(Date.now() + TOKEN_TTL[type]) },
  });
  return value;
}

async function consumeToken(type: TokenType, value: string) {
  const token = await db.authToken.findUnique({ where: { tokenHash: hmac(value, `token:${type}`) } });
  if (!token || token.type !== type || token.usedAt || token.expiresAt.getTime() < Date.now()) {
    throw new AppError("BAD_REQUEST", "This link is invalid or has expired. Please request a new one.");
  }
  await db.authToken.update({ where: { id: token.id }, data: { usedAt: new Date() } });
  return token;
}

export async function register(input: RegisterInput, meta: Meta = {}) {
  const existing = await db.user.findUnique({ where: { email: input.email }, select: { id: true } });
  if (existing) {
    throw new AppError("CONFLICT", "This email is already registered. Try signing in or resetting your password.");
  }
  if (input.role === "RECIPIENT" && input.orgType === "INDIVIDUAL") {
    const settings = await getSettings();
    if (!settings.verificationPolicy.allowIndividuals) {
      throw new AppError("VALIDATION_FAILED", "Individual recipient accounts are not open right now. Please register through a verified organisation.", {
        fields: { orgType: "Individual accounts are not currently accepted." },
      });
    }
  }

  const passwordHash = await hashPassword(input.password);
  const phone = input.phone ? normalizeIndianPhone(input.phone) : null;

  const user = await withUniqueRetry(() =>
    db.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          publicId: generatePublicId(input.role === "RECIPIENT" ? "recipient" : "donor"),
          email: input.email,
          passwordHash,
          role: input.role,
          private: {
            create: {
              fullNameEnc: encrypt(input.fullName),
              phoneEnc: phone ? encrypt(phone) : null,
            },
          },
        },
        select: { id: true, publicId: true, role: true },
      });

      if (input.role === "DONOR") {
        await tx.donorProfile.create({ data: { userId: created.id, preferredDistrict: input.district ?? null } });
      } else {
        await tx.recipientOrganization.create({
          data: {
            // The organisation shares the account's random public reference.
            publicId: created.publicId,
            userId: created.id,
            orgType: input.orgType,
            publicDescriptor: ORG_DESCRIPTORS[input.orgType],
            focusArea: input.focusArea || null,
            district: input.district,
            city: input.city,
            private: {
              create: {
                legalNameEnc: encrypt(input.orgLegalName),
                contactPersonEnc: encrypt(input.contactPerson),
                phoneEnc: encrypt(phone!),
                addressEnc: encrypt(input.address),
                pinCodeEnc: encrypt(input.pinCode),
                registrationNumberEnc: input.registrationNumber ? encrypt(input.registrationNumber) : null,
              },
            },
            verifications: { create: { status: "PENDING" } },
          },
        });
      }
      return created;
    }),
  );

  await audit({ ...user }, "REGISTER", { type: "user", id: user.publicId }, { role: user.role }, meta.ip);
  await sendVerificationEmail(user.id, input.email);
  if (user.role === "RECIPIENT") await notifyAdmins("VERIFICATION_REVIEW", templates.adminNewVerification(user.publicId));

  const session = await createSession(user.id, { ip: meta.ip, userAgent: meta.userAgent });
  return { user, session };
}

export async function sendVerificationEmail(userId: string, email: string) {
  const token = await issueToken(userId, "EMAIL_VERIFICATION");
  await emailChannel().send({
    to: email,
    subject: "Confirm your email",
    text: `Welcome to Sahaya Bridge. Confirm your email: ${env.appUrl}/verify-email?token=${token}`,
  });
}

export async function verifyEmail(token: string) {
  const record = await consumeToken("EMAIL_VERIFICATION", token);
  const user = await db.user.update({
    where: { id: record.userId },
    data: { emailVerifiedAt: new Date() },
    select: { id: true, publicId: true, role: true },
  });
  await audit(user, "EMAIL_VERIFIED", { type: "user", id: user.publicId });
}

export async function login(email: string, password: string, meta: Meta = {}) {
  const user = await db.user.findUnique({
    where: { email },
    select: { id: true, publicId: true, role: true, status: true, passwordHash: true },
  });
  if (!user) {
    await burnPasswordCheck(password);
    await audit(null, "LOGIN_FAILED", undefined, { reason: "unknown_account", emailHash: hmac(email, "email") }, meta.ip);
    throw new AppError("UNAUTHENTICATED", "That email and password combination didn't match.");
  }
  const valid = await verifyPassword(user.passwordHash, password);
  if (!valid) {
    await audit(user, "LOGIN_FAILED", { type: "user", id: user.publicId }, { reason: "bad_password" }, meta.ip);
    throw new AppError("UNAUTHENTICATED", "That email and password combination didn't match.");
  }
  if (user.status !== "ACTIVE") {
    await audit(user, "LOGIN_FAILED", { type: "user", id: user.publicId }, { reason: `status_${user.status}` }, meta.ip);
    throw new AppError("FORBIDDEN", "This account is not active. Please contact the platform team.");
  }
  await db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  const session = await createSession(user.id, { ip: meta.ip, userAgent: meta.userAgent });
  await audit(user, "LOGIN", { type: "user", id: user.publicId }, {}, meta.ip);
  return { user: { id: user.id, publicId: user.publicId, role: user.role }, session };
}

/** Always resolves the same way whether or not the email exists. */
export async function requestPasswordReset(email: string) {
  const user = await db.user.findUnique({ where: { email }, select: { id: true, status: true } });
  if (!user || user.status === "DISABLED") return;
  const token = await issueToken(user.id, "PASSWORD_RESET");
  await emailChannel().send({
    to: email,
    subject: "Reset your password",
    text: `Use this link within 1 hour to choose a new password: ${env.appUrl}/reset-password?token=${token}\nIf you didn't ask for this, you can ignore this email.`,
  });
}

export async function resetPassword(token: string, password: string, meta: Meta = {}) {
  const record = await consumeToken("PASSWORD_RESET", token);
  const user = await db.user.update({
    where: { id: record.userId },
    data: { passwordHash: await hashPassword(password) },
    select: { id: true, publicId: true, role: true },
  });
  await destroyAllSessionsForUser(user.id);
  await audit(user, "PASSWORD_RESET", { type: "user", id: user.publicId }, {}, meta.ip);
}

export async function sendPhoneOtp(actor: SessionUser) {
  const priv = await db.userPrivate.findUnique({ where: { userId: actor.id }, select: { phoneEnc: true } });
  const orgPriv = actor.organizationId
    ? await db.organizationPrivate.findUnique({ where: { organizationId: actor.organizationId }, select: { phoneEnc: true } })
    : null;
  const phoneEnc = priv?.phoneEnc ?? orgPriv?.phoneEnc;
  if (!phoneEnc) throw new AppError("BAD_REQUEST", "Add a phone number to your profile first.");
  const code = randomDigits(6);
  await issueToken(actor.id, "PHONE_OTP", code);
  await smsChannel().send({ to: decrypt(phoneEnc), text: `Your Sahaya Bridge verification code is ${code}. It expires in 10 minutes.` });
}

export async function verifyPhoneOtp(actor: SessionUser, code: string) {
  const token = await db.authToken.findFirst({
    where: { userId: actor.id, type: "PHONE_OTP", usedAt: null },
    orderBy: { createdAt: "desc" },
  });
  if (!token || token.expiresAt.getTime() < Date.now() || token.attempts >= 5) {
    throw new AppError("BAD_REQUEST", "This code has expired. Please request a new one.");
  }
  if (token.tokenHash !== hmac(code, "token:PHONE_OTP")) {
    await db.authToken.update({ where: { id: token.id }, data: { attempts: { increment: 1 } } });
    throw new AppError("BAD_REQUEST", "That code didn't match. Please check and try again.");
  }
  await db.authToken.update({ where: { id: token.id }, data: { usedAt: new Date() } });
  await db.userPrivate.update({ where: { userId: actor.id }, data: { phoneVerifiedAt: new Date() } });
  await audit(actor, "PHONE_VERIFIED", { type: "user", id: actor.publicId });
}
