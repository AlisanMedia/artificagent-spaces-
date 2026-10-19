# Phase 1 mimari kararları ve ilerideki güvenlik sınırları

Durum: yalnız local foundation uygulanmıştır. Aşağıdaki gelecek servisleri bağlamak bu belgenin yetkisi değildir.

## Uygulanan kararlar

| ID | Karar | Gerekçe |
| --- | --- | --- |
| P1-01 | Next.js App Router, strict TypeScript | Tipli sayfalar ve gelecekteki server/client sınırları |
| P1-02 | Domain / application / contracts / adapter / composition / UI ayrımı | Gerçek servislerin daha sonra aynı portlara bağlanabilmesi; Phase 1’de yalnız fake |
| P1-03 | Yalnız source=synthetic fixture’lar | Gerçek müşteri verisi veya ingestion yok |
| P1-04 | Tek sekmede React state | Auth/storage yanılsaması yaratmadan, yenilemede sıfırlanan akış |
| P1-05 | Canonical config + sabit FNV demo ID | Aynı seçeneklere aynı plan; zaman, rastgelelik veya ağ etkisi yok |
| P1-06 | Kimliği “JSON storyboard / scene-plan” olan çıktılar | Sahte video/3D başarı iddiası yok |
| P1-07 | 3D için E2 fixture ve seçili sentetik floor-plan | Eksik geometrik kanıtta fail-closed akış; gerçek ölçüm iddiası yok |
| P1-08 | Private/provisioned servis yerine interface | Storage/router/workflow/GPU kurulmaz |
| P1-09 | CSS design token, Tailwind 4, native form/dialog | Az runtime yükü, klavye ve browser focus semantiği |
| P1-10 | Tam pinned dependency + lock + script’siz npm ci | Reproducible local kurulum ve daha küçük supply-chain yüzeyi |

FNV demo ID kriptografik hash veya idempotency/signed access mekanizması değildir. Prod kimlik/saga/ledger için kullanılamaz.

## Gelecek veri ve auth planı — uygulanmadı

1. Server tarafından doğrulanan oturum ve güncel organization membership; client seçili organization yetki kaynağı değildir.
2. organization_id her property/media/job/review kaydında; child→parent bileşik tenant FK.
3. API erişimi ve DB RLS birlikte; owner/service role bypass ve security-invoker view kontrolü.
4. Publishable istemci anahtarı ile server secret ayrımı; tarayıcıda service_role yok.
5. Private bucket, immutable asset ID/hash, kısa ömürlü read/write grant; path tek başına yetki değildir.
6. Quarantine, scan/decoder sandbox, EXIF temizliği, içerik/byte quota, rights/retention ve silme protokolü.
7. Transactional outbox + durable workflow, attempt/idempotency/cancellation epoch; budget reserve + usage reconcile.
8. Region/rights/model revision ve kalite kapısından geçen provider adapter; bilinmeyen erişimde blok.
9. Ayrı CPU/GPU build ve stream worker; job-scoped capability; VRAM, session TTL ve spend cap.
10. Yayınlanan sürüm, reviewer, provenance ve revoke; gerçek E2E negatif tenant testleri.

Bu maddeler için migration, SQL, credential, SDK, auth route, HTTP provider adapter veya kaynak yoktur.

## Planlanan migration / rollback yaklaşımı — uygulanmadı

İlk DB fazında expand/migrate/contract stratejisi, nullable→backfill→constraint sırası, composite FK ve RLS negatif testleri hazırlanmalı. Yedekleme/restore kanıtı olmadan destructive migration yapılmamalı. Geçiş/rollback süre ve veri etkisi ayrı owner paketinde incelenmeli.

Phase 1’de migration ve kalıcı veri olmadığından rollback local branch/commit düzeyindedir.

## Güvenlik sınırı

Fixture scope kontrolü, TypeScript veya bir React context gerçek tenant izolasyonu değildir. SVG’ler statik yazılmış yerel çizimlerdir; model çıktısı veya kullanıcı dosyası kabul edilmez. Review checkbox’ları gerçek yayın yetkisi vermez.

CSP’de statik hydration gereği unsafe-inline istisnası bulunur. Inline HTML render API’si, runtime fetch/WebSocket, external SDK ve server integration route’ları static guard tarafından engellenir; bu, gelecek fazlara yönelik tam güvenlik modeli değildir.

## Korunan PR için gelecek repository gereksinimleri

Geçerli owner remote’u sağlandığında ayrı izinle branch push/draft PR; main’e doğrudan yazma kapalı; required “Foundation acceptance” check, en az bir bağımsız review, son değişiklikte stale review dismissal ve force-push kısıtı. Bu ayarlar yerel Git dosyasıyla uygulanamaz; bu teslimde uygulanmış değildir.
