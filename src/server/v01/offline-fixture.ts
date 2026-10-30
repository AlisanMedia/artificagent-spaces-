import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { invariant } from "@/domain/platform";
import { digest } from "../crypto";
import type { V01Permit } from "./authorization";
import { queuePath, type V01Gateway } from "./gateway";

/** Explicit signed offline permission, known synthetic bytes; never contacts fal or reads its key. IDs are visibly fixture IDs. */
export class OfflineV01Gateway implements V01Gateway {
  readonly mode = "offline-fixture" as const;
  constructor(
    readonly privateRoot: string,
    readonly permit: V01Permit,
  ) {
    invariant(
      permit.mode === this.mode && permit.fixtureOutputSha256,
      "V01_FIXTURE_SCOPE_DENIED",
      403,
    );
  }
  async preflight() {
    /* Offline fixture never requires or reads a provider credential. */
  }
  async submit(body: { start_image_url: string }, requestId: string) {
    invariant(
      digest(
        Buffer.from(body.start_image_url.split(",")[1] ?? "", "base64"),
      ) === this.permit.sourceSha256,
      "V01_FIXTURE_SOURCE_DENIED",
      403,
    );
    const id = "offline-v01-" + requestId;
    return {
      request_id: id,
      status_url: "https://queue.fal.run" + queuePath(id, "status"),
      response_url: "https://queue.fal.run" + queuePath(id, "result"),
    };
  }
  async status(id: string) {
    return { request_id: id, status: "COMPLETED" };
  }
  async result() {
    return {
      video: {
        url: "https://v3.fal.media/offline-contract-fixture.mp4",
        content_type: "video/mp4",
      },
    };
  }
  async download(url: string, cap: number) {
    invariant(
      url === "https://v3.fal.media/offline-contract-fixture.mp4",
      "V01_FIXTURE_URL_DENIED",
      403,
    );
    const b = await readFile(join(this.privateRoot, "v01-offline-output.mp4"));
    invariant(
      b.length <= cap && digest(b) === this.permit.fixtureOutputSha256,
      "V01_FIXTURE_HASH_DENIED",
      403,
    );
    return b;
  }
}
