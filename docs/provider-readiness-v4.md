# V4 sağlayıcı hazırlığı — resmî doküman snapshot'ı, 23 Ekim 2026

**Inference/account/credential oluşturma veya paid test YAPILMADI.** Herkesçe açık resmî sayfalar GET ile okundu. URL, final redirect, tarih, HTTP sonucu ve SHA256 `provider-evidence-v4.json` içindedir. HTTP200, hesap erişimi/hak/kalite anlamına gelmez. Eski V2 snapshot'ı tarihsel olarak korunur.

## Bugünkü kanıt

| Aday / yol | VERIFIED: dokümanda gerçekten görülen | NOT_VERIFIED / etkin durum |
|---|---|---|
| Kling doğrudan | [Developer sayfası](https://app.klingai.com/global/dev/document-api/apiReference/model/omniVideo) Kling domain'ine redirect; SPA kabuğu okunabildi | Exact doğrudan O3 model/schema/price/access/region/retention UNKNOWN; eski adapter disabled |
| Seedance doğrudan | [BytePlus video API](https://docs.byteplus.com/en/docs/ModelArk/Video_Generation_API) genel navigasyon | Exact direct2.5 wire/access/price/retention NOT_VERIFIED; disabled |
| Kling / Seedance, **Runway üzerinden** | [Resmî Runway API](https://docs.dev.runwayml.com/api/) embedded OpenAPI: `klingO3_standard`, `klingO3_pro`, `seedance2_5`. Bu gateway yolunun dokümante ID'leridir | Doğrudan vendor erişimi ile karıştırılmaz; hesabımızın entitlement/model weights revision, lisans/DPA/region/retention doğrulanmadı; etkin değil |
| Runway kendi modelleri | `gen4_turbo`, `gen4.5`, POST `/v1/image_to_video`, API header2024-11-06;2–10 integer sn,1280:720 /720:1280 dahil ratio enum | Alias sabit weight revision değildir. Dar offline data-URI request builder ve kapalı submit var; gerçek HTTP transport/usage/download/cancel entegrasyonu yok |
| Veo3.1 Gemini | [Google video](https://ai.google.dev/gemini-api/docs/video) preview ID'lerinin **22 Ekim 2026 kapandığını** söylüyor | Eski Gemini preview job yolu açılmaz; sessiz yeni modele fallback yok |
| Veo3.1 Runway | Runway OpenAPI `veo3.1`,4/6/8sn,720p/1080p ratio ve audio seçeneği listeliyor | Gemini shutdown ile farklı sağlayıcı yolu; gerçek hesap/GA/region/rights NOT_VERIFIED. Audio default true olduğundan gelecekte açıkça kapatılmalı; çağrı yok |
| World Labs Marble | [World API](https://docs.worldlabs.ai/api): `marble-1.1`/plus; image/multi-image/video/text girişleri, operations, GLB/PLY export yolları | Video modeline eşit değildir. Gerçek geometri/metric scale/fidelity/relighting/retention/region/benchmark hakları kanıtlanmadı; disabled |
| Atlas | Okunan World API'de genel Atlas API/hak kanıtı yok | R&D-only, endpoint veya model ID uydurulmadı |

Runway şema snapshot'ında Kling standard720p,pro1080p,3–15sn; Seedance2.5,4–30sn veya `auto` ve480/720/1080p listelenir. Biz `auto`,4K, audio, router/fallback ve video-reference wire yüzeylerini etkinleştirmedik. Tam model başına constraint'ler JSON içindedir. Yerel neutral intent, vendor yeteneği vaat etmez; desteklenmeyen sürüm/ratio/resolution/ref-kind/duration reddedilir.

## Fiyat ve operasyon gerçekliği

[Runway fiyatları](https://docs.dev.runwayml.com/guides/pricing/):1credit=$0.01. Yayınlanan output saniyesi: Gen4Turbo5credit=$0.05; Gen4.5,12credit=$0.12; KlingO3standard13credit=$0.13,pro17credit=$0.17. Seedance2.5,480/720/1080p için20/30/68 output credit/sn +10/15/34 input/reference-video credit/sn (combined video≤30sn,minimum80credit); reference images/audio tabloda ücretsiz. Veo3.1, ses yok20credit/sn; ses var40credit/sn. Bunlar **yayınlanmış tarife**, bu hesabın vergi/minimum satın alma/failed-task/refund/billing anlaşması veya kabul edilmiş çıktı maliyeti değildir. Production ekonomi seçili/onaylı tarife olmadığından NULL tutar.

[Runway tiers](https://docs.dev.runwayml.com/usage/tiers/): model/project/tier bazlı concurrency/daily/monthly limit, THROTTLED queue ve load istisnaları var; bizim gerçek tier/concurrency/SLA UNKNOWN. [Autobilling](https://docs.dev.runwayml.com/usage/autobilling/) otomatik kredi alımı ve minimum$10 **recharge** anlatır; bu manuel minimum satın alma veya bizim hard cap'imiz sayılmaz. Account ayarına girilmedi, ödeme açılmadı.

[World Labs fiyatları](https://docs.worldlabs.ai/api/pricing):1250credit=$1,minimum purchase$5. Generation bileşenleri ve export/pano masrafları ayrı olabilir; prepaid bakiye ve auto-refill OFF **overage hard cap değildir**. [Rate limits](https://docs.worldlabs.ai/api/rate-limits):default yaklaşık3start/dk,60/saat; onaylı higher-throughput farklıdır. Start limiti eşzamanlı dünya/SLA garantisi değildir.

## Hukuk, privacy ve region — açılmamış kapılar

[Runway Terms](https://runwayml.com/terms-of-use) §4.4 girdi/çıktı eğitim ve kullanımına ilişkin geniş lisans hükümleri içerir. Ticari output izni bulunması, özel konut/customer image transferine veya DPA/retention onayına eşit değildir. Exact enterprise no-training, residency ve retention NOT_VERIFIED. Kaynakları vendor'a göndermek için owner/legal onayı gerekir.

[Google Terms](https://ai.google.dev/gemini-api/terms): unpaid ve paid data use ayrılır; unpaid girdiler geliştirme/eğitim ve insan incelemesine konu olabilir; paid için sınırlı abuse log ve farklı ülke transient storage ifadeleri var. [Available regions](https://ai.google.dev/gemini-api/docs/available-regions) Türkiye'yi genel API için listeler; bu hesabın belirli video model yetkisi veya EU-residency garantisi değildir. Veo/Gemini yolu ayrıca kapanış durumu nedeniyle yeni işlere bağlanmaz.

[World Labs Terms](https://www.worldlabs.ai/terms-of-service) free/payed output haklarını ayırır; competitive analysis/benchmarking kısıtı, API/cache/retention/region ve training hükümleri nedeniyle **yazılı benchmark/export/delivery hakkı ayrıca netleşmelidir**. World Labs bake-off'tan şimdilik hariçtir. Bu açıklama hukuki görüş/uygunluk beyanı değildir.

## Çalışan kapalı sözleşme

`ShotIntent`: tenant/property/revision/manifest hash, evidence ID/hash/kind/truth, süre/aspect/resolution/model+revision, confirmed-regions camera intent, forbidden claims, rights/moderation, idempotency/cancel epoch ve cost cap. Context backend'den onaylı olmalıdır; bu validator gerçek auth/RLS yerine geçmez.

`ProviderReadinessHarness`: yalnız injected **local** renderer,0USD ve doğrulanan gerçek artifact portu. Model/capability/scope/price/cap kontrolleri; en fazla2 known-not-accepted retry, unknown acceptance/timeout HOLD_UNKNOWN, geç sonuç fencing, charge/release kaydı ve idempotency. Sınır32 ephemeral çalışma. Gerçek durable JobService/ledger değiştirilmedi; harness production queue veya gerçek finans ledger'i değildir. Testte gerçek job→FFmpeg→private file→ffprobe/full-decode→artifact SHA çalışır, JSON video gibi kabul edilmez. Garanti: **NONE_HUMAN_REVIEW_REQUIRED**; hallucination garanti edilmez.

Runway builder yalnız belgelenmiş dar2model/2ratio/data-URI alt kümesidir, secret **adı** kontrattır; değer/env okunmaz, fetch/SDK/credential/network yolu yoktur. Kling/Seedance/Veo/Marble/ElevenLabs portları kapalıdır; mevcut ArtificAgent website agent'ına dokunulmadı. Client preview veya sözleşme testi release approval kazandırmaz.

## En küçük sonraki ücretli benchmark — henüz izin yok

`config/provider-benchmark-v4.json`, `npm run benchmark:plan`: **NO_NETWORK**, ownerSelectedHardCap=NULL / approved spend0. Çalışan hesaplama inference başlatamaz.

İlk ekranlama: aynı2sentetik image hash'i, aynı5sn shot intent, aynı720p/yatay ve ses kapalı; Gen4Turbo vs Gen4.5.4çıktı,20üretilen saniye. Yayınlanan tarife tabanı **$1.70**, her shot için en fazla1retry ile inference envelope **$3.40**. Vergi, minimum kredi satın alma, storage/human QA ek veya UNKNOWN. Önerilebilecek küçük owner toplam tavanı **$10**, yalnız owner seçip toplam purchase/usage/overage sınırını doğrularsa; bu rapor izin değildir. Account minimum/hard-cap bu tavana sığmazsa çağrı durur, yeni owner kararı gerekir. Autofill yok, başka modele paid fallback yok, unknown submit yeniden gönderilmez.

İki bağımsız değerlendirici provider/model kör ID'leriyle tam videoyu ve aynı kaynakları değerlendirir; ilk3sn/continuity/architecture/readability/branding/channel/sales0–5. Uydurma kapı/pencere/manzara/ölçü veya rights ihlali kritik red; her kriter en az3, toplam hedef≥4 yalnız **önerilen**, onaylanacak acceptance eşiğidir. Provider kimliğini saklayan shuffle seed/provenance ve hash'ler tutulur, başarısız denemeler maliyete dahil edilir.

Bu20sn mikro-deney,30/60sn müşteri teslimi veya kârlılık kanıtı değildir. Sonraki ölçüm: her iki model için6×5sn ve12×5sn shot'lardan30/60sn teslim; aynı refs/şablon/iki kör reviewer. Tek ilk attempt inference toplam **$15.30**, en fazla iki attempt her shot için **$30.60**; tam toplam harcama tavanı ayrıca owner seçer. İndirme/yerel storage, actual failed/retry billing, gerçek insan dakikası, accepted=0 durumu, kurgu sürekliliği ve cost/accepted deliverable raporlanır. Sadece başarılı kısa clip'in saniye fiyatıyla kâr ilan edilmez.

Tüm gerçek çağrı öncesi: secure secret manager, ayrı Spaces scope, model/account/version, hard reserve, rights/DPA/training/retention/region ve ücretli aksiyon yazılı onayı. Müşteri verisi yok, yeni paid resource otomatik yok, mevcut ElevenLabs agent kapsam dışıdır.
