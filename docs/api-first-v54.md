# V5.4 — API-first stüdyo ve kapalı sağlayıcı sözleşmeleri

27 Ekim 2026. Owner'ın mesajda bulunan tam master prompt'u bu değişikliğin kapsamını belirler; ZIP ve HTML konsept dosyası yürütme ortamına eklenmediği için bunların incelendiği iddia edilmez. Bu dosya önceki raporları değiştirmeyen bir V5.4 addendum'udur. Uygulanan ve dış onaya bağlı parçalar aşağıda ayrılır.

`/spaces` mevcut Next.js ürünüdür. Yeni stüdyo Video Tanıtımı / AI 3D Deneyim / 360° Sanal Tur ayrımı, dört kamera stili, kaynak sırası, hedef süre ve özel medya alanı sunar. Sıcak fildişi/orman yeşili ve mevcut yerel OFL Manrope/Newsreader korunur. Statik V5.2/V5.3 preview girişini yeniden tasarlamaz; yeni deployment yapılmaz.

## Çalışan yerel yol

Fotoğraflar mevcut rights/magic/decode/metadata/private-grant hattından geçer. `property-video-v1` dört immutable preset'ini sürümler. Plan yalnız auth/membership/RLS ile okunan mevcut mülk/sürüm/kaynakları kullanır; fiyat döndürmez, kredi ayırmaz ve dış çağrı yapmaz. Aynı byte hash'li fotoğrafın kopyası yeni sahne sayılmaz; farklı hash, farklı kamera açısının kanıtı değildir.

Yerel örnek, her seçilen fotoğraftan ayrı nominal 5sn MP4 üretir; asıl fotoğrafı kadraj içinde tutan boşluklu hafif hareket, kaynak hash'i ve sahne sırası taşır. Birleştirme decode + H.264/BT.709/24fps + metadata/audio temizliği ile mevcut allowlisted CPU worker üzerinden yapılır. Geçerli yerel çözünürlük 640×360 / 360×640'tır. 1080p yalnız gelecekte izinli sağlayıcının hedefidir; native1080p/fotogerçekçi AI iddiası yoktur. Ölçülen süre ve nominal süre ayrı tutulur; yeni birleşim QA toleransı en fazla bir 24fps kare +2ms'dir.

30/45/60sn hedef 6/9/12 ayrı kaynak gerektirir. Daha az fotoğrafta kısa yerel öneri verilir; eksik süre tamamlanmış gibi gösterilmez, bir fotoğrafı tekrarlayarak 60sn vaadi yapılmaz. Önceki 4/8/16sn fotoğraf/video kurgu ve ölçülü 3D yolu sessiz yerel seçeneklerde korunur.

Ara klipler web root dışında private0600 saklanır, toplam geçici+final çıktı kotasına dahildir. Başarısız kurguda kısmi klipler, fenced geç sonuçta yeni kurgunun çıktı dosyaları temizlenir. Mevcut durable job/outbox/idempotency/cancel/revision/sanal ledger korunur. Klipler parent job'ın 60sn session/property/revision grant'iyle önizlenir. Final için farklı reviewer hem eski dört kalite kapısını hem **her klibin kaynak+çıktı hash'ini** onaylamalıdır. Güncel kaynak sürümü değişince eski grant/release reddedilir. Test kimliği onayı gerçek bağımsız insan kabulü değildir.

## Sağlayıcılar — yalnız DISABLED

| Ürün | Dokümante hedef | Dar kod kapsamı | Açılmamış kapı |
|---|---|---|---|
| Doğal Tur / Mekânı Keşfet / Dış Cephe | fal `kling/v4/image-to-video` | Tek start frame, sabit prompt, integer3–30sn clamp,1080p; aynı onaylı odada isteğe bağlı end frame | Hesap/model izni, sözleşme/veri/bütçe, gerçek transport |
| Premium Sinematik | fal `bytedance/seedance-2.5/us/image-to-video` | `image_url`, string4–30sn duration,1080p,auto aspect,sesfalse,high bitrate,H264 | US adlı endpoint EU/yerleşiklik garantisi değildir; gerçek erişim, lisans, ücret |
| AI 3D | World API `marble-1.1-plus` | 1foto image /2–4foto multi-image; private permission; operations; ayrı GLB/PLY export template | `BLOCKED_LEGAL_APPROVAL`, attribution/training/DPA/retention/region/benchmark ve variable-cost/overage |
| Gerçek 360° | Pedra create/get virtual tour | Onaylı 2:1 panorama grant'i,walking-order,sequential linking;en/es/fr/de/it/pt | Public hosted link için ayrıca izin; reseller/DPA/retention/fiyat; gerçek transport |

