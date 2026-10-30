"use client";
import { useEffect, useRef, useState } from "react";
import {
  FURNITURE_STYLES,
  ROOM_TYPES,
  SERVICE_FAMILIES,
  SKY_STYLES,
  type ProductionServiceId,
  type ProductionRequestView,
  type ServiceOptions,
} from "@/domain/production-services";
import { api } from "../platform/client";
import type { AssetView, PropertyView } from "@/contracts/platform-ui";

export function ProductionRequestPanel({
  serviceId,
  property,
  assets,
  disabled,
  onBack,
}: {
  serviceId: ProductionServiceId;
  property: PropertyView | null;
  assets: AssetView[];
  disabled: boolean;
  onBack: () => void;
}) {
  const [activeService, setActiveService] = useState(serviceId);
  const [restored, setRestored] = useState(false);
  const [options, setOptions] = useState<ServiceOptions>(() =>
    serviceId === "P03"
      ? { roomType: "Living room", style: "Modern" }
      : serviceId === "P06"
        ? { skyStyle: "sunny" }
        : serviceId === "P07"
          ? { style: "Modern" }
          : serviceId === "P07b"
            ? { target: "wall", finish: "warm-white-paint" }
            : {},
  );
  const [consent, setConsent] = useState(false),
    [result, setResult] = useState<ProductionRequestView | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const locked = useRef(false),
    key = useRef<string | null>(null);
  const family = SERVICE_FAMILIES.find((f) => f.serviceId === serviceId);
  const photos = assets.filter(
    (a) => a.kind === "photo" && a.status === "clean",
  );
  const source = photos[0];
  const propertyId = property?.id,
    propertyRevision = property?.revision;
  useEffect(() => {
    let active = true;
    if (!propertyId || !propertyRevision) {
      return;
    }
    void api<ProductionRequestView[]>(
      `/production/requests?propertyId=${encodeURIComponent(propertyId)}&revision=${propertyRevision}&serviceId=${activeService}`,
    )
      .then((list) => {
        if (active) {
          const prior = list[0] ?? null;
          setResult(prior);
          if (prior) {
            setOptions(prior.options);
            setConsent(serviceId === "P07" || serviceId === "P07b");
          }
          setRestored(true);
        }
      })
      .catch(() => {
        if (active) {
          setError(
            "Önceki isteğin alınamadı. Kaynakların saklanıyor; sayfayı yenileyip tekrar dene.",
          );
          setRestored(false);
        }
      });
    return () => {
      active = false;
    };
  }, [propertyId, propertyRevision, activeService, serviceId]);
  function edit(next: ServiceOptions) {
    setOptions(next);
    setResult(null);
    key.current = null;
    setError("");
  }
  async function save() {
    if (locked.current || !property || !source) return;
    locked.current = true;
    setBusy(true);
    setError("");
    try {
      key.current ??= crypto.randomUUID();
      const response = await api<ProductionRequestView>(
        "/production/requests",
        {
          propertyId: property.id,
          revision: property.revision,
          serviceId: activeService,
          sourceAssetIds: [source.id],
          options,
          rights: {
            syntheticOnly: true,
            ownedOrLicensed: true,
            conceptAccepted: consent,
          },
          idempotencyKey: key.current,
          maxCostMicroUsd: 0,
        },
      );
      setResult(response);
    } catch {
      setError(
        "Tercihler kaydedilemedi. Kaynaklarını ve kullanım hakkını kontrol et; sayfayı yenilemeden tekrar deneyebilirsin.",
      );
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }
  return (
    <section className="pe-request" aria-label="Hizmet tercihleri">
      <span className="ux-kicker">TERCİHLERİN</span>
      <h2>
        {family?.label ??
          (serviceId === "P07b"
            ? "Boya / Zemin Konsepti"
            : "Fotoğraf düzenleme")}
      </h2>
      <p>{family?.benefit}</p>
      {serviceId === "P01" && (
        <label>
          Düzenleme
          <select
            aria-label="Düzenleme"
            value={activeService}
            onChange={(e) => {
              setRestored(false);
              setActiveService(e.target.value as "P01" | "P02");
              edit({});
            }}
          >
            <option value="P01">Işık ve netlik</option>
            <option value="P02">Perspektif ve netlik</option>
          </select>
        </label>
      )}
      <p>
        İlk fotoğrafın bu istek için kullanılır. Başka bir fotoğraf için medya
        adımında sırayı değiştir. Her fotoğraf ayrı incelenir.
      </p>
      {serviceId === "P03" && (
        <>
          <label>
            Oda türü
            <select
              aria-label="Oda türü"
              value={options.roomType}
              onChange={(e) =>
                edit({
                  ...options,
                  roomType: e.target.value as NonNullable<
                    ServiceOptions["roomType"]
                  >,
                })
              }
            >
              {ROOM_TYPES.map((s, i) => (
                <option key={s} value={s}>
                  {
                    [
                      "Salon",
                      "Salon ve yemek alanı",
                      "Yatak odası",
                      "Yemek odası",
                      "Teras",
                      "Giriş",
                      "Ofis",
                      "Banyo",
                    ][i]
                  }
                </option>
              ))}
            </select>
          </label>
          <p>
            Mobilya eklemeden önce odanın boş olduğu ayrıca doğrulanmalıdır.
          </p>
        </>
      )}
      {(serviceId === "P03" || serviceId === "P07") && (
        <label>
          Dekorasyon tarzı
          <select
            aria-label="Dekorasyon tarzı"
            value={options.style}
            onChange={(e) =>
              edit({
                ...options,
                style: e.target.value as NonNullable<ServiceOptions["style"]>,
              })
            }
          >
            {FURNITURE_STYLES.map((s, i) => (
              <option value={s} key={s}>
                {["Modern", "İskandinav", "Çağdaş", "Minimal", "Akdeniz"][i]}
              </option>
            ))}
          </select>
        </label>
      )}
      {serviceId === "P06" && (
        <>
          <label>
            Işık tercihi
            <select
              aria-label="Işık tercihi"
              value={options.skyStyle}
              onChange={(e) =>
                edit({
                  skyStyle: e.target.value as NonNullable<
                    ServiceOptions["skyStyle"]
                  >,
                })
              }
            >
              {SKY_STYLES.map((s, i) => (
                <option key={s} value={s}>
                  {
                    [
                      "Açık mavi gökyüzü",
                      "Yumuşak gün ışığı",
                      "Gün doğumu",
                      "Gün batımı",
                      "Akşam",
                    ][i]
                  }
                </option>
              ))}
            </select>
          </label>
          <p>
            Dış cephe fotoğrafı gerekir. Sonuç mevcut çekim koşulu olarak
            sunulmaz.
          </p>
        </>
      )}
      {serviceId === "P05" && (
        <p className="ux-note">
          Nesneyi kaldırmak için fotoğrafa tam oturan, mimariyi ve zorunlu
          işaretleri koruyan bir alan maskesi ayrıca incelenmelidir. Bu ekranda
          maske hazırlama ve canlı üretim henüz açık değil.
        </p>
      )}
      {serviceId === "P07b" && (
        <>
          <label>
            Hedef yüzey
            <select
              aria-label="Hedef yüzey"
              value={options.target}
              onChange={(e) =>
                edit(
                  e.target.value === "wall"
                    ? { target: "wall", finish: "warm-white-paint" }
                    : { target: "floor", finish: "natural-oak" },
                )
              }
            >
              <option value="wall">Duvar</option>
              <option value="floor">Zemin</option>
            </select>
          </label>
          <label>
            Yüzey önerisi
            <select
              aria-label="Yüzey önerisi"
              value={options.finish}
              onChange={(e) =>
                edit({
                  ...options,
                  finish: e.target.value as NonNullable<
                    ServiceOptions["finish"]
                  >,
                })
              }
            >
              {(options.target === "wall"
                ? [
                    ["warm-white-paint", "Sıcak beyaz boya"],
                    ["sage-paint", "Adaçayı yeşili boya"],
                  ]
                : [
                    ["natural-oak", "Doğal meşe"],
                    ["neutral-stone", "Nötr taş"],
                  ]
              ).map(([id, label]) => (
                <option value={id} key={id}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <p>
            Onaylı hedef alanı ayrıca incelenmelidir. Burada yüzey önerisi
            kaydedilir; maske incelemesi ve gerçek üretim açık değildir.
          </p>
        </>
      )}
      {(serviceId === "P07" || serviceId === "P07b") && (
        <label className="ux-checkbox">
          <input
            type="checkbox"
            checked={consent}
            onChange={(e) => {
              setConsent(e.target.checked);
              setResult(null);
              key.current = null;
            }}
          />
          Bunun mevcut durum değil, dijital renovasyon konsepti olduğunu kabul
          ediyorum.
        </label>
      )}
      <div className="pe-request-summary">
        <strong>
          {photos.length} uygun fotoğraf · Bu istek için 1 fotoğraf
        </strong>
        <p>
          Beklenen sonuç: düzenlenmiş görsel. Üretim açılmadı; fiyat teklifi
          henüz yok. Kaydetmek üretimi veya ödemeyi başlatmaz.
        </p>
      </div>
      {error && (
        <p role="alert" className="ux-error">
          {error}
        </p>
      )}
      {result && (
        <div role="status" className="ux-note">
          <strong>
            {result.state === "cancelled"
              ? "İstek iptal edildi"
              : "Tercihlerin kaydedildi"}
          </strong>
          <p>{result.message}</p>
          {result.state === "awaiting-provider-approval" && (
            <button
              className="subtle"
              type="button"
              disabled={busy}
              onClick={async () => {
                if (locked.current) return;
                locked.current = true;
                setBusy(true);
                try {
                  setResult(
                    await api<ProductionRequestView>(
                      `/production/requests/${result.id}/cancel`,
                      {},
                    ),
                  );
                } catch {
                  setError(
                    "İptal isteği tamamlanamadı. Yeniden deneyebilirsin.",
                  );
                } finally {
                  locked.current = false;
                  setBusy(false);
                }
              }}
            >
              İsteği iptal et
            </button>
          )}
          {result?.state === "cancelled" && (
            <button
              className="subtle"
              type="button"
              onClick={() => {
                setResult(null);
                key.current = null;
              }}
            >
              Yeni istek hazırla
            </button>
          )}
        </div>
      )}
      <div className="ux-actions">
        <button
          className="subtle"
          type="button"
          onClick={onBack}
          disabled={busy}
        >
          Medyanı düzenle
        </button>
        <button
          className="ux-primary"
          type="button"
          disabled={
            disabled ||
            !restored ||
            busy ||
            !source ||
            ((serviceId === "P07" || serviceId === "P07b") && !consent) ||
            Boolean(result)
          }
          onClick={() => void save()}
        >
          {busy ? "Kaydediliyor…" : "Tercihleri kaydet"}
        </button>
        <button className="subtle" type="button" disabled>
          Oluştur — henüz kullanılamıyor
        </button>
      </div>
    </section>
  );
}
