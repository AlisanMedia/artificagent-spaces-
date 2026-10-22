import { describe, it, expect } from "vitest";
import {
  attemptDisposition,
  CircuitBreaker,
  acceptedOutputEconomics,
} from "@/domain/production-policy";
import { CapacityBroker } from "@/application/capacity-broker";
describe("bounded workflow, actual-cost economics and simulated streaming capacity", () => {
  it("holds unknown external submissions instead of charging for an automatic resubmission", () => {
    expect(
      attemptDisposition({
        providerAccepted: null,
        attempt: 1,
        local: false,
        cancelled: false,
        maxAttempts: 2,
      }),
    ).toBe("hold-unknown");
    expect(
      attemptDisposition({
        providerAccepted: false,
        attempt: 1,
        local: true,
        cancelled: false,
        maxAttempts: 2,
      }),
    ).toBe("retry-local");
    expect(
      attemptDisposition({
        providerAccepted: true,
        attempt: 1,
        local: false,
        cancelled: false,
        maxAttempts: 2,
      }),
    ).toBe("stop");
    expect(
      attemptDisposition({
        providerAccepted: false,
        attempt: 2,
        local: true,
        cancelled: false,
        maxAttempts: 2,
      }),
    ).toBe("stop");
    expect(
      attemptDisposition({
        providerAccepted: false,
        attempt: 1,
        local: true,
        cancelled: true,
        maxAttempts: 2,
      }),
    ).toBe("stop");
    expect(() =>
      attemptDisposition({
        providerAccepted: null,
        attempt: 0,
        local: false,
        cancelled: false,
        maxAttempts: 4,
      }),
    ).toThrow();
  });
  it("opens and recovers a provider circuit with a hard cooldown", () => {
    const circuit = new CircuitBreaker(2, 1000);
    expect(circuit.allows(0)).toBe(true);
    circuit.failure(10);
    expect(circuit.allows(11)).toBe(true);
    circuit.failure(20);
    expect(circuit.allows(999)).toBe(false);
    expect(circuit.allows(1020)).toBe(true);
    circuit.success();
    expect(circuit.allows(21)).toBe(true);
    expect(() => new CircuitBreaker(0)).toThrow();
    expect(() => new CircuitBreaker(2, 0)).toThrow();
  });
  it("uses accepted outputs rather than attempted outputs for unit economics", () => {
    const cost = {
      attempted: 4,
      accepted: 2,
      inferenceMicroUsd: 1000000,
      retryMicroUsd: 500000,
      workerMicroUsd: 100000,
      storageMicroUsd: 10000,
      voiceMicroUsd: 20000,
    };
    expect(acceptedOutputEconomics(cost)).toMatchObject({
      totalMicroUsd: 1630000,
      perAcceptedMicroUsd: 815000,
      acceptanceRate: 0.5,
    });
    expect(
      acceptedOutputEconomics({ ...cost, accepted: 0, attempted: 0 })
        .perAcceptedMicroUsd,
    ).toBeNull();
    expect(() => acceptedOutputEconomics({ ...cost, accepted: 5 })).toThrow();
    expect(() =>
      acceptedOutputEconomics({ ...cost, voiceMicroUsd: -1 }),
    ).toThrow();
    expect(() =>
      acceptedOutputEconomics({
        ...cost,
        inferenceMicroUsd: Number.MAX_SAFE_INTEGER,
      }),
    ).toThrow();
  });
  it("enforces global/tenant limits, lease ownership and fencing with no actual GPU allocation", () => {
    const broker = new CapacityBroker(3, 2, 1000);
    const first = broker.reserve("one", "tenant-a", 0);
    expect(broker.reserve("one", "tenant-a", 10)).toEqual(first);
    expect(() => broker.reserve("one", "tenant-b", 20)).toThrow(
      "SESSION_TENANT_MISMATCH",
    );
    broker.reserve("two", "tenant-a", 0);
    expect(() => broker.reserve("three", "tenant-a", 0)).toThrow(
      "TENANT_CAPACITY_EXHAUSTED",
    );
    broker.reserve("three", "tenant-b", 0);
    expect(() => broker.reserve("four", "tenant-b", 0)).toThrow(
      "GLOBAL_CAPACITY_EXHAUSTED",
    );
    expect(() => broker.release("one", "tenant-b", first.fence)).toThrow(
      "STALE_CAPACITY_LEASE",
    );
    broker.release("one", "tenant-a", first.fence);
    expect(() => broker.release("one", "tenant-a", first.fence)).toThrow();
    broker.sweep(1001);
    expect(broker.summary()).toEqual({
      active: 0,
      simulated: true,
      gpuAllocated: false,
      actualGpuConcurrency: null,
    });
    expect(() => new CapacityBroker(1, 2)).toThrow();
  });
  it("handles an isolated 200-session synthetic pressure test within fixed caps", () => {
    const broker = new CapacityBroker(8, 2, 100);
    let admitted = 0,
      rejected = 0;
    for (let i = 0; i < 200; i++) {
      try {
        broker.reserve(String(i), "tenant-" + (i % 6), i);
        admitted++;
      } catch {
        rejected++;
      }
      expect(broker.summary().active).toBeLessThanOrEqual(8);
    }
    expect(admitted).toBeGreaterThan(0);
    expect(rejected).toBeGreaterThan(0);
    broker.sweep(1000);
    expect(broker.summary().active).toBe(0);
  });
});
