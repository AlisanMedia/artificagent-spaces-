import {
  createHmac,
  createHash,
  randomBytes,
  timingSafeEqual,
  createCipheriv,
  createDecipheriv,
} from "node:crypto";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { invariant, PlatformError, Id } from "@/domain/platform";

export const digest = (value: string | Uint8Array) =>
  createHash("sha256").update(value).digest("hex");
export const newId = () => crypto.randomUUID();
export interface Grant {
  purpose: "upload" | "asset" | "output" | "publication" | "visitor" | "voice";
  organizationId: string;
  propertyId: string;
  revision: number;
  resourceId: string;
  sessionId: string;
  expiresAt: number;
  nonce: string;
}
export class Secrets {
  constructor(private readonly key: Uint8Array) {
    invariant(key.byteLength >= 32, "INVALID_SIGNING_KEY");
  }
  static ephemeral() {
    return new Secrets(randomBytes(32));
  }
  static async local(root: string) {
    await mkdir(root, { recursive: true, mode: 0o700 });
    const path = join(root, "session-signing.key");
    try {
      return new Secrets(await readFile(path));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
    const key = randomBytes(32);
    try {
      await writeFile(path, key, { flag: "wx", mode: 0o600 });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      return new Secrets(await readFile(path));
    }
    return new Secrets(key);
  }
  sign(grant: Grant) {
    const payload = Buffer.from(JSON.stringify(grant)).toString("base64url");
    return payload + "." + this.mac(payload);
  }
  verify(token: string, purpose: Grant["purpose"], now = Date.now()): Grant {
    invariant(token.length < 3000, "INVALID_GRANT", 403);
    const parts = token.split(".");
    invariant(parts.length === 2 && parts[0] && parts[1], "INVALID_GRANT", 403);
    const actual = Buffer.from(parts[1]),
      expected = Buffer.from(this.mac(parts[0]));
    invariant(
      actual.length === expected.length && timingSafeEqual(actual, expected),
      "INVALID_GRANT",
      403,
    );
    let grant: Grant;
    try {
      grant = JSON.parse(
        Buffer.from(parts[0], "base64url").toString(),
      ) as Grant;
    } catch {
      throw new PlatformError("INVALID_GRANT", 403);
    }
    invariant(
      grant.purpose === purpose &&
        Number.isSafeInteger(grant.expiresAt) &&
        grant.expiresAt > now &&
        grant.expiresAt <= now + 86_400_000,
      "EXPIRED_OR_WRONG_GRANT",
      403,
    );
    invariant(
      Id.safeParse(grant.resourceId).success &&
        Id.safeParse(grant.organizationId).success &&
        Id.safeParse(grant.propertyId).success &&
        Number.isSafeInteger(grant.revision) &&
        grant.revision > 0 &&
        typeof grant.nonce === "string" &&
        typeof grant.sessionId === "string",
      "INVALID_GRANT",
      403,
    );
    return grant;
  }
  tenant(organizationId: string) {
    Id.parse(organizationId);
    return new Secrets(
      createHmac("sha256", this.key)
        .update("tenant-v1:" + organizationId)
        .digest(),
    );
  }
  mac(value: string) {
    return createHmac("sha256", this.key).update(value).digest("hex");
  }
  verifyWebhook(body: string, header: string, now = Date.now()) {
    const entries = new Map(
      header.split(",").map((x) => {
        const i = x.indexOf("=");
        return [x.slice(0, i).trim(), x.slice(i + 1)];
      }),
    );
    const stamp = entries.get("t"),
      signature = entries.get("v0");
    invariant(
      stamp &&
        /^\d+$/.test(stamp) &&
        signature &&
        /^[a-f0-9]{64}$/.test(signature),
      "INVALID_WEBHOOK_SIGNATURE",
      401,
    );
    invariant(
      Math.abs(now / 1000 - Number(stamp)) <= 300,
      "STALE_WEBHOOK",
      401,
    );
    const expected = this.mac(stamp + "." + body);
    invariant(
      timingSafeEqual(Buffer.from(signature), Buffer.from(expected)),
      "INVALID_WEBHOOK_SIGNATURE",
      401,
    );
  }
  encrypt(value: string) {
    const iv = randomBytes(12);
    const key = createHash("sha256")
      .update(this.key)
      .update("lead-encryption-v1")
      .digest();
    const cipher = createCipheriv("aes-256-gcm", key, iv);
    const ciphertext = Buffer.concat([
      cipher.update(value, "utf8"),
      cipher.final(),
    ]);
    return Buffer.concat([iv, cipher.getAuthTag(), ciphertext]).toString(
      "base64url",
    );
  }
  decrypt(value: string) {
    const b = Buffer.from(value, "base64url");
    const key = createHash("sha256")
      .update(this.key)
      .update("lead-encryption-v1")
      .digest();
    const cipher = createDecipheriv("aes-256-gcm", key, b.subarray(0, 12));
    cipher.setAuthTag(b.subarray(12, 28));
    return Buffer.concat([
      cipher.update(b.subarray(28)),
      cipher.final(),
    ]).toString("utf8");
  }
}
