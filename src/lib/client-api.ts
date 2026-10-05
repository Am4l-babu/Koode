/** Minimal typed fetch helper for client components. */
export interface ApiErrorShape {
  code: string;
  message: string;
  details?: { fields?: Record<string, string>; [key: string]: unknown };
  errorId?: string;
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly body: ApiErrorShape,
  ) {
    super(body.message);
  }
  get fields(): Record<string, string> {
    return this.body.details?.fields ?? {};
  }
}

export async function api<T = unknown>(url: string, init: { method?: string; body?: unknown; formData?: FormData } = {}): Promise<T> {
  const res = await fetch(url, {
    method: init.method ?? (init.body || init.formData ? "POST" : "GET"),
    headers: init.formData ? undefined : { "Content-Type": "application/json" },
    body: init.formData ?? (init.body !== undefined ? JSON.stringify(init.body) : undefined),
    credentials: "same-origin",
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    throw new ApiError(res.status, json?.error ?? { code: "INTERNAL", message: "Something didn't go as planned." });
  }
  return (json?.data ?? json) as T;
}
