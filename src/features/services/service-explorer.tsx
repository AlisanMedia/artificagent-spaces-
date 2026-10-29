"use client";
import { lazy, Suspense, useEffect, useId, useRef, useState } from "react";
import { ArrowRight, Search, X } from "lucide-react";
import {
  SERVICES,
  SERVICE_CATEGORIES,
  findServices,
  serviceById,
  serviceProduct,
  serviceStatus,
  type ServiceCategory,
} from "../../domain/service-catalog";
import type { StudioProduct } from "../../domain/real-estate-styles";

const LocalCalculators = lazy(() =>
  import("./local-calculators").then((m) => ({ default: m.LocalCalculators })),
);
const PAGE_SIZE = 6;
export function ServiceExplorer({
  onInspect,
  onSelect,
  studioHref = "/spaces",
  sampleHref = "/spaces/showcase",
  disabled = false,
  isolated = false,
}: {
  onInspect?: (product: StudioProduct) => void;
  onSelect?: (product: StudioProduct) => void;
  studioHref?: string;
  sampleHref?: string;
  disabled?: boolean;
  isolated?: boolean;
}) {
  const prefix = useId(),
    [query, setQuery] = useState(""),
    [category, setCategory] = useState<ServiceCategory | "all">("all"),
    [available, setAvailable] = useState(false),
    [limit, setLimit] = useState(PAGE_SIZE),
    [selectedId, setSelectedId] = useState<string | null>(null);
  const dialog = useRef<HTMLDialogElement>(null),
    selected = selectedId ? serviceById(selectedId) : undefined,
    matches = findServices(query, category, available),
    product = selected ? serviceProduct(selected) : null;
  useEffect(() => {
    if (selected && !dialog.current?.open) dialog.current?.showModal();
  }, [selected]);
  function close() {
    dialog.current?.close();
    setSelectedId(null);
  }
  function reset() {
    setQuery("");
    setCategory("all");
    setAvailable(false);
    setLimit(PAGE_SIZE);
  }
  return (
    <div className="sv-explorer">
      <details className="sv-disclosure">
        <summary>
          <span>
            <strong>Tüm hizmetleri keşfet</strong>
            <small>Video, fotoğraf, tur ve ilan araçları</small>
          </span>
          <span className="sv-plus" aria-hidden="true">
            +
          </span>
        </summary>
        <div className="sv-catalog" role="region" aria-label="Hizmet kataloğu">
          <div className="sv-intro">
            <h3>Ne hazırlamak istersin?</h3>
            <p>
              İhtiyacını bul; hangi hizmetin kullanılabildiğini başlamadan gör.
            </p>
          </div>
          <div className="sv-filters">
            <label htmlFor={`${prefix}-search`} className="sv-search">
              <span>Hizmet ara</span>
              <span className="sv-search-control">
                <Search size={17} aria-hidden="true" />
                <input
                  id={`${prefix}-search`}
                  type="search"
                  maxLength={160}
                  value={query}
                  placeholder="Örn. mobilya, ilan, kredi"
                  autoComplete="off"
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setLimit(PAGE_SIZE);
                  }}
                />
              </span>
            </label>
            <label htmlFor={`${prefix}-category`}>
              Hizmet türü
              <select
                id={`${prefix}-category`}
                value={category}
                onChange={(e) => {
                  setCategory(e.target.value as ServiceCategory | "all");
                  setLimit(PAGE_SIZE);
                }}
              >
                <option value="all">Tüm hizmetler</option>
                {SERVICE_CATEGORIES.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="sv-filter-meta">
            <label>
              <input
                type="checkbox"
                checked={available}
                onChange={(e) => {
                  setAvailable(e.target.checked);
                  setLimit(PAGE_SIZE);
                }}
              />{" "}
              Yalnız şimdi denenebilenler
            </label>
            <p role="status">{matches.length} hizmet bulundu</p>
          </div>
          <ul className="sv-service-list">
            {matches.slice(0, limit).map((service) => (
              <li key={service.id}>
                <span
                  className={`sv-status ${service.action.kind === "PLANNED" ? "is-pending" : ""}`}
                >
                  {serviceStatus(service)}
                </span>
                <h4>{service.title}</h4>
                <p>{service.summary}</p>
                <button
                  type="button"
                  className="subtle"
                  onClick={() => setSelectedId(service.id)}
                  aria-label={`Detayları gör: ${service.title} hakkında bilgi`}
                >
                  Detayları gör <ArrowRight size={14} aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
          {!matches.length && (
            <div className="sv-empty">
              <p>
                Bu aramada hizmet bulunamadı. Daha kısa bir kelime
                deneyebilirsin.
              </p>
              <button type="button" className="subtle" onClick={reset}>
                Filtreleri temizle
              </button>
            </div>
          )}
          {matches.length > limit && (
            <button
              type="button"
              className="sv-more"
              onClick={() => setLimit((v) => v + PAGE_SIZE)}
            >
              Diğer hizmetleri göster
            </button>
          )}
          <p className="sv-fine-print">
            Katalogda {SERVICES.length} hizmet kapsamı var. “Hazırlanıyor”
            olanlar henüz oluşturulamaz; fotoğraf veya ücret kabul etmez. Yerel
            örnekler canlı AI çıktısı değildir.
          </p>
        </div>
      </details>
      <dialog
        ref={dialog}
        className="ux-dialog sv-dialog"
        aria-labelledby={`${prefix}-title`}
        aria-describedby={`${prefix}-description`}
        onKeyDown={(event) => {
          if (event.key !== "Tab") return;
          const controls = Array.from(
            event.currentTarget.querySelectorAll<HTMLElement>(
              'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
            ),
          ).filter(
            (element) => !element.hidden && element.getClientRects().length > 0,
          );
          const first = controls[0],
            last = controls.at(-1);
          if (
            first &&
            last &&
            (event.shiftKey
              ? document.activeElement === first
              : document.activeElement === last)
          ) {
            event.preventDefault();
            (event.shiftKey ? last : first).focus();
          }
        }}
        onClose={() => {
          if (!dialog.current?.open) setSelectedId(null);
        }}
      >
        {selected && (
          <>
            <div className="sv-dialog-heading">
              <span className="sv-status">{serviceStatus(selected)}</span>
              <button
                type="button"
                className="subtle"
                aria-label="Hizmet bilgisini kapat"
                onClick={close}
              >
                <X size={20} aria-hidden="true" />
              </button>
            </div>
            <h2 id={`${prefix}-title`}>{selected.title}</h2>
            <p id={`${prefix}-description`}>{selected.summary}</p>
            <dl className="sv-requirements">
              <div>
                <dt>Ne gerekir?</dt>
                <dd>{selected.input}</dd>
              </div>
              <div>
                <dt>Sonuç</dt>
                <dd>{selected.output}</dd>
              </div>
            </dl>
            <p className="sv-truth">{selected.disclosure}</p>
            {isolated && selected.action.kind === "LOCAL_VIDEO" && (
              <p className="sv-local-note">
                Bu izole önizleme yalnız hazır videoyu gösterir; seçtiğin
                dosyadan yeni video oluşturmaz.
              </p>
            )}
            {selected.action.kind === "PLANNED" ? (
              <p className="sv-pending-note">
                Bu hizmet kataloğa eklendi; oluşturma henüz kullanılamıyor.
                Sağlayıcı, haklar, güvenlik ve maliyet doğrulanmadan
                açılmayacak. Dosya yükleme veya ödeme başlatılmaz.
              </p>
            ) : selected.action.kind === "LOCAL_CALCULATOR" ? (
              <Suspense fallback={<p role="status">Hesaplayıcı açılıyor…</p>}>
                <LocalCalculators
                  key={selected.id}
                  tool={selected.action.tool}
                />
              </Suspense>
            ) : (
              product && (
                <div className="sv-dialog-actions">
                  {onInspect ? (
                    <button
                      type="button"
                      className="subtle"
                      onClick={() => {
                        close();
                        onInspect(product);
                      }}
                    >
                      Hazır örneği aç
                    </button>
                  ) : (
                    <a
                      className="subtle"
                      href={`${sampleHref}?product=${product}#ornekler`}
                    >
                      Hazır örneği aç
                    </a>
                  )}
                  {selected.action.kind === "LOCAL_VIDEO" &&
                    !isolated &&
                    (onSelect ? (
                      <button
                        type="button"
                        className="ux-primary"
                        disabled={disabled}
                        onClick={() => {
                          close();
                          onSelect(product);
                        }}
                      >
                        Yerel stüdyoda dene
                      </button>
                    ) : (
                      <a
                        className="ux-primary"
                        href={`${studioHref}?service=video`}
                      >
                        Yerel stüdyoda dene
                      </a>
                    ))}
                </div>
              )
            )}
          </>
        )}
      </dialog>
    </div>
  );
}
