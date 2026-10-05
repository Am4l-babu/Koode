import { ok, route } from "@/lib/api";
import { AppError } from "@/lib/errors";
import { MAX_MEDIA_REQUEST_BYTES } from "@/lib/storage/media";
import { addDonationMedia, listDonorMedia } from "@/services/donation-media";

export const GET = route<{ id: string }>({ roles: ["DONOR"] }, async (_req, { user, params }) =>
  ok(await listDonorMedia(user!, params.id.toUpperCase())),
);

/** Add one photo or short video to one of the donor's own donations. */
export const POST = route<{ id: string }>({ roles: ["DONOR"], rateLimit: "media" }, async (req, { user, params }) => {
  const length = Number(req.headers.get("content-length") || 0);
  if (length > MAX_MEDIA_REQUEST_BYTES) throw new AppError("BAD_REQUEST", "That file is too large. Photos can be up to 8 MB and videos up to 25 MB.");
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) throw new AppError("BAD_REQUEST", "Choose a photo or video to upload.");
  // The client-supplied name and type are ignored; the file's own bytes decide.
  const buffer = Buffer.from(await file.arrayBuffer());
  return ok(await addDonationMedia(user!, params.id.toUpperCase(), buffer), { status: 201 });
});