Kling4 şemasında ses kapatma/codec seçimi belgelenmediği için bu alanlar uydurulmaz. Gelen gerçek dosya ileride ses/kodek doğrulamasından geçmeli; doğrudan teslim edilmemelidir. Seedance duration'u string'dir; numeric payload kullanılmaz. Farklı odalar start/end ile bağlanmaz; bilinmeyen oda kimliğinde end frame reddedilir. Multi-prompt, middle frames, reference-to-video ve otomatik fallback açılmadı.

Request hazırlığı secret okumaz veya ağ bağlantısı başlatmaz. Server'ın önceden onayladığı exact source grant listesi + asset/hash/tenant/revision + ≤60sn TTL + allowlisted HTTPS host doğrulanır. Bu, hosted dış kaynak grant issuer'ının bağlandığı anlamına gelmez. Candidate output URL/MIME/boyutu byte doğrulaması veya indirme izni değildir; `QA_HOLD` döner. Varsayılan model/payload değişimi yoktur. Ortam enable flag'inin değiştirilmesi dahi code-locked transport'u açamaz. Gerçek iptal/iade/quote veya SLA kanıtlanmadı.

Canlı queue/poll/JWKS transport'u, kalıcı provider-callback inbox/dedup tablosu, harici kaynak URL issuer'ı ve sağlayıcı MP4'ünü indirip özel depoya doğrulanmış dosya olarak alma hattı **NOT_IMPLEMENTED / BLOCKED_EXTERNAL_APPROVAL** kalır. Yerel çoklu-klip renderer'ı gerçek dosyayla çalışır; kapalı adapter'ın gerçek klibini aldığı iddia edilmez. Modelin kaynak oranına göre dönebilen çıktısını hedef formata bozmadan yerleştirme ve ≤60sn grant'in queue bekleme süresiyle uyumu canlı test gerektirir; süre kilidi sessizce uzatılmaz. Önceki registry kayıtları tarihsel ve kapalıdır; V5.4'teki dört prompt rotası fal kullanır ve eski modeller otomatik fallback değildir.

fal callback yardımcı fonksiyonu raw-body SHA256, Ed25519, beklenen request/user ID, ±300sn ve24saatten yeni güvenilir JWKS snapshot'ını offline doğrular. JWKS ağ fetch'i ve gerçek webhook endpoint'i açık değildir. Ayrı offline reducer unknown acceptance hold, en fazla2 known-not-accepted attempt, duplicate/fence/scope ve cancel senaryolarını dener; mevcut durable outbox'ın yerine geçmez.

Marble çıktısı AI mekânsal yorumdur; E2 survey/dijital ikiz ilan edilmez. SPZ/pano/collider ve gerektiğinde ayrı export GLB/PLY doğru türde adlandırılır. Mevcut Three.js/GLB viewer ve ölçülü sentetik örnek korunur; Spark eklenmedi. Canlı World Labs görüntüsü veya API renderer uyumluluğu denenmedi.

Pedra gerçek 360° panoramalarla hosted tur üretir; genel JPG'den free-walk3D üretmez. Türkçe API tur dili belgelenmedi. `embedCode` **asla** render/return edilmez; yalnız exact allowlisted HTTPS tour URL normalize edilir, publicationAllowed=false kalır. Private kaynak gönderilse dahi sağlayıcının public tur üretebilmesi ayrı yayın izni gerektirir. CSP/iframe izinleri genişletilmedi. Test kalibrasyon panoraması bir gerçek konut değildir. Matterport yalnız ileri yakalama/tarama adayıdır.

## Resmî şema snapshot'ları

