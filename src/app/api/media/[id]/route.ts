import { route } from "@/lib/api";
import { uuidSchema } from "@/lib/validation/common";
import { streamPrivateObject } from "@/lib/storage";
import { getMediaFile } from "@/services/donation-media";

const HEADERS = {
  "Cache-Control": "private, no-store",
  "X-Content-Type-Options": "nosniff",
  // These files are only ever shown as <img>/<video>; never as a document.
  "Content-Security-Policy": "default-src 'none'; sandbox",
  "Content-Disposition": "inline",
  "Cross-Origin-Resource-Policy": "same-origin",
  "Accept-Ranges": "bytes",
};

/**
 * Permission-checked media download. There is no public URL for these files;
 * access follows getMediaFile() (donor owner, addressed organisation once
 * approved, or an administrator who can moderate donations).
 * Supports byte ranges so videos can be scrubbed.
 */
export const GET = route<{ id: string }>({ auth: true }, async (req, { user, params }) => {
  const { storageKey, size: total, mimeType } = await getMediaFile(user!, uuidSchema.parse(params.id));
  const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.get("range") ?? "");
  if (range && (range[1] || range[2])) {
    let start = range[1] ? Number(range[1]) : Math.max(0, total - Number(range[2]));
    let end = range[1] && range[2] ? Number(range[2]) : total - 1;
    end = Math.min(end, total - 1);
    if (start > end || start >= total) {
      return new Response(null, { status: 416, headers: { ...HEADERS, "Content-Range": `bytes */${total}` } });
    }
    start = Math.max(0, start);
    return new Response(streamPrivateObject(storageKey, start, end), {
      status: 206,
      headers: { ...HEADERS, "Content-Type": mimeType, "Content-Range": `bytes ${start}-${end}/${total}`, "Content-Length": String(end - start + 1) },
    });
  }
  if (total === 0) return new Response(null, { headers: { ...HEADERS, "Content-Type": mimeType, "Content-Length": "0" } });
  return new Response(streamPrivateObject(storageKey, 0, total - 1), { headers: { ...HEADERS, "Content-Type": mimeType, "Content-Length": String(total) } });
});
