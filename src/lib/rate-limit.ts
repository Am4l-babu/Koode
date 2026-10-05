/**
 * Fixed-window in-memory rate limiter. Good for a single instance; for
 * multi-instance deployments swap the store for Redis/Upstash (same interface).
 */
interface Bucket {
  count: number;
  resetAt: number;
}

const store = new Map<string, Bucket>();

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

export function rateLimit(key: string, limit: number, windowMs: number, now = Date.now()): RateLimitResult {
  if (process.env.DISABLE_RATE_LIMIT === "true") return { allowed: true, remaining: limit, retryAfterSeconds: 0 };
  const bucket = store.get(key);
  if (!bucket || bucket.resetAt <= now) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    sweep(now);
    return { allowed: true, remaining: limit - 1, retryAfterSeconds: 0 };
  }
  bucket.count += 1;
  const allowed = bucket.count <= limit;
  return {
    allowed,
    remaining: Math.max(0, limit - bucket.count),
    retryAfterSeconds: allowed ? 0 : Math.ceil((bucket.resetAt - now) / 1000),
  };
}

let lastSweep = 0;
function sweep(now: number) {
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  for (const [key, bucket] of store) if (bucket.resetAt <= now) store.delete(key);
}

export function resetRateLimits() {
  store.clear();
}

/** Named policies so limits are defined in one place. */
export const RATE_LIMITS = {
  login: { limit: 10, windowMs: 15 * 60_000 },
  register: { limit: 5, windowMs: 60 * 60_000 },
  passwordReset: { limit: 5, windowMs: 60 * 60_000 },
  otp: { limit: 5, windowMs: 15 * 60_000 },
  donation: { limit: 20, windowMs: 60 * 60_000 },
  requestCreate: { limit: 10, windowMs: 60 * 60_000 },
  report: { limit: 10, windowMs: 60 * 60_000 },
  upload: { limit: 20, windowMs: 60 * 60_000 },
  media: { limit: 60, windowMs: 60 * 60_000 },
  mutation: { limit: 120, windowMs: 60_000 },
} as const;
