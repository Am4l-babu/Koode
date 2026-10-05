import { afterEach, describe, expect, it } from "vitest";
import sharp from "sharp";
import { deletePrivateObject, getPrivateObject, putPrivateObject } from "@/lib/storage";
import { processMedia } from "@/lib/storage/media";

const keys: string[] = [];
afterEach(async () => {
  while (keys.length) await deletePrivateObject(keys.pop()!);
});

const mp4 = () => Buffer.concat([Buffer.from([0, 0, 0, 24]), Buffer.from("ftypisom"), Buffer.alloc(64)]);

describe("donation media", () => {
  it("stores and reads back an mp4 (extensions may contain digits)", async () => {
    const processed = await processMedia(mp4());
    expect(processed).toMatchObject({ kind: "VIDEO", ext: "mp4", mime: "video/mp4" });
    const { key } = await putPrivateObject(processed.buffer, processed.ext);
    keys.push(key);
    expect((await getPrivateObject(key)).equals(processed.buffer)).toBe(true);
  });

  it("re-encodes photos to webp and strips metadata", async () => {
    const jpg = await sharp({ create: { width: 64, height: 64, channels: 3, background: "#369" } }).jpeg().withExif({ IFD0: { Copyright: "secret" } }).toBuffer();
    const out = await processMedia(jpg);
    expect(out).toMatchObject({ kind: "IMAGE", ext: "webp", mime: "image/webp" });
    expect((await sharp(out.buffer).metadata()).exif).toBeUndefined();
  });

  it("rejects files that are not photos or videos", async () => {
    await expect(processMedia(Buffer.from("%PDF-1.7 not media"))).rejects.toThrow(/JPEG, PNG or WEBP/);
    await expect(processMedia(Buffer.alloc(0))).rejects.toThrow(/empty/);
  });
});
