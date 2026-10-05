import type { DonationStatus, Role } from "@prisma/client";

/**
 * Donation lifecycle state machine.
 *
 *   CREATED → CONFIRMED → PREPARING → IN_TRANSIT → RECEIVED → COMPLETED
 *        ↘──────────↘───────────↘ CANCELLED
 *   (RECEIVED may also follow CONFIRMED / PREPARING directly.)
 */
const TRANSITIONS: Record<DonationStatus, DonationStatus[]> = {
  CREATED: ["CONFIRMED", "CANCELLED"],
  // Items can arrive before the donor marks the handover (e.g. partner drop-off),
  // so receipt may be confirmed from any pre-delivery state.
  CONFIRMED: ["PREPARING", "IN_TRANSIT", "RECEIVED", "CANCELLED"],
  PREPARING: ["IN_TRANSIT", "RECEIVED", "CANCELLED"],
  IN_TRANSIT: ["RECEIVED"],
  RECEIVED: ["COMPLETED"],
  COMPLETED: [],
  CANCELLED: [],
};

/** Which roles may drive each target status. Admins may drive any valid transition. */
const ACTOR_RULES: Record<DonationStatus, Role[]> = {
  CREATED: [],
  CONFIRMED: ["ADMIN", "SUPER_ADMIN"],
  PREPARING: ["DONOR", "ADMIN", "SUPER_ADMIN"],
  IN_TRANSIT: ["DONOR", "ADMIN", "SUPER_ADMIN"],
  RECEIVED: ["RECIPIENT", "ADMIN", "SUPER_ADMIN"],
  COMPLETED: ["ADMIN", "SUPER_ADMIN"],
  CANCELLED: ["DONOR", "ADMIN", "SUPER_ADMIN"],
};

export function canTransition(from: DonationStatus, to: DonationStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

export function canActorTransition(role: Role, from: DonationStatus, to: DonationStatus): boolean {
  return canTransition(from, to) && ACTOR_RULES[to].includes(role);
}

/** Statuses whose quantity still counts toward a request's commitments. */
export function holdsQuantity(status: DonationStatus): boolean {
  return status !== "CANCELLED";
}

export function isActiveDonation(status: DonationStatus): boolean {
  return status !== "CANCELLED" && status !== "COMPLETED";
}
