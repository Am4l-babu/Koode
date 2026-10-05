import { ok, parseJson, route } from "@/lib/api";
import { browseRequests, createRequest } from "@/services/requests";
import { parseBrowseParams } from "@/lib/validation/browse";
import { createRequestSchema } from "@/lib/validation/request";

/** Public: browse verified, approved needs. Returns anonymised DTOs only. */
export const GET = route({}, async (req) => {
  const result = await browseRequests(parseBrowseParams(req.nextUrl.searchParams));
  return ok(result);
});

/** Recipient: create a request (enters PENDING_VERIFICATION). */
export const POST = route({ roles: ["RECIPIENT"], rateLimit: "requestCreate" }, async (req, { user }) => {
  const input = await parseJson(req, createRequestSchema);
  return ok(await createRequest(user!, input), { status: 201 });
});
