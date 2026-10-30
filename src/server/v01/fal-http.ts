import { Agent, request as httpsRequest } from "node:https";
import { invariant } from "@/domain/platform";
import { digest } from "../crypto";
import { compileServiceProfile } from "../production/prompts";
import type { V01Authority } from "./authorization";
import {
  V01_SUBMIT_PATH,
  queuePath,
  validateQueueUrls,
  type V01Gateway,
} from "./gateway";

export function v01ResultUrl(input: string) {
  const url = new URL(input);
  invariant(
    url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      !url.port &&
      !url.hash &&
      ["v3b.fal.media", "v3.fal.media", "fal.media"].includes(url.hostname),
    "V01_OUTPUT_URL_DENIED",
    403,
  );
  return url;
}
/** Actual HTTP implementation; every operation reloads the independently signed, source-scoped permit BEFORE key/egress. No retries. */
export class FalV01Gateway implements V01Gateway {
  readonly mode = "fal-live-test" as const;
  constructor(
    readonly authority: V01Authority,
    readonly permitHash: string,
    readonly readSecret: () => Promise<string>,
    readonly expectedProviderId: string | null,
    readonly routes?: { status: string; result: string },
  ) {}
  private async permit() {
    const scope = await this.authority.load(Date.now());
    invariant(
      scope.payloadSha256 === this.permitHash &&
        scope.permit.mode === this.mode,
      "V01_OWNER_TEST_PERMISSION_REQUIRED",
      403,
    );
    return scope.permit;
  }
  async preflight() {
    await this.permit();
    const key = await this.readSecret();
    invariant(
      key.length > 0 && !/[\r\n]/.test(key),
      "V01_SERVER_SECRET_UNAVAILABLE",
      403,
    );
  }
  async submit(body: {
    start_image_url: string;
    prompt: string;
    duration: number;
    resolution: "1080p";
  }) {
    const p = await this.permit();
    const prefix = "data:image/jpeg;base64,";
    invariant(
      body.start_image_url.startsWith(prefix),
      "V01_INLINE_SOURCE_REQUIRED",
      403,
    );
    const bytes = Buffer.from(
      body.start_image_url.slice(prefix.length),
      "base64",
    );
    invariant(
      bytes.length <= p.maxSourceBytes &&
        digest(bytes) === p.sourceSha256 &&
        body.duration === p.durationSeconds &&
        body.resolution === "1080p" &&
        body.prompt ===
          compileServiceProfile("V01", {
            durationSeconds: p.durationSeconds,
            aspectRatio: p.aspectRatio,
          }).text,
      "V01_SOURCE_OR_PROFILE_DENIED",
      403,
    );
    return JSON.parse(
      (
        await this.send(
          new URL("https://queue.fal.run" + V01_SUBMIT_PATH),
          "POST",
          Buffer.from(JSON.stringify(body)),
          262_144,
          true,
        )
      ).toString(),
    );
  }
  private async operation(id: string, kind: "status" | "result") {
    await this.permit();
    invariant(id === this.expectedProviderId, "V01_PROVIDER_ID_MISMATCH", 403);
    return JSON.parse(
      (
        await this.send(
          new URL(
            this.routes
              ? validateQueueUrls(id, this.routes.status, this.routes.result)[
                  kind
                ]
              : "https://queue.fal.run" + queuePath(id, kind),
          ),
          "GET",
          null,
          262_144,
          true,
        )
      ).toString(),
    );
  }
  status(id: string) {
    return this.operation(id, "status");
  }
  result(id: string) {
    return this.operation(id, "result");
  }
  async download(input: string, maxBytes: number) {
    const p = await this.permit();
    invariant(maxBytes <= p.maxOutputBytes, "V01_OUTPUT_BYTE_LIMIT", 403);
    return this.send(v01ResultUrl(input), "GET", null, maxBytes, false);
  }
  private async send(
    url: URL,
    method: "GET" | "POST",
    body: Buffer | null,
    cap: number,
    credential: boolean,
  ): Promise<Buffer> {
    await this.permit();
    invariant(!body || body.length <= 7_100_000, "V01_REQUEST_BYTE_LIMIT", 413);
    const key = credential ? await this.readSecret() : "";
    invariant(
      !credential || (key.length > 0 && !/[\r\n]/.test(key)),
      "V01_SERVER_SECRET_UNAVAILABLE",
      403,
    );
    // Node24 proxyEnv preserves the managed proxy/CA policy. Never disable certificate verification.
    const agent = new Agent({ proxyEnv: process.env, keepAlive: false });
    return new Promise((resolve, reject) => {
      const req = httpsRequest(
        url,
        {
          agent,
          method,
          timeout: 20_000,
          headers: {
            ...(credential ? { authorization: "Key " + key } : {}),
            ...(body
              ? {
                  "content-type": "application/json",
                  "content-length": String(body.length),
                }
              : {}),
          },
        },
        (res) => {
          if (
            !res.statusCode ||
            res.statusCode < 200 ||
            res.statusCode >= 300 ||
            !res.headers["content-type"]
              ?.split(";")[0]
              ?.startsWith(credential ? "application/json" : "video/mp4") ||
            Number(res.headers["content-length"] ?? 0) > cap
          ) {
            res.destroy();
            req.destroy(new Error("V01_PROVIDER_RESPONSE_DENIED"));
            return;
          }
          const chunks: Buffer[] = [];
          let total = 0;
          res.on("data", (b: Buffer) => {
            total += b.length;
            if (total > cap) res.destroy(new Error("V01_PROVIDER_BYTE_LIMIT"));
            else chunks.push(b);
          });
          res.on("end", () => {
            clearTimeout(deadline);
            agent.destroy();
            if (total > 0) resolve(Buffer.concat(chunks));
            else reject(new Error("V01_EMPTY_PROVIDER_RESPONSE"));
          });
          res.on("error", () => {
            clearTimeout(deadline);
            agent.destroy();
            reject(new Error("V01_PROVIDER_IO_UNCERTAIN"));
          });
        },
      );
      const deadline = setTimeout(
        () => req.destroy(new Error("V01_PROVIDER_IO_UNCERTAIN")),
        45_000,
      );
      req.on("timeout", () =>
        req.destroy(new Error("V01_PROVIDER_IO_UNCERTAIN")),
      );
      req.on("error", () => {
        clearTimeout(deadline);
        agent.destroy();
        reject(new Error("V01_PROVIDER_IO_UNCERTAIN"));
      });
      req.end(body ?? undefined);
    });
  }
}
