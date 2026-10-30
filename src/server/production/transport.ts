import { request as httpsRequest } from "node:https";
import { invariant } from "@/domain/platform";
import type { PreparedProductionRequest } from "@/adapters/providers/production-disabled";
import {
  allowlistedHttpsUrl,
  PROVIDER_RUNTIME_LOCK,
} from "@/adapters/providers/api-first-policy";
import { PRODUCTION_SERVICES } from "./registry";

export interface ServerProviderSecrets {
  read(provider: "fal" | "pedra" | "worldlabs"): Promise<string>;
}
/** A literal code lock, not an environment toggle. There is no public unlock/token/approval endpoint. */
export class LockedProductionTransport {
  async execute(
    prepared: PreparedProductionRequest,
    secrets: ServerProviderSecrets,
    signal: AbortSignal,
  ): Promise<Uint8Array> {
    invariant(
      PROVIDER_RUNTIME_LOCK.liveEnabled,
      "BLOCKED_EXTERNAL_APPROVAL",
      403,
    );
    // Future implementation is deliberately unreachable under the current owner authority.
    // It is not a live-tested integration, secret store or hosted egress sandbox.
    invariant(
      prepared.externalBudgetMicroUsd > 0,
      "OWNER_BUDGET_NOT_AUTHORIZED",
      403,
    );
    invariant(
      prepared.expiresAtMs - Date.now() >= 30_000,
      "SOURCE_WINDOW_RECONCILIATION_REQUIRED",
      409,
    );
    signal.throwIfAborted();
    const d = PRODUCTION_SERVICES.find(
      (s) => s.id === prepared.provenance.serviceId,
    );
    invariant(
      d && d.provider === prepared.provider,
      "PROVIDER_ROUTE_DENIED",
      403,
    );
    const origin =
      prepared.provider === "fal"
        ? "https://queue.fal.run"
        : prepared.provider === "pedra"
          ? "https://app.pedra.ai"
          : "https://api.worldlabs.ai";
    const path =
      prepared.provider === "fal"
        ? "/" + d.endpoint
        : prepared.provider === "worldlabs"
          ? "/marble/v1/worlds:generate"
          : d.endpoint;
    invariant(
      prepared.origin === origin &&
        prepared.path === path &&
        prepared.method === "POST",
      "PROVIDER_ROUTE_DENIED",
      403,
    );
    const url = allowlistedHttpsUrl(origin + path, [new URL(origin).hostname]);
    const key = await secrets.read(prepared.provider);
    invariant(
      key.length > 0 && !/[\r\n]/.test(key),
      "SERVER_SECRET_UNAVAILABLE",
      403,
    );
    const payload = Buffer.from(
      JSON.stringify(
        prepared.provider === "pedra"
          ? { ...prepared.body, apiKey: key }
          : prepared.body,
      ),
    );
    invariant(payload.byteLength <= 65_536, "PROVIDER_REQUEST_TOO_LARGE", 413);
    return new Promise((resolve, reject) => {
      const req = httpsRequest(
        url,
        {
          method: "POST",
          signal,
          timeout: 30_000,
          headers: {
            "content-type": "application/json",
            "content-length": String(payload.length),
            ...(prepared.provider === "fal"
              ? { authorization: "Key " + key }
              : prepared.provider === "worldlabs"
                ? { "WLT-Api-Key": key }
                : {}),
          },
        },
        (res) => {
          if (
            !res.statusCode ||
            res.statusCode < 200 ||
            res.statusCode >= 300 ||
            !res.headers["content-type"]?.startsWith("application/json")
          ) {
            res.destroy();
            reject(new Error("PROVIDER_ACCEPTANCE_RECONCILIATION_REQUIRED"));
            return;
          }
          const chunks: Buffer[] = [];
          let size = 0;
          res.on("data", (chunk: Buffer) => {
            size += chunk.length;
            if (size > 1_048_576)
              res.destroy(new Error("PROVIDER_RESPONSE_LIMIT"));
            else chunks.push(chunk);
          });
          res.on("end", () => resolve(new Uint8Array(Buffer.concat(chunks))));
          res.on("error", () =>
            reject(new Error("PROVIDER_ACCEPTANCE_RECONCILIATION_REQUIRED")),
          );
        },
      );
      req.on("timeout", () =>
        req.destroy(new Error("PROVIDER_ACCEPTANCE_RECONCILIATION_REQUIRED")),
      );
      req.on("error", () =>
        reject(new Error("PROVIDER_ACCEPTANCE_RECONCILIATION_REQUIRED")),
      );
      req.end(payload);
    });
  }
}
