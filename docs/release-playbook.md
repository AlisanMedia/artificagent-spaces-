# Açılış, işletim ve geri dönüş

Bu sürüm yerel/sentetik laboratuvardır. Aşağıdaki playbook deployment talimatının icrası veya üretim kabulü değildir. Başlangıç harici bütçe **USD 0**; external gates kapalı kalır.

## V5.7 addendum — 30 Ekim 2026

[Hizmet motoru kapsamı](premium-production-v57.md) güncel offline sözleşme/transport/QA kodunu ve eksikleri ayırır. fal video/kontrollü edit, Pedra fotoğraf (ve isteğe bağlı gerçek360), World Labs AI3D için ayrı şema, izin ve maliyet kapıları vardır. Yeni gate-first server HTTP kodu **açık değildir ve ağ dalları canlı test edilmedi**. PGlite request/inbox/PNG teslim testleri hosted worker/auth/storage/AV/KMS veya provider output doğrulaması yerine geçmez. Yeni fotoğraf formu yalnız tercih kaydeder; müşteri ücretli üretimi başlatamaz. Eski V5.4 NOT_IMPLEMENTED kayıtları tarihsel transport durumudur, bugün canlı entegrasyon yine yoktur.

V5.7 migration yalnız ayrı yerel test veri dizinlerinde uygulanır. Eski V5.6 uygulaması yeni tablo/trigger içeren DB'ye doğrudan geri bağlanmaz; restore için ayrı eski-version backup/worktree kullanılır. Gerçek ağ açılışından önce actual provider artifact intake, özel depoya byte doğrulama, queue/grant-window reconciliation, current role/revision/fence, gerçek independent review UX, hard spend cap ve gerçek fiyat/kalite/rights benchmark'ı tamamlanmalıdır. Gerekli secret **adları** FAL_KEY / WORLDLABS_API_KEY / PEDRA_API_KEY; değerler yalnız yetkili server secret manager'da. Bir env/key bu sürümün sabit kilidini açamaz. USD0, Vercel billing/deployment yasağı ve PR2–4 bağımsız review şartı sürer.

## V5.4 güncel kilit ve gelecekteki sağlayıcı açılışı

27 Ekim 2026 owner talimatıyla **yeni Vercel deployment/deneme/account/project ve bütün gerçek sağlayıcı çağrıları bu görevde kapalıdır**. Önceki Preview/team istisnasıyla engel aşılamaz; V5.3.1 billing doğrulama kapısı korunur. Bu değişiklik yerel ürünü yeniden kurmaz; mevcut korumaları daraltmaz.

Gelecekte yalnız ayrı açık owner izniyle: fal.ai video, World Labs AI3D ve isteğe bağlı Pedra gerçek360 için hesap/model erişimi, downstream reseller/white-label hakkı, input/output training, DPA/retention/region ve harcama/yeniden-deneme/overage tavanı yazılı doğrulanır. Sadece hakları açık sentetik fixture, belirli model ve belirli toplam USD tavanı seçilir. Varsayılan provider fallback kapalı kalır. Müşteri fotoğrafları bu deney izninin kapsamı değildir. Pedra turu kamuya açık bağlantı oluşturabileceğinden ayrı yayın/veri izni de gerekir.

Ancak bu kararlardan sonra sunucu secret yöneticisine `FAL_KEY`, `WORLDLABS_API_KEY`, isteğe bağlı `PEDRA_API_KEY` atanabilir. Değerler chat, Git, browser, log, screenshot veya CI artifact'ine yazılmaz. `SPACES_PROVIDER_LIVE_ENABLED=false` ve `SPACES_EXTERNAL_MAX_USD=0` bugünün kilitli varsayılanlarıdır; flag değiştirmek mevcut adapter'ı etkinleştirmez. Gerçek transport, atomik yetkili maliyet rezervasyonu, kısa ömürlü server-issued kaynak URL'leri, egress/SSRF/byte/decoder kontrolleri, doğrulanmış webhook ve özel depoya normalize edilmeden canlı açılış yoktur. Mevcut sentetik `maxCostMicroUsd: 0` kuralı korunur. Bu sürümde transport açılışı **NOT_IMPLEMENTED / BLOCKED_EXTERNAL_APPROVAL** kalır.

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

## CI okuma yetkisi ve merge kapısı

Actions token `contents:read` kalır. GitHub bu token’dan repository merge setting / bypass listesini gizleyebilir. CI effective main rules endpoint’inden PR/approval/stale/conversations, strict Foundation acceptance+15368, deletion/force yasağını doğrular; gizli alanlar **NOT_VISIBLE_TO_READ_TOKEN / PARTIAL_READ_ONLY** olarak işaretlenir. Bu full governance PASS değildir. Merge öncesi yetkili owner integration ile varsayılan **full** `verify-repository.mjs` zorunludur; alanlar görünmüyorsa veya bypass boş değilse bloklar. İlk run 39817002455 eksik metadata’yı yanlışlıkla kapalı setting sayan assertion yüzünden başarısızdır; sonraki head/run ayrı kanıttır. Daha geniş token yetkisi veya repo koruma değişikliği yapılmadı.
