import { z } from "zod";
import { microUsd } from "./platform";
export const BenchmarkBudget = z.object({
  candidates: z
    .array(
      z.object({
        modelId: z.string().min(1),
        perOutputSecondMicroUsd: z.number().int().nonnegative(),
      }),
    )
    .min(1)
    .max(3),
  screen: z.object({
    shotsPerModel: z.number().int().min(1).max(2),
    secondsPerShot: z.number().int().min(2).max(10),
    maxAttemptsPerShot: z.number().int().min(1).max(2),
  }),
  ownerSelectedHardCapMicroUsd: z.number().int().nonnegative().nullable(),
  accountHardCapVerified: z.boolean(),
  termsAndDpaApproved: z.boolean(),
  syntheticRightsApprovedForVendor: z.boolean(),
  minimumCreditPurchaseMicroUsd: z.number().int().nonnegative().nullable(),
});
export function benchmarkBudget(input: unknown) {
  const v = BenchmarkBudget.parse(input),
    perRound = microUsd(
      v.candidates.reduce(
        (n, c) =>
          n +
          c.perOutputSecondMicroUsd *
            v.screen.shotsPerModel *
            v.screen.secondsPerShot,
        0,
      ),
    ),
    worst = microUsd(perRound * v.screen.maxAttemptsPerShot);
  const blockers: string[] = [];
  if (!v.ownerSelectedHardCapMicroUsd)
    blockers.push("OWNER_HARD_CAP_NOT_SELECTED");
  if (
    v.ownerSelectedHardCapMicroUsd !== null &&
    v.ownerSelectedHardCapMicroUsd < worst
  )
    blockers.push("INSUFFICIENT_RESERVED_CAP");
  if (!v.accountHardCapVerified) blockers.push("ACCOUNT_HARD_CAP_NOT_VERIFIED");
  if (!v.termsAndDpaApproved) blockers.push("TERMS_DPA_NOT_APPROVED");
  if (!v.syntheticRightsApprovedForVendor)
    blockers.push("VENDOR_REFERENCE_RIGHTS_NOT_APPROVED");
  if (v.minimumCreditPurchaseMicroUsd === null)
    blockers.push("MINIMUM_CREDIT_PURCHASE_UNKNOWN");
  else if (
    v.ownerSelectedHardCapMicroUsd !== null &&
    v.minimumCreditPurchaseMicroUsd > v.ownerSelectedHardCapMicroUsd
  )
    blockers.push("MINIMUM_PURCHASE_EXCEEDS_CAP");
  return {
    basePublishedInferenceMicroUsd: perRound,
    worstPublishedInferenceMicroUsd: worst,
    taxesStorageLaborAndAccountMinimum: "ADDITIONAL_OR_UNKNOWN",
    blockers,
    readiness: blockers.length
      ? "BLOCKED_EXTERNAL_APPROVAL"
      : "DOCUMENTARY_GATE_ONLY_TRANSPORT_STILL_DISABLED",
    networkCalls: 0,
    actualExternalSpendMicroUsd: 0,
  };
}
