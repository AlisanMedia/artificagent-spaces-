/** Deterministic scenarios only: no bank, market feed, tax rate or financial action. */
function bounded(value: number, min: number, max: number) {
  if (!Number.isFinite(value) || value < min || value > max)
    throw Error("CALCULATOR_INPUT_INVALID");
  return value;
}
function cents(value: number, zero = false) {
  bounded(value, zero ? 0 : 0.01, 1_000_000_000);
  const integer = Math.round(value * 100);
  if (Math.abs(integer - value * 100) > 0.0001)
    throw Error("CALCULATOR_MONEY_PRECISION");
  return integer;
}
export function mortgageScenario(input: {
  principalTry: number;
  monthlyRatePercent: number;
  months: number;
}) {
  const principalKurus = cents(input.principalTry),
    rate = bounded(input.monthlyRatePercent, 0, 10) / 100,
    months = bounded(input.months, 1, 600);
  if (!Number.isInteger(months)) throw Error("CALCULATOR_MONTHS_INVALID");
  // This numerically stable form also handles very small positive rates.
  const payment =
    rate === 0
      ? principalKurus / months
      : (principalKurus * rate) / -Math.expm1(-months * Math.log1p(rate));
  const monthlyPaymentKurus = Math.round(payment),
    totalPaymentKurus = Math.round(payment * months);
  return Object.freeze({
    principalKurus,
    monthlyPaymentKurus,
    totalPaymentKurus,
    interestKurus: totalPaymentKurus - principalKurus,
    monthlyRatePercent: input.monthlyRatePercent,
    months,
    exclusions: "TAX_INSURANCE_FEES_VARIABLE_RATE" as const,
    rounding: "APPROXIMATE_TOTAL_WITHOUT_AMORTIZATION_SCHEDULE" as const,
  });
}
export function rentalYieldScenario(input: {
  purchaseTry: number;
  monthlyRentTry: number;
  annualCostsTry: number;
  occupiedMonths: number;
}) {
  const purchaseKurus = cents(input.purchaseTry),
    monthlyRentKurus = cents(input.monthlyRentTry, true),
    annualCostsKurus = cents(input.annualCostsTry, true),
    occupiedMonths = bounded(input.occupiedMonths, 0, 12);
  if (!Number.isInteger(occupiedMonths))
    throw Error("CALCULATOR_MONTHS_INVALID");
  const annualRevenueKurus = monthlyRentKurus * occupiedMonths,
    annualNetKurus = annualRevenueKurus - annualCostsKurus;
  return Object.freeze({
    purchaseKurus,
    annualRevenueKurus,
    annualCostsKurus,
    annualNetKurus,
    grossYieldPercent: (100 * annualRevenueKurus) / purchaseKurus,
    netYieldPercent: (100 * annualNetKurus) / purchaseKurus,
    simplePaybackYears:
      annualNetKurus > 0 ? purchaseKurus / annualNetKurus : null,
    exclusions: "TAX_FINANCING_APPRECIATION" as const,
  });
}
