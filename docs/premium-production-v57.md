# V5.7 — hizmete özel üretim motoru

30 Ekim 2026. Owner paketindeki üç belge eksiksiz okundu. Baz: `a2d1edf791f26c364f660212f53c92e19d8a72a0`; yeni branch `build/v5-7-production-engine-reviewed`. Bu belge canlı kullanım, hesap erişimi, sağlayıcı kalitesi veya ticari açılış onayı değildir. Harici bütçe USD0; yeni deployment ve gerçek sağlayıcı çağrısı yapılmaz. Önceki owner raporları tarihsel kanıttır ve değiştirilmez.

## Müşterinin yolu

`/spaces` ilk yükleme eylemini ve eski gerçek yerel MP4/3D işlerini korur. Yedi aile: AI Emlak Video, Fotoğraf İyileştir, Sanal Mobilya, Odayı Boşalt, Nesne Kaldır, Gökyüzü/Akşam, 360° Sanal Tur. Renovasyon ve AI3D ayrıca Konsept/Deneysel altında açılır. Müşteri model veya prompt seçmez. Video yerel kurgu yolunu korur; canlı AI işlemi değildir. Fotoğraf yolu mevcut hak/sentetik veri onayı, magic/decode, özel yükleme, thumbnail/sıralama ve immutable revision altyapısını kullanır.

Fotoğraf düzenlemede en fazla iki seçim ve gerekiyorsa konsept onayı gösterilir. İlk fotoğraf ayrı bir üretim isteğine bağlanır; her fotoğrafın ayrı incelenmesi gerekir. `Tercihleri kaydet` gerçek, kalıcı bir **engellenmiş üretim isteği** kaydeder. `Oluştur` kapalıdır. İstek veya fiyat uydurulmaz, borç/rezervasyon oluşmaz. Liste/get/iptal gerçek API yollarıdır; refresh aynı yetkili mülk/sürüm/hizmette kendi isteğini ve seçeneklerini getirir. Yeni kaynak sürümü eski isteği geçersiz kılar.

75 başlıklı V5.6 katalog müşteri ekranından kaldırıldı; yönetimde Operasyon → Araştırma kataloğunu aç yolundadır. Önce server `admin` yetkisi doğrulanır. Kataloğun pazarlama gözlemleri hizmetlerin çalıştığı anlamına gelmez; eski enum/yerel araçlar silinmedi. Konut kredisi/kira senaryo hesapları müşteride ayrı, cihaz içi araçlardır; banka/CRM/telemetri/kalıcı form kaydı içermez. PUBLIC kaynak kod, araştırma metninin ticari sır olarak saklandığı iddiası değildir.

`/spaces/showcase` yalnız mevcut hakları açık medya gösterir. Video kaynağı ile gerçek yerel MP4, yerel Sharp ton/netlik çifti, sentetik GLB ve CC0 equirectangular panorama ayrı etiketlidir. Yeni mobilya/boşaltma/nesne/akşam/renovasyon için gerçek sağlayıcı çıktısı yoktur; **Doğrulanmış hizmet sonucu henüz yok** gösterilir. Stok veya eski örnek bu sağlayıcının sonucu olarak sunulmaz. İzole statik pakette sunucu/hesap/üretim/istek API'si yoktur; fotoğraf isteği bağlantıları da kapalıdır.

## On beş bağımsız sözleşme

Tüm satırlar DISABLED. “Hazır” burada offline builder/parser ve test kapsamıdır; model hesabı, gerçek sonuç veya reseller hakkı değildir.

