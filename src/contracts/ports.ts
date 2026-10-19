import type {
  AssetId, GenerationMode, OrganizationId, PreviewPlan, PreviewRequest,
  Property, PropertyId, Result, WorkspaceScope,
} from "@/domain/types";

export interface PropertyCatalog {
  list(scope: WorkspaceScope): readonly Property[];
  get(scope: WorkspaceScope, id: PropertyId): Property | undefined;
}

/** Local preview only; this contract does not authorize an external provider. */
export interface PlanningAdapter {
  readonly id: "deterministic-local-fake";
  readonly supportedModes: readonly GenerationMode[];
  plan(request: PreviewRequest, property: Property): PreviewPlan;
}

/** Future-only ports. Phase 1 deliberately provides no implementations. */
export interface PrivateAssetStore {
  createReadGrant(scope: WorkspaceScope, assetId: AssetId): Promise<{
    readonly opaqueHandle: string;
    readonly expiresAt: string;
  }>;
}

export interface ProviderRouter {
  select(policy: {
    readonly organizationId: OrganizationId;
    readonly mode: GenerationMode;
    readonly maxCostMicroUsd: number;
    readonly dataRegion: string;
    readonly consentRecordId: string;
  }): Promise<Result<{ readonly providerId: string; readonly modelRevision: string }>>;
}

export interface DurableWorkflow {
  submit(command: {
    readonly organizationId: OrganizationId;
    readonly propertyId: PropertyId;
    readonly idempotencyKey: string;
    readonly manifestRevision: number;
    readonly maxCostMicroUsd: number;
  }): Promise<{ readonly jobId: string }>;
}

export interface GpuWorkerScheduler {
  reserve(input: {
    readonly organizationId: OrganizationId;
    readonly artifactId: string;
    readonly sessionTtlSeconds: number;
    readonly maxCostMicroUsd: number;
  }): Promise<{ readonly reservationId: string }>;
}
