import { isIP } from "node:net";
import { z } from "zod";
import { invariant, PlatformError } from "@/domain/platform";
import {
  ApprovedPhoto,
  type ApprovedPhotoScope,
} from "@/domain/api-first-studio";
import type { DisabledProviderOperations } from "@/contracts/api-first-providers";

export const PROVIDER_RUNTIME_LOCK = Object.freeze({
  liveEnabled: false,
  externalMaxMicroUsd: 0,
  paidFallback: false,
  credentialsRead: false,
});
/** No environment flag or supplied credential can activate this adapter. Future live transport is a separate approval. */
export class DisabledProviderTransport implements DisabledProviderOperations {
  readonly enabled = false as const;
  protected block(): never {
    throw new PlatformError("BLOCKED_EXTERNAL_APPROVAL", 403);
  }
  async submit(...input: unknown[]): Promise<never> {
    void input;
    return this.block();
  }
  async getStatus(...input: unknown[]): Promise<never> {
    void input;
    return this.block();
  }
  async getResult(...input: unknown[]): Promise<never> {
    void input;
    return this.block();
  }
  async cancel(...input: unknown[]): Promise<never> {
    void input;
    return this.block();
  }
  estimateQuote() {
    return {
      approvedSpendMicroUsd: 0 as const,
      providerPriceMicroUsd: null,
      status: "PRICE_AND_EXTERNAL_APPROVAL_REQUIRED" as const,
    };
  }
}
export function allowlistedHttpsUrl(value: string, hosts: readonly string[]) {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new PlatformError("PROVIDER_URL_DENIED", 403);
  }
  invariant(
    value.length <= 4096 &&
      url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      !url.port &&
      !url.hash &&
      !isIP(url.hostname) &&
      hosts.includes(url.hostname) &&
      !/(?:^|\.)(?:localhost|local|internal)$/.test(url.hostname),
    "PROVIDER_URL_DENIED",
    403,
  );
  invariant(
    !/%(?:2f|5c|00|0a|0d)/i.test(url.pathname) && !url.pathname.includes("\\"),
    "PROVIDER_URL_DENIED",
    403,
  );
  return url;
}
export const ServerSourceGrant = z
  .object({
    source: ApprovedPhoto,
    url: z.string().max(4096),
    purpose: z.literal("provider-source"),
    issuedAtMs: z.number().int().nonnegative(),
    expiresAtMs: z.number().int().positive(),
  })
  .strict();
export type ScopedSourceGrant = z.infer<typeof ServerSourceGrant>;
export interface ProviderSourceScope extends ApprovedPhotoScope {
  /** Exact grants already verified/issued by a trusted server storage service. Not customer supplied. */
  readonly approvedGrants: readonly ScopedSourceGrant[];
}
/** scope and allowedHosts must come from server authorization/storage, never request JSON. No grant is issued here. */
export function validateSourceGrant(
  input: unknown,
  scope: ProviderSourceScope,
  allowedHosts: readonly string[],
  nowMs: number,
) {
  const grant = ServerSourceGrant.parse(input),
    source = grant.source;
  const approved = scope.sources.find((s) => s.assetId === source.assetId);
  invariant(
    scope.approvedGrants.some(
      (g) =>
        g.source.assetId === source.assetId &&
        g.source.sha256 === source.sha256 &&
        g.url === grant.url &&
        g.issuedAtMs === grant.issuedAtMs &&
        g.expiresAtMs === grant.expiresAtMs &&
        g.purpose === grant.purpose,
    ),
    "SOURCE_GRANT_NOT_SERVER_APPROVED",
    403,
  );
  invariant(
    approved &&
      source.organizationId === scope.organizationId &&
      source.propertyId === scope.propertyId &&
      source.revision === scope.revision &&
      approved.sha256 === source.sha256 &&
      approved.width === source.width &&
      approved.height === source.height &&
      approved.bytes === source.bytes &&
      approved.kind === source.kind &&
      approved.roomId === source.roomId,
    "MEDIA_SCOPE_DENIED",
    403,
  );
  invariant(
    grant.issuedAtMs <= nowMs &&
      grant.expiresAtMs > nowMs &&
      grant.expiresAtMs > grant.issuedAtMs &&
      grant.expiresAtMs - grant.issuedAtMs <= 60_000,
    "SOURCE_GRANT_EXPIRED_OR_INVALID",
    403,
  );
  allowlistedHttpsUrl(grant.url, allowedHosts);
  return grant;
}
export function sourceFrames(
  start: unknown,
  end: unknown | undefined,
  scope: ProviderSourceScope,
  hosts: readonly string[],
  nowMs: number,
) {
  const first = validateSourceGrant(start, scope, hosts, nowMs);
  const last =
    end === undefined ? null : validateSourceGrant(end, scope, hosts, nowMs);
  if (last)
    invariant(
      first.source.roomId && last.source.roomId === first.source.roomId,
      "CROSS_ROOM_END_FRAME_DENIED",
      403,
    );
  return { first, last };
}
