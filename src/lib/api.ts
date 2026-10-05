import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { ZodError, type ZodTypeAny, type z } from "zod";
import { Prisma, type Permission, type Role } from "@prisma/client";
import { AppError, newErrorId } from "./errors";
import { resolveSession, sessionCookieName, type SessionUser } from "./auth/session";
import { assertAuthenticated, assertPermission, assertRole } from "./auth/guards";
import { rateLimit, RATE_LIMITS } from "./rate-limit";
import { env } from "./env";

type RouteParams = Record<string, string>;

export interface ApiContext<P extends RouteParams = RouteParams> {
  user: SessionUser | null;
  params: P;
  ip: string;
}

export interface AuthedApiContext<P extends RouteParams = RouteParams> extends ApiContext<P> {
  user: SessionUser;
}

interface RouteOptions {
  /** Require an authenticated user. Implied by roles / permission. */
  auth?: boolean;
  roles?: Role[];
  permission?: Permission;
  rateLimit?: keyof typeof RATE_LIMITS;
}

const MAX_JSON_BYTES = 100 * 1024;

export function clientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim();
  return req.headers.get("x-real-ip") || "unknown";
}

/**
 * CSRF defence for cookie-authenticated mutations: browsers always send an
 * Origin header on cross-site POST/PUT/PATCH/DELETE, so a mismatching Origin
 * (or Sec-Fetch-Site: cross-site) is rejected. SameSite=Lax cookies add a
 * second layer.
 */
export function assertSameOrigin(req: Request) {
  const method = req.method.toUpperCase();
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") return;
  const site = req.headers.get("sec-fetch-site");
  if (site === "cross-site") throw new AppError("FORBIDDEN", "Cross-site request blocked.");
  const origin = req.headers.get("origin");
  if (!origin) return;
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    throw new AppError("FORBIDDEN", "Cross-site request blocked.");
  }
  const allowed = new Set([host, safeHost(env.appUrl)].filter(Boolean));
  if (!allowed.has(originHost)) throw new AppError("FORBIDDEN", "Cross-site request blocked.");
}

function safeHost(url: string): string | null {
  try {
    return new URL(url).host;
  } catch {
    return null;
  }
}

export function jsonError(error: unknown): NextResponse {
  if (error instanceof AppError) {
    return NextResponse.json(
      { error: { code: error.code, message: error.message, details: error.details } },
      { status: error.status },
    );
  }
  if (error instanceof ZodError) {
    const fields: Record<string, string> = {};
    for (const issue of error.issues) {
      const key = issue.path.join(".") || "_";
      fields[key] ??= issue.message;
    }
    return NextResponse.json(
      { error: { code: "VALIDATION_FAILED", message: "Some details need attention.", details: { fields } } },
      { status: 422 },
    );
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    return NextResponse.json(
      { error: { code: "CONFLICT", message: "This already exists." } },
      { status: 409 },
    );
  }
  const errorId = newErrorId();
  // Log internally; never leak stack traces or internals to the client.
  console.error(`[${errorId}]`, error);
  return NextResponse.json(
    { error: { code: "INTERNAL", message: "Something didn't go as planned.", errorId } },
    { status: 500 },
  );
}

export function route<P extends RouteParams = RouteParams>(
  options: RouteOptions,
  handler: (req: NextRequest, ctx: ApiContext<P>) => Promise<Response>,
) {
  return async (req: NextRequest, routeCtx: { params: Promise<P> }) => {
    try {
      assertSameOrigin(req);
      const ip = clientIp(req);
      const user = await resolveSession(req.cookies.get(sessionCookieName())?.value);

      if (options.rateLimit) {
        const policy = RATE_LIMITS[options.rateLimit];
        const result = rateLimit(`${options.rateLimit}:${user?.id ?? ip}`, policy.limit, policy.windowMs);
        if (!result.allowed) {
          const res = jsonError(new AppError("RATE_LIMITED", "Too many attempts. Please wait a little and try again."));
          res.headers.set("Retry-After", String(result.retryAfterSeconds));
          return res;
        }
      }

      if (options.permission) assertPermission(user, options.permission);
      else if (options.roles) assertRole(user, options.roles);
      else if (options.auth) assertAuthenticated(user);

      const params = ((await routeCtx?.params) ?? {}) as P;
      const res = await handler(req, { user, params, ip });
      res.headers.set("Cache-Control", "no-store");
      return res;
    } catch (error) {
      return jsonError(error);
    }
  };
}

export async function parseJson<S extends ZodTypeAny>(req: Request, schema: S): Promise<z.infer<S>> {
  const length = Number(req.headers.get("content-length") || 0);
  if (length > MAX_JSON_BYTES) throw new AppError("BAD_REQUEST", "Request body is too large.");
  const type = req.headers.get("content-type") || "";
  if (!type.includes("application/json")) throw new AppError("BAD_REQUEST", "Expected a JSON request body.");
  let body: unknown;
  try {
    const text = await req.text();
    if (text.length > MAX_JSON_BYTES) throw new AppError("BAD_REQUEST", "Request body is too large.");
    body = text ? JSON.parse(text) : {};
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError("BAD_REQUEST", "The request body is not valid JSON.");
  }
  return schema.parse(body);
}

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json({ data }, init);
}
