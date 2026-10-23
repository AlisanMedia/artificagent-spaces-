import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve, join, sep } from "node:path";
import {
  unitEconomics,
  observedEconomics,
  partnerContribution,
  type EconomicInputValue,
} from "../src/domain/unit-economics";
import { invariant } from "../src/domain/platform";
const argument = (name: string, fallback: string) => {
  const i = process.argv.indexOf(name);
  return i < 0 ? fallback : process.argv[i + 1]!;
};
const path = argument(
    "--measurements",
    ".spaces-local/video-quality-v4/measurements.json",
  ),
  out = resolve(argument("--output", ".spaces-local/unit-economics-v4"));
invariant(
  ["artifacts/", ".spaces-local/"].some((p) =>
    out.startsWith(resolve(p) + sep),
  ),
  "SAFE_ECONOMICS_OUTPUT_REQUIRED",
);
const measures = JSON.parse(await readFile(path, "utf8")) as {
  outputs: {
    id: string;
    quality?: {
      status: string;
      metadata: { durationSeconds: number; bytes: number } | null;
    };
    encodeWallTimeMs?: number;
  }[];
  humanAcceptedExports: number;
  actualExternalSpendMicroUsd: number;
};
const assumptions = JSON.parse(
  await readFile("config/unit-economics-v4.json", "utf8"),
) as {
  assumptionsOnlyNotVendorQuotes: EconomicInputValue["rates"];
  proposedPackagesNotForSale: { id: string; priceMicroUsd: number }[];
};
const usable = measures.outputs.filter(
  (o) =>
    o.quality?.status === "PASS" && o.quality.metadata && o.encodeWallTimeMs,
);
invariant(usable.length > 0, "MEASURED_RENDER_REQUIRED");
const wallPerSecond = Math.max(
    ...usable.map(
      (o) => o.encodeWallTimeMs! / 1000 / o.quality!.metadata!.durationSeconds,
    ),
  ),
  bytesPerSecond = Math.max(
    ...usable.map(
      (o) => o.quality!.metadata!.bytes / o.quality!.metadata!.durationSeconds,
    ),
  );
const base: EconomicInputValue = {
  seconds: 30,
  referenceVideoSeconds: 2,
  renderWallSeconds: 30 * wallPerSecond,
  bytesPerAttempt: Math.ceil(30 * bytesPerSecond),
  retentionMonths: 1,
  downloads: 3,
  rejectionRate: 0.2,
  reviewMinutesPerAttempt: 3,
  finalApprovalMinutes: 1,
  reviewerAvailableMinutes: 9600,
  priceMicroUsd: 19000000,
  acceptedExportsPerAgency: 10,
  allocatedMonthlyFixedMicroUsd: 20000000,
  customerOnboardingMicroUsd: 10000000,
  rates: {
    ...assumptions.assumptionsOnlyNotVendorQuotes,
    providerOutputSecond: null,
    providerReferenceSecond: null,
  },
};
const scenarios = [];
for (const seconds of [30, 60])
  for (const rejectionRate of [0, 0.2, 0.4])
    for (const reviewMinutesPerAttempt of [3, 8])
      for (const humanHour of [20000000, 40000000]) {
        const input = {
          ...base,
          seconds,
          rejectionRate,
          reviewMinutesPerAttempt,
          renderWallSeconds: seconds * wallPerSecond,
          bytesPerAttempt: Math.ceil(seconds * bytesPerSecond),
          rates: { ...base.rates, humanHour },
        };
        scenarios.push({
          scenario: "PROVIDER_UNKNOWN",
          input,
          result: unitEconomics(input),
        });
        scenarios.push({
          scenario: "HYPOTHETICAL_LOCAL_ONLY_NOT_AI",
          input: {
            ...input,
            rates: {
              ...input.rates,
              providerOutputSecond: 0,
              providerReferenceSecond: 0,
            },
          },
          result: unitEconomics({
            ...input,
            rates: {
              ...input.rates,
              providerOutputSecond: 0,
              providerReferenceSecond: 0,
            },
          }),
        });
      }
const result = {
  schemaVersion: 1,
  actualExternalSpendMicroUsd: 0,
  measuredRenderInputs: usable.map((o) => ({
    id: o.id,
    wallTimeMs: o.encodeWallTimeMs,
    seconds: o.quality!.metadata!.durationSeconds,
    bytes: o.quality!.metadata!.bytes,
  })),
  observation: observedEconomics(
    measures.outputs.length,
    measures.humanAcceptedExports,
    measures.actualExternalSpendMicroUsd,
  ),
  projectionMethod:
    "Maximum observed LOCAL wall seconds and bytes per output-second; linear 30/60s extrapolation where not directly measured; not CPU/GPU billing or native detail",
  assumptions:
    "All assumed costs and proposed prices are illustrative USD, not vendor quotations; taxBps=0 excludes taxes; FX UNKNOWN; real provider tariff unselected",
  packages: assumptions.proposedPackagesNotForSale,
  productionDefault: unitEconomics(base),
  partner: partnerContribution({
    monthlyPriceMicroUsd: 299000000,
    includedAcceptedExports: 10,
    perAcceptedCostMicroUsd: unitEconomics(base).costPerAcceptedMicroUsd,
    allocatedOperationsMicroUsd: 20000000,
    resellerCommissionBps: null,
  }),
  scenarios,
};
await mkdir(out, { recursive: true, mode: 0o700 });
await writeFile(
  join(out, "profitability.json"),
  JSON.stringify(result, null, 2) + "\n",
);
const keys = [
  "scenario",
  "seconds",
  "rejectionRate",
  "reviewMinutes",
  "humanHourMicroUsd",
  "knownLowerBoundMicroUsd",
  "costPerAcceptedMicroUsd",
  "grossMargin",
  "reviewCapacity",
  "monthlyAgencyContributionMicroUsd",
  "maxProviderPerAttemptFor60PctMicroUsd",
];
const rows = scenarios.map((s) => [
  s.scenario,
  s.input.seconds,
  s.input.rejectionRate,
  s.input.reviewMinutesPerAttempt,
  s.input.rates.humanHour,
  s.result.knownLowerBoundPerAcceptedMicroUsd,
  s.result.costPerAcceptedMicroUsd ?? "UNKNOWN",
  s.result.grossMargin ?? "UNKNOWN",
  s.result.reviewerCapacityAcceptedPerMonth,
  s.result.monthlyAgencyContributionMicroUsd ?? "UNKNOWN",
  s.result.maxProviderSpendPerAttemptFor60PctMicroUsd ?? "UNKNOWN",
]);
await writeFile(
  join(out, "sensitivity.csv"),
  [keys, ...rows].map((r) => r.join(",")).join("\n") + "\n",
);
console.log(
  JSON.stringify({
    scenarios: scenarios.length,
    observation: result.observation,
    productionStatus: result.productionDefault.status,
    report: join(out, "profitability.json"),
    externalSpendMicroUsd: 0,
  }),
);
