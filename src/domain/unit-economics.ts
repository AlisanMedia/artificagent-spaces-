import { z } from "zod";
import { invariant, microUsd } from "./platform";
const signedSafe = (n: number) => {
  invariant(Number.isSafeInteger(n), "UNSAFE_ECONOMIC_TOTAL");
  return n;
};
const moneyBps = (money: number, bps: number) =>
  Number((BigInt(money) * BigInt(bps) + 9999n) / 10000n);
const Money = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
  Rate = Money.nullable();
export const EconomicInput = z
  .object({
    seconds: z.number().min(1).max(120),
    referenceVideoSeconds: z.number().min(0).max(30),
    renderWallSeconds: z.number().positive().max(3600),
    bytesPerAttempt: z.number().int().positive().max(1_000_000_000),
    retentionMonths: z.number().min(0).max(12),
    downloads: z.number().min(0).max(100),
    rejectionRate: z.number().min(0).max(0.95),
    reviewMinutesPerAttempt: z.number().min(0.1).max(120),
    finalApprovalMinutes: z.number().min(0.1).max(30),
    reviewerAvailableMinutes: z.number().min(0).max(100000),
    priceMicroUsd: Money.positive(),
    acceptedExportsPerAgency: z.number().int().min(0).max(10000),
    allocatedMonthlyFixedMicroUsd: Money,
    customerOnboardingMicroUsd: Money,
    rates: z
      .object({
        providerOutputSecond: Rate,
        providerReferenceSecond: Rate,
        workerHour: Rate,
        storageGibMonth: Rate,
        egressGib: Rate,
        humanHour: Rate,
        supportPerAccepted: Rate,
        abusePerAccepted: Rate,
        paymentFixed: Rate,
        paymentBps: z.number().int().min(0).max(10000).nullable(),
        taxBps: z.number().int().min(0).max(10000).nullable(),
      })
      .strict(),
  })
  .strict();
