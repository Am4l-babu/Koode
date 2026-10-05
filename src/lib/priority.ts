import type { Priority } from "@prisma/client";

/**
 * Request priority engine. The numeric score and its factors are internal —
 * donors only ever see the resulting Priority label.
 */
export interface PriorityInput {
  /** Urgency stated by the recipient. */
  statedUrgency: Priority;
  neededBy?: Date | null;
  peopleAffected?: number | null;
  /** 0..1 fraction of total quantity still needed. */
  remainingFraction: number;
  /** Whether the organisation is verified. */
  verified: boolean;
  now?: Date;
}

const URGENCY_POINTS: Record<Priority, number> = { CRITICAL: 40, HIGH: 28, MEDIUM: 16, NORMAL: 6 };

export function priorityScore(input: PriorityInput): number {
  const now = input.now ?? new Date();
  let score = URGENCY_POINTS[input.statedUrgency];

  if (input.neededBy) {
    const days = (input.neededBy.getTime() - now.getTime()) / 86_400_000;
    if (days <= 3) score += 25;
    else if (days <= 7) score += 18;
    else if (days <= 14) score += 12;
    else if (days <= 30) score += 6;
  }

  const people = input.peopleAffected ?? 0;
  if (people >= 100) score += 15;
  else if (people >= 40) score += 10;
  else if (people >= 10) score += 5;

  score += Math.round(Math.max(0, Math.min(1, input.remainingFraction)) * 10);
  score += input.verified ? 10 : 0;

  return Math.max(0, Math.min(100, score));
}

export function priorityFromScore(score: number): Priority {
  if (score >= 70) return "CRITICAL";
  if (score >= 50) return "HIGH";
  if (score >= 30) return "MEDIUM";
  return "NORMAL";
}

export function suggestPriority(input: PriorityInput): { score: number; priority: Priority } {
  const score = priorityScore(input);
  return { score, priority: priorityFromScore(score) };
}
