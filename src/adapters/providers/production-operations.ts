import { z } from "zod";
import { invariant } from "@/domain/platform";
import type { ProductionServiceId } from "@/domain/production-services";
import type { PreparedMediaRequest } from "@/contracts/api-first-providers";
import { productionService } from "@/server/production/registry";
import {
  validateSourceGrant,
  type ProviderSourceScope,
} from "./api-first-policy";

/** Only the server's persisted request/operation ID selects these hardcoded paths; callback URLs are ignored. */
export function prepareProductionOperation(
  serviceId: ProductionServiceId,
  storedTaskId: string,
  kind: "status" | "result" | "cancel",
): PreparedMediaRequest {
  const d = productionService(serviceId);
  invariant(
    /^[A-Za-z0-9_-]{1,120}$/.test(storedTaskId),
    "INVALID_PROVIDER_TASK_ID",
    422,
  );
  const common = {
    enabled: false as const,
    externalBudgetMicroUsd: 0 as const,
    credentialRequired: true as const,
    requiresIndependentReview: true as const,
  };
  if (d.provider === "fal")
    return {
      ...common,
      provider: "fal",
      origin: "https://queue.fal.run",
      method: kind === "cancel" ? "PUT" : "GET",
      path: `/${d.endpoint}/requests/${storedTaskId}${kind === "status" ? "/status" : kind === "cancel" ? "/cancel" : ""}`,
    };
  if (d.provider === "worldlabs") {
    invariant(kind !== "cancel", "PROVIDER_CANCEL_NOT_VERIFIED", 409);
    return {
      ...common,
      provider: "worldlabs",
      origin: "https://api.worldlabs.ai",
      method: "GET",
      path: `/marble/v1/operations/${storedTaskId}`,
    };
  }
  invariant(
    serviceId === "T01" && kind !== "cancel",
    "SYNC_OR_CANCEL_RECONCILIATION_REQUIRED",
    409,
  );
  z.uuid().parse(storedTaskId);
  return {
    ...common,
    provider: "pedra",
    origin: "https://app.pedra.ai",
    method: "POST",
    path: "/api/get_virtual_tour",
    body: { tourId: storedTaskId },
  };
}
export function normalizeFalQueueReceipt(input: unknown) {
  return z
    .object({
      request_id: z.string().regex(/^[A-Za-z0-9_-]{1,120}$/),
      status: z.enum(["IN_QUEUE", "IN_PROGRESS", "COMPLETED"]),
    })
    .strip()
    .parse(input);
}
/** Creating a media asset is itself gated. No upload/signed URL is issued or fetched by this builder. */
export function prepareWorldMediaAsset(
  input: unknown,
  scope: ProviderSourceScope,
  hosts: readonly string[],
  nowMs: number,
): PreparedMediaRequest {
  const g = validateSourceGrant(input, scope, hosts, nowMs);
  invariant(g.source.kind === "photo", "WORLD_PHOTO_REQUIRED", 422);
  return {
    provider: "worldlabs",
    method: "POST",
    origin: "https://api.worldlabs.ai",
    path: "/marble/v1/media-assets:prepare_upload",
    body: {
      file_name: `reference-${g.source.sha256.slice(0, 24)}.jpg`,
      extension: "jpg",
      kind: "image",
    },
    credentialRequired: true,
    enabled: false,
    externalBudgetMicroUsd: 0,
    requiresIndependentReview: true,
  };
}
