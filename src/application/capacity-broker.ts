import { invariant } from "@/domain/platform";

interface Lease {
  id: string;
  tenant: string;
  expiresAt: number;
  fence: number;
}
/** Isolated Pixel Streaming capacity simulator. No GPU, TURN, cloud or network allocation. */
export class CapacityBroker {
  private readonly leases = new Map<string, Lease>();
  private epoch = 0;
  constructor(
    readonly maxGlobal: number,
    readonly maxPerTenant: number,
    readonly ttlMs = 30000,
  ) {
    invariant(
      Number.isInteger(maxGlobal) &&
        maxGlobal > 0 &&
        Number.isInteger(maxPerTenant) &&
        maxPerTenant > 0 &&
        maxPerTenant <= maxGlobal &&
        ttlMs > 0 &&
        ttlMs <= 60000,
      "INVALID_CAPACITY_POLICY",
    );
  }
  sweep(now: number) {
    for (const [id, lease] of this.leases)
      if (lease.expiresAt <= now) this.leases.delete(id);
  }
  reserve(id: string, tenant: string, now: number) {
    this.sweep(now);
    const existing = this.leases.get(id);
    if (existing) {
      invariant(existing.tenant === tenant, "SESSION_TENANT_MISMATCH", 403);
      return existing;
    }
    invariant(
      this.leases.size < this.maxGlobal,
      "GLOBAL_CAPACITY_EXHAUSTED",
      429,
    );
    invariant(
      [...this.leases.values()].filter((l) => l.tenant === tenant).length <
        this.maxPerTenant,
      "TENANT_CAPACITY_EXHAUSTED",
      429,
    );
    const lease = {
      id,
      tenant,
      expiresAt: now + this.ttlMs,
      fence: ++this.epoch,
    };
    this.leases.set(id, lease);
    return lease;
  }
  release(id: string, tenant: string, fence: number) {
    const lease = this.leases.get(id);
    invariant(
      lease && lease.tenant === tenant && lease.fence === fence,
      "STALE_CAPACITY_LEASE",
      403,
    );
    this.leases.delete(id);
  }
  summary() {
    return {
      active: this.leases.size,
      simulated: true,
      gpuAllocated: false,
      actualGpuConcurrency: null,
    };
  }
}
