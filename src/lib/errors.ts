import { randomCode } from "./ids";

export type ErrorCode =
  | "BAD_REQUEST"
  | "VALIDATION_FAILED"
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "RATE_LIMITED"
  | "INSUFFICIENT_QUANTITY"
  | "INTERNAL";

const STATUS: Record<ErrorCode, number> = {
  BAD_REQUEST: 400,
  VALIDATION_FAILED: 422,
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  RATE_LIMITED: 429,
  INSUFFICIENT_QUANTITY: 409,
  INTERNAL: 500,
};

/** An error whose message is safe to show to the end user. */
export class AppError extends Error {
  readonly status: number;
  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "AppError";
    this.status = STATUS[code];
  }
}

export const notFound = (what = "This item") => new AppError("NOT_FOUND", `${what} could not be found.`);
export const forbidden = (message = "You do not have access to this.") => new AppError("FORBIDDEN", message);
export const unauthenticated = () => new AppError("UNAUTHENTICATED", "Please sign in to continue.");

export function newErrorId(): string {
  return `ERR-${randomCode(6)}`;
}
