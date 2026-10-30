import { readFile } from "node:fs/promises";
import { PRODUCTION_SERVICES } from "../src/server/production/registry";
import { compileServiceProfile } from "../src/server/production/prompts";
const sources = JSON.parse(
  await readFile("fixtures/providers-v57/sources.json", "utf8"),
) as {
  checkedAt: string;
  productionCalls: number;
  records: { id: string; status: number; sha256: string; url: string }[];
};
if (
  sources.checkedAt !== "2026-10-30" ||
  sources.productionCalls !== 0 ||
  !sources.records.every(
    (r) =>
      r.status === 200 &&
      /^[a-f0-9]{64}$/.test(r.sha256) &&
      r.url.startsWith("https://"),
  )
)
  throw Error("PROVIDER_SOURCE_EVIDENCE_REQUIRED");
if (
  PRODUCTION_SERVICES.length !== 15 ||
  new Set(PRODUCTION_SERVICES.map((s) => s.id)).size !== 15
)
  throw Error("PRODUCTION_SERVICE_CONTRACTS_INVALID");
for (const service of PRODUCTION_SERVICES) {
  if (service.liveEnabled || !service.requiresIndependentReview)
    throw Error("UNAUTHORIZED_PRODUCTION_ENABLEMENT");
  if (
    service.schemaRef !== "internal" &&
    !sources.records.some((r) => r.id === service.schemaRef)
  )
    throw Error("MISSING_OFFICIAL_SCHEMA_SOURCE");
  const profile = compileServiceProfile(
    service.id,
    service.id === "P07b" ? { target: "wall", finish: "sage-paint" } : {},
  );
  if (
    profile.version !== service.profileVersion ||
    profile.negativePromptSupported
  )
    throw Error("SERVICE_PROFILE_DRIFT");
}
const plan = JSON.parse(
  await readFile("fixtures/production-v57/evaluation-plan.json", "utf8"),
) as {
  cases: {
    sourceHash: unknown;
    providerOutput: unknown;
    ratings: unknown[];
    accepted: unknown;
    benchmarkStatus: string;
  }[];
  productionInferenceExecuted: boolean;
};
if (
  plan.cases.length !== 30 ||
  plan.productionInferenceExecuted ||
  !plan.cases.every(
    (c) =>
      c.sourceHash === null &&
      c.providerOutput === null &&
      c.accepted === null &&
      c.ratings.length === 2 &&
      c.ratings.every((r) => r === null) &&
      c.benchmarkStatus === "NOT_RUN",
  )
)
  throw Error("UNRUN_BENCHMARK_MUST_NOT_BECOME_ACCEPTANCE_EVIDENCE");
console.log(
  "PASS: 15 distinct disabled contracts, official dated sources, prompt/profile versions, 30 unrun/null-rating benchmark cases. No provider/network/secret/financial operation.",
);
