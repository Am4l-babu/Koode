import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { processMedia, sniffMedia, stripIsoMetadata } from "@/lib/storage/media";

/** Build an ISO-BMFF box: 32-bit size, 4-char type, payload. */
function box(type: string, ...children: Buffer[]): Buffer {
  const payload = Buffer.concat(children);
  const header = Buffer.alloc(8);
  header.writeUInt32BE(8 + payload.length);
  header.write(type, 4, "latin1");
  return Buffer.concat([header, payload]);
}

const ftyp = (major: string, ...compatible: string[]) => box("ftyp", Buffer.from(major, "latin1"), Buffer.alloc(4), Buffer.from(compatible.join(""), "latin1"));
const GPS = Buffer.from("+10.5276+076.2144/");
const DEVICE = Buffer.from("Apple iPhone 15");

function phoneVideo(major = "isom") {
  return Buffer.concat([
    ftyp(major, "isom", "mp41"),
    box(
      "moov",
      box("mvhd", Buffer.alloc(20)),
      box("udta", box("©xyz", GPS)),
      box("meta", Buffer.alloc(4), box("ilst", DEVICE)),
      box("trak", box("tkhd", Buffer.alloc(20)), box("udta", Buffer.from("track-note"))),
    ),
    box("uuid", Buffer.from("XMP<GPSLatitude>10.52</GPSLatitude>")),
    box("mdat", Buffer.from("FRAMEDATA-FRAMEDATA")),
  ]);
}

describe("video metadata is removed", () => {
  it("wipes location, device and XMP boxes without moving the media", () => {
    const input = phoneVideo();
    const out = stripIsoMetadata(Buffer.from(input));
    expect(out.length).toBe(input.length);
    for (const secret of [GPS, DEVICE, Buffer.from("track-note"), Buffer.from("GPSLatitude")]) expect(out.includes(secret)).toBe(false);
    // Structure and media are untouched: same ftyp, moov and mdat at the same offsets.
    expect(out.subarray(0, 24).equals(input.subarray(0, 24))).toBe(true);
    expect(out.indexOf("moov")).toBe(input.indexOf("moov"));
    expect(out.indexOf("mdat")).toBe(input.indexOf("mdat"));
    expect(out.includes(Buffer.from("FRAMEDATA-FRAMEDATA"))).toBe(true);
    expect(out.includes(Buffer.from("mvhd"))).toBe(true);
  });

  it("handles 64-bit box sizes", () => {
    const payload = Buffer.concat([GPS, Buffer.alloc(8)]);
    const big = Buffer.alloc(16);
    big.writeUInt32BE(1);
    big.write("udta", 4, "latin1");
    big.writeBigUInt64BE(BigInt(16 + payload.length), 8);
    const input = Buffer.concat([ftyp("isom"), box("moov", Buffer.concat([big, payload])), box("mdat", Buffer.from("x"))]);
    const out = stripIsoMetadata(Buffer.from(input));
    expect(out.includes(GPS)).toBe(false);
    expect(out.length).toBe(input.length);
  });

  it("ignores malformed sizes instead of throwing", () => {
    const broken = Buffer.concat([ftyp("isom"), Buffer.from([0xff, 0xff, 0xff, 0xff]), Buffer.from("moov"), GPS]);
    expect(() => stripIsoMetadata(Buffer.from(broken))).not.toThrow();
  });

  it("processMedia applies it to MP4 and MOV uploads", async () => {
    for (const major of ["isom", "qt  "]) {
      const out = await processMedia(phoneVideo(major));
      expect(out.kind).toBe("VIDEO");
      expect(out.buffer.includes(GPS)).toBe(false);
    }
  });
});

describe("ISO-BMFF photos are not mistaken for video", () => {
  it("re-encodes AVIF photos like other images", async () => {
    const avif = await sharp({ create: { width: 16, height: 16, channels: 3, background: "#369" } }).avif().toBuffer();
    expect(sniffMedia(avif)).toMatchObject({ kind: "IMAGE" });
    expect(await processMedia(avif)).toMatchObject({ kind: "IMAGE", mime: "image/webp" });
  });

  it("refuses HEIC photos with guidance instead of storing them as video", async () => {
    const heic = Buffer.concat([ftyp("heic", "mif1", "heic"), Buffer.alloc(64)]);
    expect(sniffMedia(heic)).toEqual({ kind: "HEIF" });
    await expect(processMedia(heic)).rejects.toThrow(/HEIC photos aren't supported/);
    const mif1Only = Buffer.concat([ftyp("mif1", "mif1"), Buffer.alloc(64)]);
    expect(sniffMedia(mif1Only)).toEqual({ kind: "HEIF" });
  });
});
