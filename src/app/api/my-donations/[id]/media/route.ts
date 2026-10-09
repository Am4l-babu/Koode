import { ok, route } from "@/lib/api";
import { AppError } from "@/lib/errors";
import { MAX_MEDIA_REQUEST_BYTES } from "@/lib/storage/media";
import { addDonationMedia, listDonorMedia } from "@/services/donation-media";

export const GET = route<{ id: string }>({ roles: ["DONOR"] }, async (_req, { user, params }) =>
  ok(await listDonorMedia(user!, params.id.toUpperCase())),
);

const TOO_LARGE = "That file is too large. Photos can be up to 8 MB and videos up to 25 MB.";

/**
 * Read the request body, giving up as soon as it passes `max` bytes. The
 * Content-Length header can be missing (chunked) or wrong, so it isn't trusted.
 */
async function readBodyCapped(req: Request, max: number): Promise<Uint8Array<ArrayBuffer>> {
  if (Number(req.headers.get("content-length") || 0) > max) throw new AppError("BAD_REQUEST", TOO_LARGE);
  if (!req.body) return new Uint8Array();
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > max) {
      await reader.cancel();
      throw new AppError("BAD_REQUEST", TOO_LARGE);
    }
    chunks.push(value);
  }
  const body = new Uint8Array(new ArrayBuffer(total));
  let offset = 0;
  for (const c of chunks) {
    body.set(c, offset);
    offset += c.byteLength;
  }
  return body;
}

/** Add one photo or short video to one of the donor's own donations. */
export const POST = route<{ id: string }>({ roles: ["DONOR"], rateLimit: "media" }, async (req, { user, params }) => {
  const body = await readBodyCapped(req, MAX_MEDIA_REQUEST_BYTES);
  const form = await new Response(body, { headers: { "content-type": req.headers.get("content-type") ?? "" } }).formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) throw new AppError("BAD_REQUEST", "Choose a photo or video to upload.");
  // The client-supplied name and type are ignored; the file's own bytes decide.
  const buffer = Buffer.from(await file.arrayBuffer());
  return ok(await addDonationMedia(user!, params.id.toUpperCase(), buffer), { status: 201 });
});
