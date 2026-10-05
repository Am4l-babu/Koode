/**
 * Pure fulfillment maths. Each request item is tracked independently; a
 * request is fully fulfilled only when every item is.
 */
export interface ItemQuantities {
  quantityRequired: number;
  quantityCommitted: number;
  quantityReceived?: number;
}

export type FulfillmentStage = "JUST_POSTED" | "PARTIALLY_FULFILLED" | "ALMOST_COMPLETE" | "FULFILLED";

export const STAGE_LABELS: Record<FulfillmentStage, string> = {
  JUST_POSTED: "Just posted",
  PARTIALLY_FULFILLED: "Partially fulfilled",
  ALMOST_COMPLETE: "Almost complete",
  FULFILLED: "Fulfilled",
};

export function remaining(item: ItemQuantities): number {
  return Math.max(0, item.quantityRequired - item.quantityCommitted);
}

export function itemPercent(item: ItemQuantities): number {
  if (item.quantityRequired <= 0) return 100;
  return clampPercent((item.quantityCommitted / item.quantityRequired) * 100);
}

/** Overall percentage weighted by quantity across items. */
export function requestPercent(items: ItemQuantities[]): number {
  const required = items.reduce((s, i) => s + i.quantityRequired, 0);
  if (required <= 0) return 0;
  const committed = items.reduce((s, i) => s + Math.min(i.quantityCommitted, i.quantityRequired), 0);
  return clampPercent((committed / required) * 100);
}

export function isFullyFulfilled(items: ItemQuantities[]): boolean {
  return items.length > 0 && items.every((i) => i.quantityCommitted >= i.quantityRequired);
}

export function fulfillmentStage(items: ItemQuantities[]): FulfillmentStage {
  if (isFullyFulfilled(items)) return "FULFILLED";
  const pct = requestPercent(items);
  if (pct >= 75) return "ALMOST_COMPLETE";
  if (pct > 0) return "PARTIALLY_FULFILLED";
  return "JUST_POSTED";
}

export function totals(items: ItemQuantities[]) {
  const required = items.reduce((s, i) => s + i.quantityRequired, 0);
  const committed = items.reduce((s, i) => s + Math.min(i.quantityCommitted, i.quantityRequired), 0);
  const received = items.reduce((s, i) => s + (i.quantityReceived ?? 0), 0);
  return { required, committed, received, remaining: required - committed };
}

/**
 * Validate a requested commitment against current quantities (used for fast
 * feedback; the authoritative check is the atomic SQL update).
 */
export function validateCommitment(item: ItemQuantities, quantity: number): { ok: true } | { ok: false; reason: string } {
  if (!Number.isInteger(quantity) || quantity < 1) return { ok: false, reason: "Quantity must be a whole number of at least 1." };
  const left = remaining(item);
  if (left === 0) return { ok: false, reason: "This item has already been fully committed." };
  if (quantity > left) return { ok: false, reason: `Only ${left} more ${left === 1 ? "is" : "are"} needed.` };
  return { ok: true };
}

function clampPercent(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}