| ID   | Hizmet / sürüm                             | Motor ve wire kapsamı                                         | İlave doğrulama                                                                        |
| ---- | ------------------------------------------ | ------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| V01  | Doğal Tur · video.natural.v1               | fal Kling v4; integer3–30sn,1080p                             | görünür tek oda; kaynak çizgileri; kamera hareketi                                     |
| V02  | Premium · video.premium.v1                 | fal Seedance2.5US; string4–30sn,1080p,auto,H264,sesfalse,high | gerçek dosyanın ses/kodek/metadata ve temporal QA'sı                                   |
| V03  | Mekânı Keşfet · video.explore.v1           | fal Kling v4; tek yavaş pan                                   | karo/zemin/oda genişlemesi                                                             |
| V04  | Dış Cephe · video.exterior.v1              | fal Kling v4; sanal crane                                     | doğrulanmış dış cephe; yeni kat/komşu/çatı reddi; drone iddiası yok                    |
| P01  | Fotoğraf İyileştir · photo.enhance.hifi.v1 | Pedra enhance; highFidelity:true                              | prompt yok; kadraj/metadata/yapı                                                       |
| P02  | Perspektif · photo.perspective.hifi.v1     | Pedra enhance_and_correct_perspective                         | prompt yok; perspektif düzeltme survey değildir                                        |
| P03  | Sanal Mobilya · photo.furnish.v1           | Pedra furnish; doğrulanmış enum oda/stil                      | boş oda kanıtı; sabit yapı ve eşya ölçeği; staging beyanı                              |
| P04  | Odayı Boşalt · photo.empty.v1              | Pedra empty_room                                              | sabit tesisat/kolon/pencere kaldırılamaz; hayalet iz/yüzey kontrolü                    |
| P05  | Nesne Kaldır · photo.remove.mask.v1        | Pedra remove_object; maskUrl                                  | kaynak/ölçü/hash bağlı onaylı maske; yapısal bölge/atıf koruması                       |
| P06  | Gökyüzü/Akşam · photo.sky.v1               | Pedra sky_blue; beş doğrulanmış skyStyle                      | dış cephe/ufuk/yansıma ve dijital ışık beyanı                                          |
| P07  | Renovasyon · photo.renovate.v1             | Pedra renovation; preserveWindows:true,furnish:false          | açık konsept onayı; sabit enum stil                                                    |
| P07b | Boya/Zemin · photo.precision-edit.v1       | fal Nano Banana Pro Edit;2K,auto,png,num_images1              | onaylı hedef+uyumlu finish+insan onaylı hedef bölgesi; ayrı maske/kayıtlı onay gerekir |
| T01  | 360 · tour.360.v1                          | Pedra create/get tour                                         | 2:1 tek başına yeterli değil; capture incelemesi+ayrı public hosted yayın izni         |
| T02  | AI3D · world.ai3d.v1                       | World Labs Marble1.1Plus;private media_asset reference        | çoklu görseller aynı oda; azimuth uydurulmaz; ölçülü dijital ikiz iddiası yok          |
| B01  | İlan Paketi · bundle.listing.v1            | iç kompozisyon; gerçek bounded ZIP                            | yalnız onaylı, aynı tenant/property/revision/hash çıktılar; paket ayrıca review ister  |

V5.4 `property-video-v1` immutable yerel iş/provenance yolu aynen korunur. Yeni `video.*.v1` aday promptları ayrı sunucu modülündedir; eski işleri veya kaynak geçmişini yeniden yazmaz. Canlı servis kapalıyken eski yerel iş yeni promptun gerçek model testi olarak sunulmaz.

## Resmî şema kanıtı

`fixtures/providers-v57/sources.json`: 30 Ekim credential içermeyen public HTTPS GET'lerinin tarih/HTTP/hash kayıtları. Tam üçüncü taraf HTML, örnek medya ve gizli runtime çıktıları PUBLIC repo'ya kopyalanmadı. Seçilmiş fal OpenAPI input/output alt şemaları ve endpoint bazlı Pedra özeti kayıtlıdır. `npm run production:verify` iki build yolunda zorunludur; 15 kayıt, kaynak ve prompt/profile sürümünü, 30 unrun/null puanlı benchmark planını denetler. Bu komut internete veya inference'a çıkmaz.

