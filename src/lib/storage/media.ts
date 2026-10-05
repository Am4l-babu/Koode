import "server-only";
import sharp from "sharp";
import { AppError } from "../errors";

/**
 * Donor photos & short videos of the items they intend to give.
 *
 * Privacy rules enforced here:
 *  - Type is decided by magic bytes, never by the client-declared MIME type or filename.
 *  - Images are fully decoded and re-encoded, which drops EXIF (GPS, device, timestamps),
 *    XMP and any appended payload. Orientation is baked in first.
 *  - Videos cannot be re-encoded safely without a transcoder, so they are held for
 *    moderator approval before the recipient may see them.
 */
export const MAX_IMAGE_INPUT_BYTES = 8 * 1024 * 1024;
export const MAX_VIDEO_BYTES = 25 * 1024 * 1024;
export const MAX_IMAGES_PER_DONATION = 5;
export const MAX_VIDEOS_PER_DONATION = 1;
/** A multipart request carries a little overhead beyond the file itself. */
export const MAX_MEDIA_REQUEST_BYTES = MAX_VIDEO_BYTES + 256 * 1024;

const IMAGE_MAX_EDGE = 1600;
const MAX_INPUT_PIXELS = 40_000_000;

export type MediaSniff = { kind: "IMAGE"; mime: string } | { kind: "VIDEO"; mime: string; ext: string };

export function sniffMedia(b: Buffer): MediaSniff | null {
  if (b.length < 12) return null;
  const isJpeg = b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
  const isPng = b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  const isWebp = b.subarray(0, 4).toString("latin1") === "RIFF" && b.subarray(8, 12).toString("latin1") === "WEBP";
  if (isJpeg || isPng || isWebp) return { kind: "IMAGE", mime: isJpeg ? "image/jpeg" : isPng ? "image/png" : "image/webp" };
  // MP4 / MOV family: "ftyp" box at offset 4.
  if (b.subarray(4, 8).toString("latin1") === "ftyp") {
    const brand = b.subarray(8, 12).toString("latin1");
    return { kind: "VIDEO", mime: brand.startsWith("qt") ? "video/quicktime" : "video/mp4", ext: brand.startsWith("qt") ? "mov" : "mp4" };
  }
  // WebM / Matroska: EBML header.
  if (b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3) return { kind: "VIDEO", mime: "video/webm", ext: "webm" };
  return null;
}

export interface ProcessedMedia {
  kind: "IMAGE" | "VIDEO";
  buffer: Buffer;
  mime: string;
  ext: string;
}

export async function processMedia(input: Buffer): Promise<ProcessedMedia> {
  if (input.length === 0) throw new AppError("BAD_REQUEST", "The file is empty.");
  const sniff = sniffMedia(input);
  if (!sniff) throw new AppError("BAD_REQUEST", "Upload a JPEG, PNG or WEBP photo, or an MP4, MOV or WEBM video.");

  if (sniff.kind === "VIDEO") {
    if (input.length > MAX_VIDEO_BYTES) throw new AppError("BAD_REQUEST", "Videos must be 25 MB or smaller.");
    return { kind: "VIDEO", buffer: input, mime: sniff.mime, ext: sniff.ext };
  }

  if (input.length > MAX_IMAGE_INPUT_BYTES) throw new AppError("BAD_REQUEST", "Photos must be 8 MB or smaller.");
  try {
    const out = await sharp(input, { limitInputPixels: MAX_INPUT_PIXELS, failOn: "error" })
      .rotate() // apply EXIF orientation, then metadata is dropped on output
      .resize({ width: IMAGE_MAX_EDGE, height: IMAGE_MAX_EDGE, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer();
    return { kind: "IMAGE", buffer: out, mime: "image/webp", ext: "webp" };
  } catch {
    throw new AppError("BAD_REQUEST", "That photo couldn't be read. Try a different file.");
  }
}
