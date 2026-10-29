import { describe, expect, it } from "vitest";
import {
  mortgageScenario,
  rentalYieldScenario,
} from "@/domain/property-calculators";
describe("local property scenarios with explicit assumptions", () => {
  const loan = { principalTry: 100_000, monthlyRatePercent: 1, months: 12 };
  const rent = {
    purchaseTry: 1_000_000,
    monthlyRentTry: 10_000,
    annualCostsTry: 12_000,
    occupiedMonths: 12,
  };
  it("calculates the known annuity, not a guessed bank quote", () => {
    const r = mortgageScenario(loan);
    expect(r.monthlyPaymentKurus).toBe(888488);
    expect(r.totalPaymentKurus).toBe(10661855);
    expect(r.interestKurus).toBe(661855);
    expect(r.exclusions).toBe("TAX_INSURANCE_FEES_VARIABLE_RATE");
    expect(r.rounding).toContain("WITHOUT_AMORTIZATION");
  });
  it("handles zero and very small rates without division by zero/cancellation", () => {
    expect(
      mortgageScenario({ ...loan, monthlyRatePercent: 0 }).totalPaymentKurus,
    ).toBe(10_000_000);
    expect(
      mortgageScenario({ ...loan, monthlyRatePercent: 0.00000000001 })
        .monthlyPaymentKurus,
    ).toBe(833333);
    expect(
      Number.isSafeInteger(
        mortgageScenario({
          principalTry: 1_000_000_000,
          monthlyRatePercent: 10,
          months: 600,
        }).totalPaymentKurus,
      ),
    ).toBe(true);
  });
  it.each([
    { principalTry: 0 },
    { principalTry: -1 },
    { principalTry: 1.234 },
    { principalTry: 1_000_000_000.01 },
    { monthlyRatePercent: -0.1 },
    { monthlyRatePercent: 10.01 },
    { monthlyRatePercent: Infinity },
    { months: 0 },
    { months: 601 },
    { months: 2.5 },
    { principalTry: NaN },
  ])("refuses unbounded or invalid loan inputs %j", (change) => {
    expect(() => mortgageScenario({ ...loan, ...change })).toThrow();
  });
  it("keeps gross and expense-adjusted yield, occupancy and negative income separate", () => {
    const r = rentalYieldScenario(rent);
    expect(r.annualRevenueKurus).toBe(12_000_000);
    expect(r.annualNetKurus).toBe(10_800_000);
    expect(r.grossYieldPercent).toBe(12);
    expect(r.netYieldPercent).toBe(10.8);
    expect(r.simplePaybackYears).toBeCloseTo(9.259259, 5);
    expect(r.exclusions).toBe("TAX_FINANCING_APPRECIATION");
    const empty = rentalYieldScenario({ ...rent, occupiedMonths: 0 });
    expect(empty.netYieldPercent).toBe(-1.2);
    expect(empty.simplePaybackYears).toBeNull();
    expect(
      rentalYieldScenario({ ...rent, monthlyRentTry: 0, annualCostsTry: 0 })
        .simplePaybackYears,
    ).toBeNull();
  });
  it.each([
    { occupiedMonths: 13 },
    { occupiedMonths: -1 },
    { occupiedMonths: 1.5 },
    { purchaseTry: 0 },
    { monthlyRentTry: -1 },
    { annualCostsTry: Infinity },
  ])("refuses invalid yield assumptions %j", (change) => {
    expect(() => rentalYieldScenario({ ...rent, ...change })).toThrow();
  });
});
