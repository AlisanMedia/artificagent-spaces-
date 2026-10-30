"use client";
import { lazy, Suspense, useRef, useState } from "react";
const Calculators = lazy(() =>
  import("./local-calculators").then((m) => ({ default: m.LocalCalculators })),
);
/** Useful device-only tools remain accessible without exposing the 75-item R&D catalogue. */
export function LocalSupportTools() {
  const modal = useRef<HTMLDialogElement>(null),
    [tool, setTool] = useState<"mortgage" | "rental-yield">("mortgage"),
    [opened, setOpened] = useState(false);
  return (
    <details className="pe-tools">
      <summary>Hesaplama araçları</summary>
      <p>
        Yalnız girdiğin değerlerle cihazında hesaplanır. Banka teklifi, yatırım
        tahmini veya veri gönderimi değildir.
      </p>
      {(
        [
          ["mortgage", "Konut kredisi hesaplayıcı"],
          ["rental-yield", "Kira getirisi senaryosu"],
        ] as const
      ).map(([id, label]) => (
        <button
          className="subtle"
          type="button"
          key={id}
          onClick={() => {
            setTool(id);
            setOpened(true);
            modal.current?.showModal();
          }}
        >
          {label}
        </button>
      ))}
      <dialog
        ref={modal}
        className="ux-dialog"
        onClose={() => setOpened(false)}
        aria-labelledby="pe-tool-title"
      >
        <h2 id="pe-tool-title">
          {tool === "mortgage"
            ? "Konut kredisi hesaplayıcı"
            : "Kira getirisi senaryosu"}
        </h2>
        <button
          type="button"
          className="subtle"
          onClick={() => modal.current?.close()}
        >
          Hesaplamayı kapat
        </button>
        {opened && (
          <Suspense fallback={<p>Hesaplama yükleniyor…</p>}>
            <Calculators tool={tool} key={tool} />
          </Suspense>
        )}
      </dialog>
    </details>
  );
}