export type EconomicInputValue = z.infer<typeof EconomicInput>;
/** Conditional calculator; nullable inputs stay UNKNOWN. Currency arithmetic rounds costs upward. */
export function unitEconomics(input: unknown) {
  const v = EconomicInput.parse(input),
    r = v.rates,
    unknown = Object.entries(r)
      .filter(([, x]) => x === null)
      .map(([k]) => k);
  const component = (rate: number | null, quantity: number) =>
    rate === null ? null : microUsd(Math.ceil(rate * quantity));
  const perAttempt = {
    provider: component(r.providerOutputSecond, v.seconds),
    reference: component(r.providerReferenceSecond, v.referenceVideoSeconds),
    worker: component(r.workerHour, v.renderWallSeconds / 3600),
    storage: component(
      r.storageGibMonth,
      (v.bytesPerAttempt / 1073741824) * v.retentionMonths,
    ),
    egress: component(
      r.egressGib,
      (v.bytesPerAttempt / 1073741824) * v.downloads,
    ),
    review: component(r.humanHour, v.reviewMinutesPerAttempt / 60),
  };
  const lowerAttempt = microUsd(
    Object.values(perAttempt).reduce<number>((n, x) => n + (x ?? 0), 0),
  );
  const expectedAttemptsPerAccepted = 1 / (1 - v.rejectionRate),
    reviewMinutesPerAccepted =
      v.reviewMinutesPerAttempt * expectedAttemptsPerAccepted +
      v.finalApprovalMinutes;
  const fees =
    r.paymentFixed === null || r.paymentBps === null
      ? null
      : microUsd(r.paymentFixed + moneyBps(v.priceMicroUsd, r.paymentBps));
  const taxes = r.taxBps === null ? null : moneyBps(v.priceMicroUsd, r.taxBps);
  const finalApproval = component(r.humanHour, v.finalApprovalMinutes / 60);
  const lowerAccepted = microUsd(
    Math.ceil(lowerAttempt * expectedAttemptsPerAccepted) +
      (finalApproval ?? 0) +
      (r.supportPerAccepted ?? 0) +
      (r.abusePerAccepted ?? 0) +
      (fees ?? 0) +
      (taxes ?? 0),
  );
  const complete = unknown.length === 0,
    cost = complete ? lowerAccepted : null,
    contribution = cost === null ? null : v.priceMicroUsd - cost;
  // 60% target is an explicit conditional ceiling, never an observed/proven margin.
  const otherUnknown = unknown.filter(
    (k) => !["providerOutputSecond", "providerReferenceSecond"].includes(k),
  );
  const withoutProvider =
    lowerAccepted -
    Math.ceil(
      ((perAttempt.provider ?? 0) + (perAttempt.reference ?? 0)) *
        expectedAttemptsPerAccepted,
    );
  const allowance = otherUnknown.length
    ? null
    : Math.max(
        0,
        Number((BigInt(v.priceMicroUsd) * 2n) / 5n) - withoutProvider,
      );
  return {
    status: complete
      ? "ASSUMPTION_COMPLETE_NOT_COMMERCIAL_VALIDATION"
      : "UNKNOWN_REQUIRED_COSTS",
    unknown,
    perAttempt,
    marginalCostPerAttemptMicroUsd: complete ? lowerAttempt : null,
    knownLowerBoundPerAttemptMicroUsd: lowerAttempt,
    expectedAttemptsPerAccepted,
    successProbabilityWithinTwoAttempts: 1 - v.rejectionRate ** 2,
    costPerAcceptedMicroUsd: cost,
    knownLowerBoundPerAcceptedMicroUsd: lowerAccepted,
    paymentFeeMicroUsd: fees,
    taxMicroUsd: taxes,
    contributionPerAcceptedMicroUsd: contribution,
    grossMargin:
      cost === null ? null : (v.priceMicroUsd - cost) / v.priceMicroUsd,
    reviewMinutesPerAccepted,
    reviewerCapacityAcceptedPerMonth: Math.floor(
      v.reviewerAvailableMinutes / reviewMinutesPerAccepted,
    ),
    breakEvenExportsPerCustomer:
      contribution !== null && contribution > 0
        ? Math.ceil(v.customerOnboardingMicroUsd / contribution)
        : null,
    monthlyAgencyContributionMicroUsd:
      contribution === null
        ? null
        : signedSafe(
            contribution * v.acceptedExportsPerAgency -
              v.allocatedMonthlyFixedMicroUsd,
          ),
    maxProviderSpendPerAttemptFor60PctMicroUsd:
      allowance === null
        ? null
        : Math.floor(allowance / expectedAttemptsPerAccepted),
    maxOutputSecondRateFor60PctMicroUsd:
      allowance === null
        ? null
        : Math.floor(allowance / expectedAttemptsPerAccepted / v.seconds),
    laborReleasePolicy: "DIFFERENT_HUMAN_REVIEW_EVERY_RELEASE_NO_AUTO_APPROVAL",
    pricingStatus: "EDITABLE_HYPOTHESIS_NOT_A_LIVE_OFFER",
  };
}
export function observedEconomics(
  attempts: number,
  accepted: number,
  externalMicroUsd: number,
) {
  if (
    !Number.isInteger(attempts) ||
    !Number.isInteger(accepted) ||
    accepted < 0 ||
    accepted > attempts ||
    attempts < 0
  )
    throw new Error("INVALID_OBSERVATIONS");
  microUsd(externalMicroUsd);
  return {
    attempts,
    independentlyHumanAccepted: accepted,
    observedExternalSpendMicroUsd: externalMicroUsd,
    externalCostPerHumanAcceptedMicroUsd: accepted
      ? Math.ceil(externalMicroUsd / accepted)
      : null,
    productionCompute: "UNKNOWN",
    labor: "NOT_ZERO_NOT_MEASURED",
    commercialProfitability: "NOT_VERIFIED",
  };
}

export function partnerContribution(input: {
  monthlyPriceMicroUsd: number;
  includedAcceptedExports: number;
  perAcceptedCostMicroUsd: number | null;
  allocatedOperationsMicroUsd: number;
  resellerCommissionBps: number | null;
}) {
  [input.monthlyPriceMicroUsd, input.allocatedOperationsMicroUsd].forEach(
    microUsd,
  );
  if (
    !Number.isSafeInteger(input.includedAcceptedExports) ||
    input.includedAcceptedExports < 0 ||
    input.includedAcceptedExports > 10000
  )
    throw new Error("INVALID_PARTNER_QUANTITY");
  if (input.perAcceptedCostMicroUsd !== null)
    microUsd(input.perAcceptedCostMicroUsd);
  if (
    input.resellerCommissionBps !== null &&
    (!Number.isInteger(input.resellerCommissionBps) ||
      input.resellerCommissionBps < 0 ||
      input.resellerCommissionBps > 10000)
  )
    throw new Error("INVALID_PARTNER_COMMISSION");
  const commission =
    input.resellerCommissionBps === null
      ? null
      : moneyBps(input.monthlyPriceMicroUsd, input.resellerCommissionBps);
  return {
    monthlyContributionMicroUsd:
      input.perAcceptedCostMicroUsd === null || commission === null
        ? null
        : signedSafe(
            input.monthlyPriceMicroUsd -
              microUsd(
                input.perAcceptedCostMicroUsd * input.includedAcceptedExports,
              ) -
              input.allocatedOperationsMicroUsd -
              commission,
          ),
    commissionMicroUsd: commission,
    contractStatus: "HYPOTHESIS_ONLY_NO_LIVE_RESELLER_BILLING",
  };
}
