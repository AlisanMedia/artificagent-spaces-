import sharp from "sharp";
import { mkdir, readFile, writeFile, rename, stat } from "node:fs/promises";
import { join, resolve, sep } from "node:path";
import { Id, invariant } from "@/domain/platform";
import { digest } from "./crypto";

export class LocalPrivateStorage {
  constructor(readonly root: string) {}
  path(
    organizationId: string,
    id: string,
    kind: "source" | "quarantine" | "output",
    extension: "jpg" | "mp4" | "glb" | "json" = "jpg",
  ) {
    Id.parse(organizationId);
    Id.parse(id);
    const path = resolve(this.root, organizationId, kind, id + "." + extension);
    invariant(
      path.startsWith(resolve(this.root) + sep),
      "INVALID_STORAGE_PATH",
    );
    return path;
  }
  async put(path: string, bytes: Uint8Array) {
    invariant(
      path.startsWith(resolve(this.root) + sep),
      "INVALID_STORAGE_PATH",
    );
    await mkdir(resolve(path, ".."), { recursive: true, mode: 0o700 });
    await writeFile(path, bytes, { flag: "wx", mode: 0o600 });
  }
  async ingest(organizationId: string, assetId: string, bytes: Uint8Array) {
    invariant(
      bytes.byteLength > 0 && bytes.byteLength <= 5_242_880,
      "UPLOAD_SIZE_LIMIT",
      413,
    );
    const originalHash = digest(bytes);
    const quarantine = this.path(organizationId, assetId, "quarantine");
    await this.put(quarantine, bytes);
    invariant(
      !Buffer.from(bytes).includes(
        Buffer.from("EICAR-STANDARD-ANTIVIRUS-TEST-FILE"),
      ),
      "QUARANTINED_SIGNATURE",
      422,
    );
    const b = Buffer.from(bytes);
    invariant(
      (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) ||
        b
          .subarray(0, 8)
          .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) ||
        (b.subarray(0, 4).toString() === "RIFF" &&
          b.subarray(8, 12).toString() === "WEBP"),
      "UNSUPPORTED_MAGIC_BYTES",
      415,
    );
    const image = sharp(b, {
      limitInputPixels: 24_000_000,
      failOn: "warning",
      animated: false,
    });
    const metadata = await image.metadata();
    invariant(
      metadata.width &&
        metadata.height &&
        metadata.width >= 64 &&
        metadata.height >= 64 &&
        (metadata.pages ?? 1) === 1,
      "INVALID_IMAGE_DIMENSIONS",
      422,
    );
    const clean = await image
      .rotate()
      .resize({
        width: 1600,
        height: 1600,
        fit: "inside",
        withoutEnlargement: true,
      })
      .jpeg({ quality: 88 })
      .toBuffer();
    const sanitized = await sharp(clean).metadata();
    invariant(!sanitized.exif && !sanitized.xmp, "METADATA_STRIP_FAILED", 422);
    const path = this.path(organizationId, assetId, "source");
    await this.put(path, clean);
    return {
      originalHash,
      cleanHash: digest(clean),
      bytes: clean.byteLength,
      width: sanitized.width!,
      height: sanitized.height!,
      mime: "image/jpeg" as const,
    };
  }
  async read(
    organizationId: string,
    id: string,
    kind: "source" | "output",
    extension: "jpg" | "mp4" | "glb" | "json" = "jpg",
  ) {
    return readFile(this.path(organizationId, id, kind, extension));
  }
  async readVerified(
    organizationId: string,
    id: string,
    expectedHash: string,
    kind: "source" | "output",
    extension: "jpg" | "mp4" | "glb" | "json" = "jpg",
  ) {
    const bytes = await this.read(organizationId, id, kind, extension);
    invariant(digest(bytes) === expectedHash, "STORED_HASH_MISMATCH", 409);
    return bytes;
  }
  async finalizeOutput(
    organizationId: string,
    id: string,
    temporaryPath: string,
    extension: "mp4" | "glb" | "json",
  ) {
    const path = this.path(organizationId, id, "output", extension);
    await mkdir(join(this.root, organizationId, "output"), {
      recursive: true,
      mode: 0o700,
    });
    await rename(temporaryPath, path);
    const size = (await stat(path)).size;
    invariant(size > 0, "EMPTY_OUTPUT");
    return { bytes: size, hash: digest(await readFile(path)) };
  }
}
