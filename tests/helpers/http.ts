import { NextRequest } from "next/server";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Handler = (req: NextRequest, ctx: { params: Promise<any> }) => Promise<Response>;

export interface CallOptions {
  method?: string;
  path?: string;
  body?: unknown;
  token?: string;
  params?: Record<string, string>;
  headers?: Record<string, string>;
  formData?: FormData;
}

/** Invoke a Next.js route handler exactly as the server would. */
export async function call(handler: Handler, opts: CallOptions = {}) {
  const headers = new Headers(opts.headers);
  if (opts.token) headers.set("cookie", `sb_session=${opts.token}`);
  let body: BodyInit | undefined;
  if (opts.formData) body = opts.formData;
  else if (opts.body !== undefined) {
    headers.set("content-type", "application/json");
    body = JSON.stringify(opts.body);
  }
  const req = new NextRequest(new URL(opts.path ?? "/api/test", "http://localhost:3000"), { method: opts.method ?? (body ? "POST" : "GET"), headers, body });
  const res = await handler(req, { params: Promise.resolve(opts.params ?? {}) });
  const text = await res.text();
  let json: unknown = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* non-JSON (e.g. SSE / file) */
  }
  // Response bodies are asserted structurally in tests.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { status: res.status, json: json as { data?: any; error?: any }, text, headers: res.headers };
}

/** Assert that none of the given sensitive strings appear anywhere in a payload. */
export function leaks(payload: string, secrets: string[]): string[] {
  const lower = payload.toLowerCase();
  return secrets.filter((s) => s && lower.includes(s.toLowerCase()));
}