- [fal Kling4](https://fal.ai/models/kling/v4/image-to-video/api), [Seedance2.5US](https://fal.ai/models/bytedance/seedance-2.5/us/image-to-video/api), [Nano Banana Pro Edit](https://fal.ai/models/fal-ai/nano-banana-pro/edit/api).
- [Pedra Enhancement](https://pedra.ai/api-documentation/image-enhancement), [Staging](https://pedra.ai/api-documentation/virtual-staging), [360](https://pedra.ai/api-documentation/virtual-tours).
- [World models](https://docs.worldlabs.ai/api/models), [generate](https://docs.worldlabs.ai/api/reference/worlds/generate), [media upload](https://docs.worldlabs.ai/api/reference/media-assets/prepare-upload), [examples](https://docs.worldlabs.ai/api/world-generation-examples).
- [fal queue](https://fal.ai/docs/documentation/model-apis/inference/queue), [webhook raw-body verification](https://fal.ai/docs/documentation/model-apis/inference/webhooks).

Kling/Seedance seçili şemalarında `negative_prompt` yoktur; gönderilmez. Risk etiketleri ayrı iç QA verisidir. Seedance duration string ve generate_audio:false; Kling ses/codec parametresi uydurulmaz. P03 yalnız doğrulanmış sekiz oda ve seçilmiş beş stil enum'u kullanır; dokümandaki serbest metin/reference-style URL yolları kapalıdır. Deprecated creativity, propertyId/gallery kalıcılığı, özgün dosya adı ve serbest prompt Pedra'ya gönderilmez.

Güncel Pedra alanı **preserveAspectRatio**; bazı eski snapshot'larda farklı ad bulunduğu kaydedilir. Seçilen profil bunu **false** gönderir: true, merkez kırpıp yeniden boyutlandırabilir. Sonuç aynı kadraj/ölçü kontrolünü ayrıca geçmelidir. Enhance/perspective/furnish/empty/renovation `output:[{url}]`; remove/sky `output:{url}`. Şema değişiminde toleranslı fallback yerine ret vardır. Credentials gelecekte yalnız server secret abstraction üzerinden Pedra body apiKey/fal Key/World WLT-Api-Key konumuna gider; bugün getter dahi çağrılmaz.

World payload private permission + hazır server-scoped media asset kimlikleri kullanır. Birden fazla oda birleştirilmez; azimuth alanı hiç türetilmez. Media asset prepare-upload ve operasyon endpoint builder'ları kapalıdır; gerçek upload/READY uzlaştırması ve ücretli export entegre edilmedi. SPZ, panorama, collider, GLB ve PLY farklı türlerdir. Mevcut GLB viewer bir Marble SPZ uyumluluk testi değildir.

## Güvenlik ve durable durum

Yeni additive migration yalnız yerel PGlite'ta çalıştırılır. `production_requests`, `production_sources`, `provider_callback_inbox`, `production_artifacts`, `production_reviews`: forced RLS, composite tenant/property/revision/media referansları, immutable kaynak ve review kayıtları. spaces_app üretim/artefact onay durumunu doğrudan değiştiremez. Hazırlık endpoint'i admin; müşteri endpoint'i session+membership+RLS ile sınırlıdır. URL/hizmet/property ID seçimi yetki değildir. İstek kaydından sonra yeni yükleme yeni revision açar; eski grant/istek/teslim reddedilir.

Plan source SHA, sürüm, parametre/profile/prompt SHA ve idempotency fingerprint taşır. Aynı key farklı kaynak/ayar için reddedilir. Organizasyon başına admission transaction lock ve 64 bekleyen istek sınırı; offline attempt reducer en fazla iki kanıtlı-not-accepted deneme,12poll,fence/cancel/timeout ve grant-expiry HOLD uygular. Gerçek hosted queue/backpressure/load testi yapılmadı.

`LockedProductionTransport` ve `LockedCandidateRetriever` kod kilidi ilk satırda kapalıdır. Bir key veya env flag açamaz. Kaynakların ≤60sn private scope doğrulaması, provider bekleme penceresiyle ayrıca uzlaştırılmalıdır; otomatik TTL genişletme yoktur. Hazırlanan kaynak grant'i gerçek hosted issuer kurulmuş demek değildir. Gelecekteki egress kodu exact provider hosts/path/TLS, timeout/byte cap, no redirect, sonuç tarafında private/reserved IPv4 ret uygular; **kilidin arkasındaki gerçek ağ dalları çalıştırılmadı**. AV/container/KMS/egress ağ politikası yerine geçmez.

fal callback canlı HTTP endpoint'i açılmadı. Offline test raw-body SHA+Ed25519+account/request binding+±300sn+trusted JWKS yaşı kontrol eder; kalıcı inbox'a yalnız body hash/status yazar. Duplicate replay yeniden işlenmez. Callback başarılı olsa da QA HOLD; ne output URL ne embed HTML müşteri teslimi olur. Unknown acceptance/timeout/cancel after acceptance rezervi serbest bırakmaz veya tekrar ücretli submit yapmaz; actual cost UNKNOWN/NULL kalır. Server JWKS fetch/scheduler/circuit breaker/gerçek provider reconciliation canlı sisteme bağlı değildir.

## Gerçek dosya QA ve teslim kapsamı

Fotoğraf byte pipeline gerçek PNG/JPEG/WebP magic+bounded Sharp decode, tek sayfa, ölçü/kadraj, metadata temizliği, blank/clipping, basit edge-disagreement ve ROI dışı değişim ölçer. Binary PNG maske aynı kaynak hash/tenant/property/revision/ölçüyle eşleşmeli; boş/tam/çok geniş/nonbinary/alpha maske veya korunan mimari/atıf pikseli reddedilir. Dış değişim için yalnız iki piksellik blending sınırı tanınır. Eşikler **gerçek sağlayıcıda kalibre edilmedi**; semantik kapı/pencere tanıma, keypoint/homography registration, optical-flow/reflection/scale inference eksiktir. Ölçümler triage'dır, gerçek mülk doğruluğu kanıtı değildir.

`ProductionArtifactDelivery.ingestOfflineFixture` yalnız internal test yoludur; HTTP import endpoint'i yoktur. Gerçek private0600 PNG kaydeder, source revision+worker fence'i commit sırasında yeniden denetler, geç/iptal sonuçta kendi dosyasını temizler. Critical finding REJECTED; diğer şüphe QA_HOLD; temiz dosya bile AWAITING_INDEPENDENT_REVIEW. Yeni fotoğraf tesliminin API'si farklı güncel reviewer + dört truth/privacy/hak kontrolü + exact output hash ister. Approved-only60sn session/property/revision/hash grant, expiry/revoke ve disk hash kontrolü vardır. Bunlar sentetik test hesaplarıdır; gerçek bağımsız insan kabulü değildir. İlerideki provider fotoğraf review UI/preview receipts ve worker bağlama ayrıca tamamlanmalıdır.

Video için var olan FFmpeg/ffprobe full decode,codec/audio/privacy,blank/freeze,caption ve klip bazlı kaynak+review hattı korunur. Yeni canlı kliplerin bu kuyruğa alınması, 1080p kabulü ve gerçek temporal/architectural QA entegre/test edilmiş değildir. Yeni 3D/360 sağlayıcı çıktıları indirilip tarayıcıda denenmedi. B01 gerçek ZIP üretir; public HTTP paket yayını veya finansal işlem değildir. Kaynak dosyanın encoding başarısı, AI modelinin kaynağa sadakati değildir.

## Ölçüm, benchmark ve dış kapılar

30 risk/oda senaryosu `fixtures/production-v57/evaluation-plan.json` içinde **fixture planı**dır. Bunların30'u render edilmiş/üretilmiş gibi sayılmaz; source/output/hash/rater/acceptance NULL ve benchmark NOT_RUN. Gerçek model testi,30 izinli kaynak ve en az iki bağımsız kör insan değerlendirmesi ister. Mimari kritik hata yüksek ortalamayı geçersiz kılar. Maliyet yalnız kabul edilenlere değil **tüm attempts/rejects/retries + review/compute/storage/bandwidth** paydasına bağlıdır. Gerçek accepted-output cost ve kâr UNKNOWN; V4 modelindeki NULL kuralı korunur.

[fal Terms](https://fal.ai/legal/terms-of-service) Customer Solution/End Users hakkı yanında non-sublicensable ve resale/service-bureau kısıtları içerir; [API Services](https://fal.ai/legal/api-services) Excluded/Pending Enterprise Ready modellerinde training/DPA istisnaları içerir. Bu iki metin seçili modellerin ajans→müşteri→alt bayi lisansı veya hukuki kabulü değildir. Pedra OEM/reseller/DPA/retention/output/privacy ve hosted public tour hakları yazılı teyit ister. [World Terms](https://www.worldlabs.ai/terms-of-service) paid output/input-training ayrımı, ileriye dönük opt-out, attribution ve benchmarking/competitive-analysis kısıtları içerir. Yazılı izin olmadan World Labs karşılaştırmalı benchmark yoktur. Hukuki yorum/onay verilmedi.

Gerçek açılış kapıları: seçilen **fal.ai / World Labs / opsiyonel Pedra** hesap/model erişimi; yazılı downstream reseller/OEM ve DPA/training/retention/region; provider/global/per-job hard spend cap + açık owner USD bütçesi; server secret manager (değerler chat/Git/browser'a konmaz); hosted auth/DB/private storage/secure queue/OS sandbox/AV/KMS/backup/deletion; gerçek provider-çıktı benchmark ve bağımsız kabul; PR2–4 inceleme; Vercel billing ve ayrıca yayın onayı. Mevcut web sitesi/ElevenLabs Voice Experience/Gold/AntiGravity bu işin kapsamında değildir. Vercel billing gate korunur, yeni deployment/URL oluşturulmaz.

## Komut ve rollback

```bash
npm ci --ignore-scripts
npm run check
npm run test:governance
npm run test:e2e
npm run security:secrets
npm run security:audit
npm run sbom
npm run golden:verify
npm run production:verify
npm run preview:build
npm run preview:test
```

Yerel örnek: `npm run start` → loopback `/spaces` → Sanal Mobilya tercihlerini hazırla → yalnız sentetik PNG/JPEG yükle → oda/stil → Tercihleri kaydet → gerçek bekleyen kayıt/iptal. Canlı üretim düğmesi kapalı kalır. Yönetim kataloğu normal müşteri ekranında yoktur.

Önce uygulama/worker durur, private runtime yedeklenir; eski veriye destructive SQL/down migration uygulanmaz. Geri dönüş eski V5.6 branch'i ayrı worktree'de ve **ayrı** veri dizininde açmaktır. Eski runtime yeni migration'lı DB'ye bağlanmaz. İleride revert gerekiyorsa normal yeni commit + bağımsız review/check, force/reset/rebase/silme yoktur. Parent/main ve owner dosyaları korunur. Gerçek test/CI/HEAD/ekran kanıtları tek owner raporunda ayrı tarihle verilir.
