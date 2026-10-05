import "server-only";
import { EventEmitter } from "node:events";

/**
 * In-process pub/sub feeding Server-Sent Event streams.
 * Single-instance deployments work as-is; for horizontal scaling replace the
 * emitter with Postgres LISTEN/NOTIFY or Redis pub/sub behind this interface.
 *
 * Payloads published here must be safe for their audience — request channels
 * are public, so only counts are ever published on them.
 */
export interface RequestProgressEvent {
  type: "progress";
  requestId: string;
  percent: number;
  items: { id: string; committed: number; remaining: number }[];
}

export interface UserEvent {
  type: "notification";
  unread: number;
}

const g = globalThis as unknown as { __realtime?: EventEmitter };
const bus = g.__realtime ?? new EventEmitter();
bus.setMaxListeners(10_000);
g.__realtime = bus;

export function publishRequestProgress(event: RequestProgressEvent) {
  bus.emit(`request:${event.requestId}`, event);
}

export function publishUserEvent(userId: string, event: UserEvent) {
  bus.emit(`user:${userId}`, event);
}

export function subscribe<T>(channel: string, listener: (event: T) => void): () => void {
  bus.on(channel, listener);
  return () => bus.off(channel, listener);
}

/** Build an SSE Response that relays a channel until the client disconnects. */
export function sseResponse<T>(channel: string, signal: AbortSignal, initial?: T): Response {
  const encoder = new TextEncoder();
  let cleanup = () => {};
  const stream = new ReadableStream({
    start(controller) {
      const send = (data: unknown) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      if (initial !== undefined) send(initial);
      const unsubscribe = subscribe<T>(channel, send);
      const ping = setInterval(() => controller.enqueue(encoder.encode(`: ping\n\n`)), 25_000);
      cleanup = () => {
        clearInterval(ping);
        unsubscribe();
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      };
      signal.addEventListener("abort", cleanup);
    },
    cancel() {
      cleanup();
    },
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
