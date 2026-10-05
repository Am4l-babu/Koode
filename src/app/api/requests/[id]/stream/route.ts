import { route } from "@/lib/api";
import { sseResponse } from "@/lib/realtime";
import { getPublicRequest } from "@/services/requests";

export const dynamic = "force-dynamic";

/** Public live progress stream. Payloads contain counts only. */
export const GET = route<{ id: string }>({}, async (req, { params }) => {
  const need = await getPublicRequest(params.id.toUpperCase());
  return sseResponse(`request:${need.id}`, req.signal, {
    type: "progress",
    requestId: need.id,
    percent: need.percent,
    items: need.items.map((i) => ({ id: i.id, committed: i.committed, remaining: i.remaining })),
  });
});
