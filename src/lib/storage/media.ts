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
 *  - MP4/MOV videos have their metadata boxes (GPS location, device, XMP) wiped in
 *    place. Videos still can't be re-encoded without a transcoder, so they are held
 *    for moderator approval before the recipient may see them.
 */
export const MAX_IMAGE_INPUT_BYTES = 8 * 1024 * 1024;
export const MAX_VIDEO_BYTES = 25 * 1024 * 1024;
export const MAX_IMAGES_PER_DONATION = 5;
export const MAX_VIDEOS_PER_DONATION = 1;
/** A multipart request carries a little overhead beyond the file itself. */
export const MAX_MEDIA_REQUEST_BYTES = MAX_VIDEO_BYTES + 256 * 1024;

const IMAGE_MAX_EDGE = 1600;
const MAX_INPUT_PIXELS = 40_000_000;

export type MediaSniff = { kind: "IMAGE"; mime: string } | { kind: "VIDEO"; mime: string; ext: string } | { kind: "HEIF" };

/** ISO base media brands that mean "still image" rather than video. */
const AVIF_BRANDS = new Set(["avif", "avis"]);
const HEIF_BRANDS = new Set(["heic", "heix", "hevc", "hevx", "heim", "heis", "hevm", "hevs", "mif1", "msf1"]);

/** The major and compatible brands of an "ftyp" box, or null if the file doesn't start with one. */
function ftypBrands(b: Buffer): string[] | null {
  if (b.subarray(4, 8).toString("latin1") !== "ftyp") return null;
  const end = Math.min(b.readUInt32BE(0), b.length, 256);
  const brands = [b.subarray(8, 12).toString("latin1")];
  for (let p = 16; p + 4 <= end; p += 4) brands.push(b.subarray(p, p + 4).toString("latin1"));
  return brands;
}

export function sniffMedia(b: Buffer): MediaSniff | null {
  if (b.length < 12) return null;
  const isJpeg = b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
  const isPng = b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  const isWebp = b.subarray(0, 4).toString("latin1") === "RIFF" && b.subarray(8, 12).toString("latin1") === "WEBP";
  if (isJpeg || isPng || isWebp) return { kind: "IMAGE", mime: isJpeg ? "image/jpeg" : isPng ? "image/png" : "image/webp" };
  // ISO base media ("ftyp" box at offset 4): AVIF/HEIC photos share it with MP4/MOV video.
  const brands = ftypBrands(b);
  if (brands) {
    if (brands.some((x) => AVIF_BRANDS.has(x))) return { kind: "IMAGE", mime: "image/avif" };
    if (brands.some((x) => HEIF_BRANDS.has(x))) return { kind: "HEIF" };
    const quicktime = brands[0]!.startsWith("qt");
    return { kind: "VIDEO", mime: quicktime ? "video/quicktime" : "video/mp4", ext: quicktime ? "mov" : "mp4" };
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
  if (sniff.kind === "HEIF") {
    throw new AppError("BAD_REQUEST", "HEIC photos aren't supported yet. Please upload a JPEG or PNG — on iPhone, choose “Most Compatible” under Settings → Camera → Formats.");
  }

  if (sniff.kind === "VIDEO") {
    if (input.length > MAX_VIDEO_BYTES) throw new AppError("BAD_REQUEST", "Videos must be 25 MB or smaller.");
    const buffer = sniff.ext === "webm" ? input : stripIsoMetadata(Buffer.from(input));
    return { kind: "VIDEO", buffer, mime: sniff.mime, ext: sniff.ext };
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

/** Boxes that only hold descriptive metadata: user data, iTunes/QuickTime metadata, XMP. */
const METADATA_BOXES = new Set(["udta", "meta", "uuid"]);
/** Boxes whose children are walked to find metadata. */
const CONTAINER_BOXES = new Set(["moov", "trak"]);

/**
 * Wipe metadata from an MP4/MOV file in place: each metadata box (at the top
 * level, in moov, or in a track) is renamed to "free" and its contents zeroed.
 * Sizes and offsets are unchanged, so the media itself still plays. This is
 * where phones keep GPS location (©xyz, com.apple.quicktime.location), device
 * make/model and XMP.
 */
export function stripIsoMetadata(b: Buffer): Buffer {
  wipeBoxes(b, 0, b.length, 0);
  return b;
}

function wipeBoxes(b: Buffer, start: number, end: number, depth: number) {
  let p = start;
  while (p + 8 <= end) {
    let size = b.readUInt32BE(p);
    const type = b.toString("latin1", p + 4, p + 8);
    let header = 8;
    if (size === 1) {
      if (p + 16 > end) return;
      const large = b.readBigUInt64BE(p + 8);
      if (large > BigInt(end - p)) return;
      size = Number(large);
      header = 16;
    } else if (size === 0) size = end - p;
    if (size < header || p + size > end) return;
    if (METADATA_BOXES.has(type)) {
      b.write("free", p + 4, "latin1");
      b.fill(0, p + header, p + size);
    } else if (CONTAINER_BOXES.has(type) && depth < 4) {
      wipeBoxes(b, p + header, p + size, depth + 1);
    }
    p += size;
  }
}
