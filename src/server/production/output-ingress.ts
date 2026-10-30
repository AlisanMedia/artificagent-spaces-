import { request as httpsRequest } from "node:https";
import { lookup } from "node:dns";
import {
  allowlistedHttpsUrl,
  PROVIDER_RUNTIME_LOCK,
} from "@/adapters/providers/api-first-policy";
import { invariant } from "@/domain/platform";

/** Candidate bytes stay server-side. Unreachable until separately reviewed code/infra authorization; no environment unlock. */
export class LockedCandidateRetriever {
  async retrieve(
    candidate: {
      url: string;
      provider: "fal" | "pedra";
      mime: "image/png" | "image/jpeg" | "image/webp" | "video/mp4";
    },
    signal: AbortSignal,
  ): Promise<Uint8Array> {
    invariant(
      PROVIDER_RUNTIME_LOCK.liveEnabled,
      "BLOCKED_EXTERNAL_APPROVAL",
      403,
    );
    const url = allowlistedHttpsUrl(
      candidate.url,
      candidate.provider === "pedra"
        ? ["img.pedra.ai"]
        : [
            "v3b.fal.media",
            "v3.fal.media",
            "fal.media",
            "storage.googleapis.com",
          ],
    );
    invariant(
      url.hostname !== "storage.googleapis.com" ||
        url.pathname.startsWith("/falserverless/"),
      "PROVIDER_URL_DENIED",
      403,
    );
    const cap = candidate.mime === "video/mp4" ? 52_428_800 : 20_971_520;
    signal.throwIfAborted();
    // IPv4-only future connector rejects private/reserved answers and pins the returned address via lookup.
    return new Promise((resolve, reject) => {
      const req = httpsRequest(
        url,
        {
          method: "GET",
          signal,
          timeout: 15_000,
          family: 4,
          lookup: (hostname, options, callback) => {
            lookup(hostname, { family: 4 }, (err, address, family) => {
              const denied =
                /^(?:0\.|10\.|127\.|169\.254\.|172\.(?:1[6-9]|2\d|3[01])\.|192\.168\.|100\.(?:6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.|192\.0\.|198\.(?:1[89]|51)\.|203\.0\.113\.|22[4-9]\.|2[3-5]\d\.)/.test(
                  address,
                );
              callback(
                err || denied ? new Error("PROVIDER_DNS_DENIED") : null,
                options.all ? [{ address, family }] : address,
                family,
              );
            });
          },
        },
        (res) => {
          if (
            res.statusCode !== 200 ||
            res.headers["content-type"]?.split(";")[0]?.trim() !==
              candidate.mime ||
            Number(res.headers["content-length"] ?? 0) > cap
          ) {
            res.destroy();
            reject(new Error("PROVIDER_OUTPUT_HEADERS_DENIED"));
            return;
          }
          let size = 0;
          const chunks: Buffer[] = [];
          res.on("data", (chunk: Buffer) => {
            size += chunk.length;
            if (size > cap) res.destroy(new Error("PROVIDER_OUTPUT_BYTE_CAP"));
            else chunks.push(chunk);
          });
          res.on("end", () =>
            size > 0
              ? resolve(new Uint8Array(Buffer.concat(chunks)))
              : reject(new Error("EMPTY_PROVIDER_OUTPUT")),
          );
          res.on("error", () =>
            reject(new Error("PROVIDER_OUTPUT_INGRESS_FAILED")),
          );
        },
      );
      req.on("timeout", () =>
        req.destroy(new Error("PROVIDER_OUTPUT_TIMEOUT")),
      );
      req.on("error", () =>
        reject(new Error("PROVIDER_OUTPUT_INGRESS_FAILED")),
      );
      req.end();
    });
    // Decode/magic/metadata/QA/private-storage and independent review are subsequent mandatory steps, not HTTP-header assertions.
  }
}
