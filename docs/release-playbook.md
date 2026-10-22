# Açılış, işletim ve geri dönüş

Bu sürüm yerel/sentetik laboratuvardır. Aşağıdaki playbook deployment talimatının icrası veya üretim kabulü değildir. Başlangıç harici bütçe **USD 0**; external gates kapalı kalır.

## Yerel işletim

`npm ci --ignore-scripts`, `npm run build`, `npm run start`; ayrı terminalde gerekirse `npm run worker:local`. Host yalnız 127.0.0.1; private data `.spaces-local/` veya `SPACES_LOCAL_DATA_DIR`. PGlite dizinini aynı anda ikinci süreçte açmayın. `npm run demo:local` uygulama dururken çalıştırılır. Worker başka cloud/AI/GPU/ödeme servisine bağlanmaz; process kapandıktan sonra arka planda çalışmaz.

İşler lease/epoch + attempt kaydı + outbox ile kalır. Crash sonrası app+loopback scheduler yeniden açılarak expired local lease en fazla iki denemeyle ele alınır; final failure/cancel reserve'i bırakır. Unknown external acceptance otomatik yeniden gönderilmez. Tenant başına 3 queued/processing, 3 rehber oturumu, 5 dakika voice TTL; dosya/iş/sanal bütçe sınırları kodda doğrulanır. Gerçek provider dakika/GPU/latency UNKNOWN'dır.

## Offline yedek ve restore

1. Next ve scheduler'ı düzenli durdurun; aktif yazma olmadığını doğrulayın. Private dizini ayrı, erişimi kısıtlı bir hedefe **yeni** kopya olarak alın; DB, private-objects ve session-signing.key birlikte gerekir. Key'i rapora/Git'e taşımayın.
2. Orijinal dizini silmeyin/üzerine yazmayın. Restore için **yeni boş dizin** kullanın; private file izinleri 0700/0600 olmalı.
3. Aynı pinned uygulama sürümünü bu dizinle açın. Membership, immutable revisions, file SHA256 ve purpose-scoped grant testini yapın. Yeni migration'lar yalnız yeni immutable migration dosyalarıdır.
4. `platform-restore.test.ts` gerçek disk DB kopyasında revision ve signing-key/grant bütünlüğünü, transaction rollback'i test eder. Harici Supabase/PITR, disk crash/WAL bozulması ve bölgesel felaket senaryosu test edilmiş değildir.

## Kod rollback

Korunan main'e force-push/reset/squash/rebase yapmayın. Hatalı değişiklik için yeni feature branch + ters/revert commit + bağımsız review + **Foundation acceptance** ile normal merge commit kullanın. Eski faz kodu ve tarihsel raporlar Git geçmişinde kalır. Kullanıcının untracked raporlarını veya private data dizinini silmeyin.

Migration rollback'i eski dosyayı değiştirmek veya canlı tablo DROP etmek değildir. Önce offline backup ve forward-compatible kod; ardından yeni düzeltici migration ve restore denemesi. Bu çalışmada hiçbir hosted migration/deployment uygulanmadı.

## Üretime açılış için tek gate listesi

| BLOCKER / exact step | Neden / en ucuz yol | USD üst sınırı | Privacy/terms / minimum owner eylemi |
|---|---|---|---|
| Bağımsız GitHub review | PR yazarı kendini onaylayamaz; yetkili reviewer gerçek diff'i inceler | Mevcut standart public CI dışında 0 | Reviewer atanması/approval; kurallar gevşetilmez. Normal merge ancak gerçek check+approval ile |
| Hosted auth/DB/storage/queue | Yerel PGlite gerçek multi-process/cloud auth yerine geçmez; önce ephemeral approved staging | Şu an 0; kaynak açma öncesi ayrıca net cap | Ayrı proje/account onayı, güvenli secret manager, region/backup/RLS test ortamı; chat/Git'e key yok |
| Video model enablement | Exact Kling O3/Seedance ID/schema/hesap; Veo preview shutdown; alternatif yeniden benchmark | Şu an 0; ücretli çağrı öncesi sabit deney tavanı gerekli | Model/version/account/terms/DPA/retention/region ve sentetik benchmark izni |
| ElevenLabs Spaces resource/session | Mevcut live agent kapsam dışı; yeni onaylı Spaces template/agent veya org template gerekir | Şu an 0; dakika+eşzamanlılık+overage sınırı ayrıca | Mevcut website agent'ına dokunmadan yeni resource için açık izin; secret manager, webhook key, region/DPA/retention ve gerçek rate/pricing doğrulaması |
| World Labs/Atlas | Marble export/benchmark/delivery hakları ve **prepaid dışı overage** riski; Atlas API belirsiz | Şu an 0; vendor hard cap kanıtlanmadan açılmaz | Legal haklar+hesap limitleri ve exact maliyet tavanı; auto-refill OFF hard cap değildir |
| Unreal / GPU / TURN | Engine yok; seat/distribution ve GPU/TURN bandwidth maliyeti açık | Şu an 0 | Legal/EULA, seçili engine version, CPU/GPU/stream benchmark ve bütçe; public streaming broker açılmaz |
| Gerçek müşteri/pilot/analytics/lead | Sentetik doğrulama hukuki uyumluluk beyanı değildir | Şu an 0 | Hak/izin/DPA/KVKK/GDPR/retention, gerçek kişi DSAR/lead/CRM doğrulama ve bağımsız pentest |
| Billing, domains, embed, release | Sandbox gerçek ödeme değildir; `.localhost` ownership/DNS kanıtı değildir | Şu an 0 | Ticari fiyat/sözleşme/komisyon, processor, DNS/CDN/deploy için ayrı yazılı izin |

Bu adımlar için secret değerleri talep edilmez. Bağımsız yerel geliştirme ve PR hazırlığı kapatılmadan önce yürütülür; kullanıcıya rutin faz kabulü yüklenmez.

## Compatibility / advanced backend

| Parça | Durum |
|---|---|
| Next/TypeScript + PGlite | Gerçek local build ve RLS testleri |
| FFmpeg 7.1.5 / Blender 4.3.2 | Gerçek H264 MP4 ve GLB üretimi, ffprobe/metric-door kontrolleri |
| Three/Chromium desktop + mobile emulation | Gerçek WebGL/free-walk/guide mock testleri; test renderer SwiftShader |
| Safari/iOS gerçek cihaz | NOT_VERIFIED; backlog |
| ElevenLabs React 1.19.1 / signed URL / webhook | Typechecked/offline contract + simulation; canlı session NOT_EXECUTED |
| Unreal Lumen/Niagara/Pixel Streaming | Build/run NOT_VERIFIED; engine/EULA/GPU yok. `unreal-build-plan.py` yalnız offline plan validator, engine otomasyonu tamamlanmış sayılmaz |
| Pixel capacity broker | 200 sentetik session baskı testi; gerçek GPU/ICE/TURN ağ testi değildir |

## Yayın öncesi asgari güvenlik

Production auth/session rotation, gerçek Postgres/Supabase RLS/cache/storage negative tests, object AV/sandbox, signed URL key rotation, worker container egress/FS/CPU/GPU quotas, durable queue multi-worker stress/restore, approved review/release separation, nonce CSP, webhook body/signature/dedup, consent/erasure/verified CRM conversion, partner/white-label pentest, gerçek Safari/audio latency ve measured capacity/cost olmadan üretim açılmaz. Fiyat ve performans bilinmiyorsa UNKNOWN kalır; testten kaçmak için gate düşürülmez.
