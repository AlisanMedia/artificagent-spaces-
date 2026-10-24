// @vitest-environment node
import { describe, it, expect } from "vitest";
import {
  mkdtemp,
  cp,
  writeFile,
  readFile,
  rm,
  symlink,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { verifyStudioAssets } from "../../scripts/verify-studio-assets";
import {
  PlatformError as legacyError,
  invariant as legacyInvariant,
} from "../../src/domain/platform";
import { PlatformError, invariant } from "../../src/domain/platform-errors";
async function fixture(fn: (folder: string) => Promise<void>) {
  const temp = await mkdtemp(join(tmpdir(), "spaces-v52-assets-"));
  try {
    await cp("public/studio-assets-v52", temp, { recursive: true });
    await fn(temp);
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
}
describe("immutable public UI supply chain", () => {
  it("accepts licensed fonts and real source-bound synthetic frame posters within budget", async () => {
    const v = await verifyStudioAssets();
    expect(v.fontBytes).toBeLessThan(163840);
    expect(v.posters).toBe(9);
    expect(v.manifest.remoteRuntimeDependencies).toBe(false);
  });
  it("fails closed on changed bytes and on unreviewed files", async () => {
    await fixture(async (f) => {
      await writeFile(join(f, "pov-portrait.webp"), "modified");
      await expect(verifyStudioAssets(process.cwd(), f)).rejects.toThrow(
        "VISUAL_ASSET_HASH_DRIFT",
      );
    });
    await fixture(async (f) => {
      await writeFile(join(f, "unknown.js"), "");
      await expect(verifyStudioAssets(process.cwd(), f)).rejects.toThrow(
        "UNREVIEWED_VISUAL_ASSET",
      );
    });
  });
  it("rejects symlinked assets even if target bytes match", async () => {
    await fixture(async (f) => {
      await rm(join(f, "ofl-manrope.txt"));
      await symlink(
        join(process.cwd(), "public/studio-assets-v52/ofl-manrope.txt"),
        join(f, "ofl-manrope.txt"),
      );
      await expect(verifyStudioAssets(process.cwd(), f)).rejects.toThrow(
        "VISUAL_ASSET_FILE_ONLY",
      );
    });
  });
  it("rejects source drift and invented glyph/rights declarations", async () => {
    await fixture(async (f) => {
      const m = JSON.parse(await readFile(join(f, "manifest.json"), "utf8"));
      delete m.files.find((a: { kind: string }) => a.kind === "VIDEO_POSTER")
        .rights;
      await writeFile(join(f, "manifest.json"), JSON.stringify(m));
      await expect(verifyStudioAssets(process.cwd(), f)).rejects.toThrow(
        "POSTER_SOURCE_NOT_APPROVED",
      );
    });
    await fixture(async (f) => {
      const m = JSON.parse(await readFile(join(f, "manifest.json"), "utf8"));
      m.files.find(
        (a: { kind: string }) => a.kind === "VIDEO_POSTER",
      ).sourceSha256 = "0".repeat(64);
      await writeFile(join(f, "manifest.json"), JSON.stringify(m));
      await expect(verifyStudioAssets(process.cwd(), f)).rejects.toThrow(
        "POSTER_SOURCE_DRIFT",
      );
    });
    await fixture(async (f) => {
      const m = JSON.parse(await readFile(join(f, "manifest.json"), "utf8"));
      m.fonts[0].glyphCodepoints = [];
      await writeFile(join(f, "manifest.json"), JSON.stringify(m));
      await expect(verifyStudioAssets(process.cwd(), f)).rejects.toThrow(
        "TURKISH_GLYPH_MISSING",
      );
    });
  });
  it("preserves domain error constructor identity and denial behavior after browser-only import split", () => {
    expect(legacyError).toBe(PlatformError);
    expect(legacyInvariant).toBe(invariant);
    try {
      legacyInvariant(false, "ROLE_DENIED");
      throw Error("missing denial");
    } catch (e) {
      expect(e).toBeInstanceOf(PlatformError);
      expect((e as PlatformError).message).toBe("ROLE_DENIED");
    }
  });
});
