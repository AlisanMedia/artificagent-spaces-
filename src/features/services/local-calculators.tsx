"use client";
import { useId, useState, type FormEvent } from "react";
import {
  mortgageScenario,
  rentalYieldScenario,
} from "../../domain/property-calculators";

const money = (kurus: number) =>
  new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    maximumFractionDigits: 2,
  }).format(kurus / 100);
const decimal = (value: number) =>
  new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 2 }).format(value);
function number(value: string) {
  if (!value.trim()) throw Error("EMPTY_FIELD");
  return Number(value);
}
export function LocalCalculators({
  tool,
}: {
  tool: "mortgage" | "rental-yield";
}) {
  const prefix = useId(),
    mortgage = tool === "mortgage";
  const [values, setValues] = useState({
      price: "1000000",
      rate: "2",
      months: "120",
      rent: "12000",
      costs: "12000",
      occupancy: "12",
    }),
    [result, setResult] = useState<
      readonly (readonly [string, string])[] | null
    >(null),
    [error, setError] = useState("");
  function update(key: keyof typeof values, value: string) {
    setValues((v) => ({ ...v, [key]: value }));
    setResult(null);
    setError("");
  }
  function calculate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      if (mortgage) {
        const r = mortgageScenario({
          principalTry: number(values.price),
          monthlyRatePercent: number(values.rate),
          months: number(values.months),
        });
        setResult([
          ["Yaklaşık aylık taksit", money(r.monthlyPaymentKurus)],
          ["Yaklaşık toplam ödeme", money(r.totalPaymentKurus)],
          ["Faiz toplamı", money(r.interestKurus)],
        ]);
      } else {
        const r = rentalYieldScenario({
          purchaseTry: number(values.price),
          monthlyRentTry: number(values.rent),
          annualCostsTry: number(values.costs),
          occupiedMonths: number(values.occupancy),
        });
        setResult([
          ["Yıllık brüt kira", money(r.annualRevenueKurus)],
          ["Yıllık gider sonrası kira", money(r.annualNetKurus)],
          ["Brüt getiri", `%${decimal(r.grossYieldPercent)}`],
          ["Gider sonrası getiri", `%${decimal(r.netYieldPercent)}`],
          [
            "Basit geri dönüş",
            r.simplePaybackYears === null
              ? "Bu senaryoda pozitif geri dönüş yok"
              : `${decimal(r.simplePaybackYears)} yıl`,
          ],
        ]);
      }
      setError("");
    } catch {
      setResult(null);
      setError(
        "Tutarları en fazla iki ondalıkla gir. Vade 1–600 ay, aylık faiz %0–10, doluluk 0–12 tam ay olmalı.",
      );
    }
  }
  const field = (
    key: keyof typeof values,
    label: string,
    min: number,
    max: number,
    step = "0.01",
  ) => (
    <label key={key} htmlFor={`${prefix}-${key}`}>
      {label}
      <input
        id={`${prefix}-${key}`}
        type="number"
        inputMode={step === "1" ? "numeric" : "decimal"}
        min={min}
        max={max}
        step={step}
        required
        value={values[key]}
        aria-describedby={`${prefix}-limits`}
        onChange={(e) => update(key, e.target.value)}
      />
    </label>
  );
  return (
    <form className="sv-calculator" onSubmit={calculate}>
      <p className="sv-local-note">
        Örnek senaryo · Hesap bu cihazda yapılır; bilgiler kaydedilmez veya
        gönderilmez.
      </p>
      <div className="sv-calculator-fields">
        {field(
          "price",
          mortgage ? "Kredi tutarı (TL)" : "Alım bedeli (TL)",
          0.01,
          1_000_000_000,
        )}
        {mortgage ? (
          <>
            {field("rate", "Aylık nominal faiz (%)", 0, 10, "any")}
            {field("months", "Vade (ay)", 1, 600, "1")}
          </>
        ) : (
          <>
            {field("rent", "Aylık kira (TL)", 0, 1_000_000_000)}
            {field("costs", "Yıllık gider (TL)", 0, 1_000_000_000)}
            {field("occupancy", "Yılda dolu kalacak ay", 0, 12, "1")}
          </>
        )}
      </div>
      <p id={`${prefix}-limits`} className="sv-fine-print">
        En fazla 1 milyar TL; para alanları en fazla iki ondalık.{" "}
        {mortgage
          ? "Faiz aylık nominal orandır; yıllık maliyet oranı değildir."
          : "Doluluk, sizin varsayımınızdır. Gerçek kira veya piyasa verisi alınmaz."}
      </p>
      <button className="ux-primary" type="submit">
        Hesapla
      </button>
      {error && (
        <p role="alert" className="ux-error">
          {error}
        </p>
      )}
      {result && (
        <div role="status" className="sv-calculator-result">
          <p>Girilen senaryonun sonucu</p>
          <dl>
            {result.map(([key, value]) => (
              <div key={key}>
                <dt>{key}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}
      <p className="sv-fine-print">
        {mortgage
          ? "Banka teklifi değildir. Vergi, sigorta, komisyon ve değişken faiz dahil değildir. Taksit ve toplam ayrı yuvarlanır; son taksit için ödeme planı hesaplanmadı."
          : "Yatırım tavsiyesi veya getiri garantisi değildir. Vergi, kredi/finansman ve değer artışı dahil değildir."}
      </p>
    </form>
  );
}