- [Kling4](https://fal.ai/models/kling/v4/image-to-video/api); OpenAPI SHA256 `182f5a1c65afd4f7ff759eeca4f42f16ae649974172111696052e95b20ebcb3b`.
- [Seedance2.5US](https://fal.ai/models/bytedance/seedance-2.5/us/image-to-video/api); OpenAPI SHA256 `05768465dc2b613e51196802f8cc929b33964af4a31fa66f0140e4f66862349d`.
- [fal queue](https://fal.ai/docs/documentation/model-apis/inference/queue), [webhooks](https://fal.ai/docs/documentation/model-apis/inference/webhooks), [Terms](https://fal.ai/legal/terms-of-service), [API Services](https://fal.ai/legal/api-services).
- [World models](https://docs.worldlabs.ai/api/models), [generate](https://docs.worldlabs.ai/api/reference/worlds/generate), [examples](https://docs.worldlabs.ai/api/world-generation-examples), [Terms](https://www.worldlabs.ai/terms-of-service).
- [Pedra Virtual Tours](https://pedra.ai/api-documentation/virtual-tours), snapshot SHA256 `8f78b9ecf69d326fab61ad23a312de407acb2a4c9a84f812fc159bf8e1d962ca`.

Kaynaklar credential içermeyen public GET ile okundu. Seçilmiş OpenAPI shape'leri `fixtures/providers-v54` içinde; örnek harici medya URL'leri girdi fixture'ı yapılmadı. Endpoint/model alias'ı immutable ağırlık sürümü kanıtı değildir. Hesap erişimi, gerçek model kalitesi, maliyet ve reseller/alt bayi sözleşmesi ölçülmedi/onaylanmadı. Genel API müşteri-uygulaması hakkı çok katmanlı white-label izni değildir. V4 accepted-output maliyeti/NULL kuralı değiştirilmedi.

### 27 Ekim tarihli sözleşme gözlemleri — hukuk onayı değildir

fal genel koşulları Customer Solution/End Users üzerinden entegrasyonu tanımlar; API lisansı non-sublicensable'dır ve aynı metinde resale/service-bureau kısıtları da bulunur. API Services metni Client Solution entegrasyonunu, son kullanıcı sözleşmesi yükümlülüklerini ve enterprise-ready istisnalarını açıklar. Client Content eğitim kısıtlamasının **Excluded Models / Pending Enterprise Ready** istisnası vardır; bu modellerde DPA/güvenlik yükümlülüklerinin de uygulanmayabileceği belirtilir. Dolayısıyla sadece API erişimi, bu iki seçili modelin enterprise-ready statüsü, downstream ajans/alt bayi izni veya müşteri konut gizliliği için yeterli kanıt değildir. Yazılı ürün/model/sözleşme teyidi gerekir. Genel Terms snapshot SHA256: `19099c5c999acd011b94c53341393a18a463b7197a7bc63f48b27640a66b8366`.

World Labs koşulları free ve paid/API çıktı haklarını ayırır; ücretsiz çıktı ticari hak olarak değerlendirilmez. Paid/API çıktı hakları training/input lisansını ortadan kaldırmaz. Paid opt-out ileriye dönük olup önce eğitilmiş modellerden çıkarma garantisi değildir; attribution işaretleri korunmalıdır. Competitive analysis/benchmarking kısıtı ve API/order-form retention koşulları vardır. Owner/legal yazılı kapsamı çözmeden karşılaştırmalı canlı benchmark veya müşteri verisi yoktur. Terms snapshot SHA256: `fdd3625ebf968308ad2d7859b850593b91e07c9ff37953eae952f0887e4f6dfa`.

Pedra dokümanı API kredi/hosted tur davranışını açıklar; ajans-alt bayi lisansı, DPA, retention, privacy ve Türkçe tur dili için onay yerine geçmez. Bu üç sağlayıcı için model kalitesi ve gerçek accepted-output fiyatı **UNKNOWN** kalır; fiyat uydurulmadı, kredi satın alınmadı.

## Yerel demo ve güvenlik

`npm ci --ignore-scripts` → `npm run dev` → `http://127.0.0.1:3000/spaces`. Yalnız sentetik fotoğraf veya Örnek mülkle dene. Video →stil→Yerel örnek oluştur. Yönetimde farklı sentetik reviewer →sahneleri aç/karşılaştır/onayla→dört kapı→Bağımsız onay. Gerçek müşteri girişi değildir.

`npm run test -- tests/unit/api-first-v54.test.ts tests/unit/api-first-composition.test.ts tests/unit/v54-long-composition.test.ts` gerçek private MP4 ölçümlerini `.spaces-local/v54/verified-composition` altında bırakır. Bunlar QA/test kanıtıdır; otomatik müşteri yayını değildir. `npm run check`, governance/audit/SBOM/secret scan, iki Playwright suite'i ve Golden doğrulaması ayrıca çalıştırılır; gerçek sonuçlar owner raporunda yer alır.

App loopback'te çalışırken `node scripts/capture-api-first-evidence.mjs` yedi genişlik ve stil/AI3D/panorama durumlarını ayrı, yeni özel kanıt klasörüne kaydeder. İşlev testlerindeki ekran boyutu/axe doğrulamaları kaldırılmaz; pahalı tam ekran PNG kodlaması test zaman bütçesine yığılmaz. `--baseline` yalnız ayrıca başlatılmış eski3008 sunucusu içindir. Script'teki Git kimliği capture aracının checkout'udur; ayrı çalışan app build'inin kaynağı operator/build kanıtıyla ayrıca bağlanır, server attestation sayılmaz.

No new deployment / billable request / customer upload / cloud / billing / existing ElevenLabs agent action. Vercel `BLOCKED_BILLING_VERIFICATION` korunur; Gold/AntiGravity üzerinden aşılmaz. PR2–4/main/ruleset/required-review değiştirilmez, PR5 açılmaz veya merge edilmez. Server credential enablement: [release playbook](release-playbook.md). Gerçek Safari/iPhone, bağımsız emlakçı kabulü, production auth/KMS/OS sandbox/AV/pentest, sağlayıcı sadakati ve kârlılık doğrulanmış değildir.
