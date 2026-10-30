# ArtificAgent Spaces — yerel ürün laboratuvarı

**30 Ekim — V5.7 güncel kapsam:** yedi sade müşteri hizmet ailesi, 15 ayrı kapalı üretim sözleşmesi, server-owned sürümlü prompt/profiller, güncel resmî şema alt kümeleri, kalıcı source-bound istek/callback kayıtları ve gerçek private PNG/QA/bağımsız teslim test hattı. 75 başlık yalnız yönetim araştırmasıdır. Yeni fotoğraf formu tercih kaydeder; gerçek AI üretimi/ücret başlatmaz. [V5.7 kapsamı, eksikler ve açılış kapıları](docs/premium-production-v57.md). Canlı sağlayıcı, müşteri verisi, deployment ve USD0 sınırları değişmedi. Aşağıdaki V5.6 müşteri kataloğu notu tarihsel davranıştır; V5.7'de katalog yönetim alanına taşındı.

**29 Ekim — hizmet örnekleri devamı:** boş oda yakın planları yerine her hizmete bağlı ayrı kapak, kartta oynatılabilen gerçek yerel MP4, mevcut modelin tamamını gösteren 3D render ve doğrulanmış CC0 fotoğraf panoraması. [Kaynaklar, haklar ve çalışma sınırı](docs/service-samples-refresh.md). Eski sentetik fixtures korunur; lisanslı kamuya açık referans istisnası müşteri upload/API/deployment yetkisini genişletmez.

Owner V2.0 yetkisi: **22 Ekim 2026**. Phase 1B kapalıdır; P2–P12 için sürekli yerel/sentetik geliştirme yetkilidir. Harici bütçe **0 USD**. Mevcut canlı ArtificAgent ElevenLabs agent’ına dokunulmaz.

**29 Ekim V5.5 güncel kapsamı:** müşteri hizmet/örnek galerisi, dört adımlı stüdyo ve ayrı yetkili sonuç sayfası. Yeni deployment, gerçek müşteri/sağlayıcı/ödeme ve harici bütçe kapalıdır. [V5.5 müşteri yolu](docs/customer-experience-v55.md), [örnek hakları](docs/showcase-rights-v55.md), [A/B/C beta kapıları](docs/controlled-beta-readiness-v55.md).

**27 Ekim V5.4 korunan kapsamı:** hedefli `/spaces` API-first stüdyo ve kapalı fal / World Labs / Pedra sözleşmeleri. Önceki Vercel Preview istisnası bu görevde kapalıdır: yeni deployment, deneme, hesap/proje, müşteri verisi veya gerçek API çağrısı yapılmaz. Aşağıdaki tarihsel V5 yayın notları yeni yayın yetkisi değildir.

Bu sürüm gerçek PostgreSQL/PGlite RLS, özel dosya saklama, kalıcı işler, FFmpeg MP4, Blender GLB ve Three.js serbest gezinme, bağımsız yerel inceleme, mülk kapsamlı rehber simülasyonu, izinli analiz, white-label ve partner sınırlarını içerir. **Üretim auth’u, ücretli AI, ElevenLabs oturumu, ödeme veya deployment etkin değildir.**

## Çalıştırma

Gereksinimler: Node **24.19.0**, npm **11.9.0**, FFmpeg/ffprobe, Blender 4.x ve glTF exporter'ın NumPy bağımlılığı, Python 3, DejaVu Sans. Ubuntu paketlerinde `--no-install-recommends` kullanılıyorsa `python3-numpy` açıkça kurulmalıdır. Bu makinede FFmpeg **7.1.5** ve Blender **4.3.2** test edildi. CI kendi araç sürümünü loglar ve NumPy/glTF exporter preflight'ı çalıştırır; platformlar arası bit eşitliği iddia edilmez.

```bash
npm ci --ignore-scripts
npm run dev
```

`http://127.0.0.1:3000/spaces` adresini açın. Sunucu yalnız loopback’e bağlanır; Host/Origin, HttpOnly/SameSite cookie, RLS ve scoped grant kontrolleri uygulanır. Local test kimliği seçimi gerçek müşteri girişi değildir.

1. **Fotoğraf veya video ekle** ile sentetik fotoğraf/MP4 seçin; bir mülk veya test kimliği seçmek zorunlu değildir. İlk yükleme hazır yerel demo hesabı ve taslak oluşturur. Mevcut bir oturumun yetkisi kendiliğinden yükseltilmez.
2. Kullanım hakkı/sentetik veri/metadata ve ses temizliği onayını işaretleyin; **Dosyaları güvenle yükle**. Özel alana kaydedilen kaynakları değiştirin, sıralayın veya kaldırın. Geçmiş sürümler korunur.
3. **Tarzını seç** → Doğal keşif / Sinematik tanıtım / Karma kurgu. Dikey varsayılandır; Reels/Story, WhatsApp, YouTube ve ilan seçenekleri yalnız yerel dosya dışa aktarma tercihleridir. Şablonlar hafif renk düzeni ve başlığı değiştirir; farklı canlı AI modelleri değildir.
4. **İçeriği oluştur** → gerçek MP4 önizlemesi. Ücret alınmaz. Kısa kaynak videolar seçilen süreyi tamamlamak için tekrarlanabilir; sesleri kaldırılır.
5. Ayrı incelemeci `/spaces/manage?property=<proje>` alanından kaynak/çıktı ve gerekli kalite/hak kapılarını inceler. Yerel demoda test hesapları bu alandadır; kendi üretimini onaylama engeli korunur. Gerçek müşteri auth'u değildir.
6. Onay sonrası **İndir** veya 1 saatlik yerel tur bağlantısı. Gerçek sosyal ağ hesabına paylaşım, internet deployment veya ödeme yapılmaz.
7. **3D turu keşfet** ikincil seçenektir: doğrulanmış ölçülü plan gerekir. Yerel demo çekmecesi ölçülü sentetik örnek ekleyebilir; birkaç keyfî fotoğraf gerçek konut rekonstrüksiyonu sayılmaz. Mevcut gerçek free-walk/voice consent/analytics/white-label/partner modülleri korunur.
8. Hesap ve yönetim alanında rolünüze uygun inceleme, analitik, marka, partner ve kullanım araçları bulunur. Dropdown gizlemek server authorization/RLS yerine geçmez.

**Dosyalar:** Fotoğraf JPEG/PNG/WebP ≤5 MiB. Video yalnız 8-bit SDR H.264 MP4 ≤20 MiB, 0.25–30 saniye, her eksende ≤1920 ve toplam ≤2,073,600 piksel, ≤60 FPS; isteğe bağlı AAC ses alınır ve silinir. Tek video stream, ikinci stream yalnız AAC olabilir. MP4 yeniden kodlanır (24 FPS, en uzun kenar en fazla720); EXIF/GPS/yorum, ses/chapters/subtitle temizlenir. HDR/10-bit/MOV/WebM/HEVC/ProRes/AV1/4K/PDF ve ses/müzik ekleme desteklenmez. UI'da en fazla12 medya, server property kotası20 kayıt/50 MiB'dır; reddedilen/eski dosyalar da kotaya sayılır. Export640×360 veya360×640 H.264/BT.709,4/8/16 saniyedir.

Video çıktıları **gerçek H.264 MP4 kaynak-görsel hareket/kesme demolarıdır**; fotogerçekçi AI POV yürüyüşü değildir. 3D, **gerçek metrik parametrik GLB + serbest tarayıcı navigasyonudur**; panorama veya MP4 değildir. Pencereler/balkon/manzara uydurulmaz. JSON kamera planı yalnız plan olarak etiketlenir.

## Tek komutla gerçek dosya örneği

Uygulama çalışmıyorken (PGlite veri dizininin sahibi tek süreç olmalıdır):

```bash
npm run demo:local
```

Yeni organizasyon, mülk, özel plan/fotoğraf, dört iş, ikinci yerel incelemeci, onaylı dosya ve scoped rehber/analiz örneği oluşturur. Gerçek çıktılar `.spaces-local/demo-evidence/` altındadır. `measured-results.json` süre/hash/codec/boyut kanıtını; **özel** `session-links.json` kısa ömürlü tur linklerini tutar. Link/token/key dosyaları Git’e gönderilmez.

```bash
npm run build
npm run start
```

Uygulama açıkken ayrı terminalde `npm run worker:local` loopback CPU zamanlayıcısını çalıştırır; PGlite dizinini ikinci süreçte açmaz. `.spaces-local/` veya `SPACES_LOCAL_DATA_DIR` özel dizindir; backup için önce uygulamayı/scheduler’ı durdurun. Uygulama kapanınca arka planda iş çalıştığı iddia edilmez.

## Doğrulama

```bash
npm run lint
npm run typecheck
npm run test:coverage
npm run test:governance
npm run security:check
npm run security:audit
npm run licenses
npm run build
npx --no-install playwright install --with-deps chromium
npm run test:e2e
npm run security:secrets
```

Browser testleri desktop/mobile Chromium ve axe içerir; SwiftShader test renderer’ıdır, gerçek GPU kapasitesi kanıtı değildir. Safari/iOS ve canlı ses gecikmesi ayrıca test edilmelidir. Değişmeyen required context **Foundation acceptance**; PR, workflow_dispatch ve main push tetikleri vardır. Artifact yalnız şeması doğrulanan aggregate sayılardır; raw trace/ses/transcript/yayın token’ı yüklenmez.

## Belgeler ve sınırlar

- [Mimari](docs/architecture.md), [checkpoint](AUTONOMOUS_BUILD_STATUS.md), [backlog](docs/autonomous-backlog.md).
- [Sağlayıcı kanıtları](docs/provider-verification.md), [açılış ve rollback](docs/release-playbook.md).
- [Phase 1 README](docs/archive/phase-1-readme.md), [tarihsel mimari](docs/archive/phase-1-architecture.md). Eski ekranlar JSON-only foundation arşividir; çalışan platform `/spaces` altındadır.
- Gerçek cloud/paid API/GPU/customer-data/DPA/production/DNS/payment işlemleri `BLOCKED_EXTERNAL_APPROVAL` kalır. GitHub bağımsız review zorunludur; main’e doğrudan push/bypass yoktur.

## V3 tekrar üretilebilir örnekler

`npm run demo:ux` yalnız özgün sentetik SVG'den üç gerçek örnek MP4 üretir; `.spaces-local/ux-demo/measurements.json` hash/codec/süre/wall-time içerir. Başka bir sentetik kimlik ile review akışı denenir; gerçek bağımsız insan/GitHub review sayılmaz. Public örneklerin incelenmiş kopyası `public/spaces-examples/`, güvenli ölçümü `artifacts/ux-v3/example-measurements.json` içindedir. Kaynak hakları ve şema: [V3 uygulama notları](docs/ux-first-v3.md).

## V4 çıktı kalitesi ve ticari hazırlık

V3 upload-first akış ve V2 3D/voice/analytics/white-label korunur. V4, uzun fotoğraf planının erken donmasını ve dikey caption taşmasını düzeltir; gerçek çıktı kalite laboratuvarı, tek medya capability sözleşmesi, seçimi koruyan iPhone/unsupported format yardımı, opt-in memory-only sentetik UX sayımları, kapalı neutral provider/artifact contract ve conditional unit economics ekler. Yeni decoder/dependency veya canlı entegrasyon yoktur.

```bash
npm run lab:fixtures    # mevcut immutable input hash'lerini doğrular
npm run lab:video       # 6 gerçek baseline + 2 isolated candidate; private .spaces-local
npm run economics      # gerçek local ölçüm + açık varsayım/UNKNOWN + sensitivity
npm run benchmark:plan # yalnız gelecekteki envelope; NO_NETWORK / spend0
```

720p/15sn ve1080p/30sn laboratuvar sonuçları kullanıcı profili değildir; başarısız veya incelenmemiş aday açılmaz. Mevcut UI4/8/16sn,640×360/360×640 kalır. Bu ürünün ticari, fotogerçekçi AI turu tekrarlanabilir ve kârlı oluşturduğu **kanıtlanmadı**.

- [Video QA/scorecard](docs/video-quality-benchmark-v4.md)
- [Medya uyumluluğu ve gizli olmayan yerel huni](docs/media-compatibility-v4.md)
- [Güncel resmî provider kanıtları ve gated bake-off](docs/provider-readiness-v4.md)
- [Çalıştırılabilir birim ekonomi ve review kapasitesi](docs/unit-economics-v4.md)

## V5 Golden Property ve izole ürün önizlemesi

V5.1 owner yetkisi yalnız doğrulanmış ArtificAgent hesabında, mevcut ücretsiz/non-billable sınır içinde **sentetik Vercel Preview** içindir. Production ve gerçek müşteri backend'i kapalı kalır. Gold Revenue OS hedef değildir. Yayın başarıyla doğrulanmadan HTTPS bağlantısı var denmez.

```bash
npm run golden:verify  # commitli CAD/GLB/PNG/MP4 source/generator/dosya hash kontrolü
npm run preview:build  # ayrı statik browser paketi; Next API/auth/DB içermez
npm run preview:test   # iki browser projesinde stüdyo + değerlendirme kontrolleri
npm run preview:serve  # yalnız yerel inceleme, canlı internet bağlantısı değil
```

Gerçek ffprobe/tam MP4 decode ve GLB geometri denetimi `npm run test:coverage` içindeki Golden fixture testlerindedir; `golden:verify` tek başına decode yapmaz.

`npm run golden:build` sadece allowlisted sentetik CAD'den sınırlı CPU Blender/FFmpeg örneklerini üretir; fixture'lar zaten varsa hash doğrular. Yeni gerçek müşteri görüntüsü kabul etmez. [Golden kaynak ve ölçüler](docs/golden-property-v5.md), [statik yayın güvenlik sınırı](docs/isolated-preview-v5.md), [güncel sağlayıcı hakları](docs/provider-rights-v5.md).

Önizlemede Oluştur / Projelerim / Sonuçlar, üç video tarzı, gerçek hazır MP4 indirmesi, ölçülü plan/oda görünümleri ve GLB serbest gezinme vardır. Ziyaretçinin seçtiği dosya sadece cihazdaki geçici Blob ile gösterilir; uzak sunucuya yüklenmez ve hazır videonun ondan üretildiği söylenmez. Örnek dosyalar owner tarafından izin verilmiş sentetik tasarımdır; private tenant yayın/bağımsız release onayını geçersiz kılmaz. Ayrı backend uygulamasının RLS, sesli rehber simülasyonu, analitik ve partner özellikleri korunur; statik yayına taşınmaz.

V5'te beş oda / dört kapı / üç pencere, 78.4m² **sentetik tasarım** alanı; fotogerçekçi veya gerçek ev rekonstrüksiyonu değildir. İki gerçek bağımsız insan incelemesi henüz yoktur; puanlar NULL, gerçek accepted-output maliyeti ve üretim kârı UNKNOWN kalır. Gerçek AI/ElevenLabs çağrısı ve önceki önerilen $10 benchmark onaysızdır. PR2–4 review beklerken beşinci stacked PR açılmaz; hiçbir PR bu görevde merge edilmez.

## V5.2 premium ürün stüdyosu

Sıcak açık yüzeyler, orman yeşili eylemler ve yerel lisanslı Manrope/Newsreader ile tek yükleme alanı; ilk mobil görünümde **Fotoğraf veya video ekle** / **Örnek mülkle dene**. Statik örnekler hazır MP4'tür; cihazınızda seçtiğiniz dosyalardan yeni video üretildiği iddia edilmez. Tam uygulamada gerçek özel yükleme ve bağımsız inceleme kapısı korunur.

[Tasarım sistemi, haklar, hareket ve kanıt yöntemi](docs/ui-v52-design-system.md). `npm run preview:build` → `npm run preview:serve` sadece loopback statik önizleme; `npm run preview:test` etkileşim/medya/3D/axe ve kapalı API sınırlarını doğrular. `node scripts/capture-studio-evidence.mjs` yedi genişlikte gerçek ekranlar ve mobil lab ölçümleri üretir. Bu komutlar deployment yapmaz.

Vercel doğru ArtificAgent hesabı erişimi olmadan **BLOCKED_ACCOUNT_ACCESS** kalır; Gold Revenue OS kullanılmaz. Gerçek iPhone/Safari, bağımsız emlakçı kullanılabilirliği, ücretli model sadakati ve ticari kârlılık bu yeniden tasarımla doğrulanmış olmaz. PR2–4 bağımsız inceleme beklerken yeni beşinci PR açılmaz ve merge yapılmaz.

## V5.3 — görsel sürüm dondurma ve bağımsız test hazırlığı

V5.2 stüdyo tasarımı korunur. Statik önizlemenin footer bağlantısındaki `/evaluation/` ayrı sayfa/bundle, beş **gelecek** bağımsız emlakçı için altı görev, manuel süre, kapalı yanıtlar ve gönüllü yerel JSON export sunar. Yanıtlar RAM'de kalır; uzak gönderim, çerez veya kalıcı tarayıcı kaydı yoktur. Gerçek katılımcı veya bağımsız kabul henüz **NOT_VERIFIED**. Sentetik provanın gerçek insan sonucu sayılması engellenir.

[Protokol, eşikler, mahremiyet ve moderatör talimatı](docs/usability-protocol-v53.md). `npm run usability:prepare` özel `.spaces-local/usability-v53/packet-*` altında beş NULL/DRAFT form üretir. `npm run usability:summarize -- --input <özel-responses-klasörü>` yalnız aynı commit ve sınırlı allowlist kayıtları özetler; gerçek insan doğrulaması/otomatik release yapmaz. Yanıtları PUBLIC repo veya CI'ye koymayın.

`npm run preview:test` mevcut stüdyo/MP4/3D/axe kapsamını korur ve ayrı değerlendirme akışını da test eder. Foundation acceptance context'i değişmez; public CI özeti şema v2 ile tam uygulama **ve** statik preview testlerinin geçerli, sıfır skip/flaky sayılarını içerir. Vercel hedefi owner'ın doğru ArtificAgent team'idir; Gold ve owner tarafından reddedilen diğer çalışma alanları kullanılmaz. Erişim doğrulanmadan canlı URL iddiası yoktur. Gerçek Safari/iPhone ve beş insanla çalışma ayrıca yapılacaktır.

## V5.4 — fotoğraftan ayrı sahneler, kontrollü tek MP4

`/spaces` içinde Video Tanıtımı / AI 3D Deneyim / 360° Sanal Tur ayrı ürünlerdir. Dört sabit kamera stili ve 30/45/60sn hedefi, kaynak sayısı yetersizken dürüst kısa öneri sunar. Yerel örnek her fotoğraftan nominal5sn klip ve gerçek H.264 birleşim üretir; 360×640 veya640×360'tır. 1080p, fotogerçekçi AI turu veya sağlayıcı üretimi değildir. Her klip kaynak hash'i/revizyonu ile bağlanır; farklı incelemeci tüm sahneleri ve mevcut dört kalite koşulunu onaylamadan final indirme açılmaz. Eski4/8/16sn ve ölçülü3D seçenekleri daraltılabilir alanda korunur.

```bash
npm run test -- tests/unit/api-first-v54.test.ts tests/unit/api-first-composition.test.ts
npm run test -- tests/unit/v54-long-composition.test.ts
npm run test:e2e -- tests/e2e/api-first-v54.spec.ts
node scripts/capture-api-first-evidence.mjs # app ayrıca loopback'te açıkken; yalnız sentetik kanıt
```

Test MP4'leri ve ölçümleri yalnız özel `.spaces-local/v54/verified-composition/` altında tutulur; gerçek insan/ilan kabulü sayılmaz. Canlı fal Kling4 / Seedance2.5US, Marble1.1Plus ve Pedra hazırlıkları transport ve bütçe kapılarıyla **kapalıdır**; hesabın erişimi, reseller/DPA/retention/region, kesin deney bütçesi ve güvenli server secret yönetimi ayrıca onaylanmalıdır. Standart kullanıcı model/prompt kimliği görmez; yalnız admin hazırlık durumunu okuyabilir. [V5.4 sözleşmeler, resmî kaynaklar ve güvenlik sınırları](docs/api-first-v54.md).

## V5.5 — hizmet seç, gerçek örneğini gör, yerel çalışmanı oluştur

`/spaces/showcase` üç ayrı ürün gösterimi ve dört stile bağlı gerçek MP4; `/spaces` dört adımlı yerel iş/inceleme yolu; `/spaces/projects/<jobId>` yalnız yetkili proje sonucu. `npm run showcase:verify` kayıtlı kaynak/hash/rights/decoder ve gerçek karşılaştırma türevini build sırasında zorunlu doğrular. `npm run preview:build` ayrı statik pakette `/showcase/` galerisi ekler, hiçbir sunucu API/auth/DB içermez veya deployment yapmaz.

Örnekler bu proje için yazılmış sentetik görseller, kaynak-hareketli FFmpeg videoları, ölçülü CAD/GLB ve doğru küresel projeksiyonlu tek-oda panoramadır. Gerçek fal/Marble/Pedra çıktısı veya müşteri mülkü değildir. Canlı fiyat, bağımsız insan kabulü ve ticari kârlılık henüz bilinmez. Vercel billing kapısı ve yeni deployment yasağı sürer.

## Hizmet kataloğu — 29 Ekim 2026

`/spaces` ve `/spaces/showcase` içindeki **Tüm hizmetleri keşfet**, altı grupta 75 kapsamı arama/kategoriyle açar; ilk ekranın tek yükleme eylemi ve mevcut üç ürün akışı korunur. İki video seçeneği mevcut yerel kurguyu, 3D ve 360 seçenekleri doğrulanmış hazır örnekleri açar. İki yeni cihaz-içi araç, örnek konut kredisi ve kira getirisi hesabı yapar; banka/piyasa bağlantısı, kalıcı kayıt veya veri gönderimi yoktur. Diğer 69 kapsam **Hazırlanıyor** durumundadır; dosya/ücret kabul etmez veya sağlayıcı çağırmaz. Fotoğraf iyileştirme/sanal mobilya gibi yeni kapsamların API'ı henüz bağlı değildir. Tema, tenant/RLS, kaynak sürümü ve bağımsız release incelemesi değişmedi.

[Tam hizmet listesi, altı resmî rakip kaynağı ve durum ayrımı](docs/service-catalog-and-competitive-review.md). `npm run services:verify`, statik katalog/bağlantı/kaynak bütünlüğünü kontrol eder ve her iki build yolunda çalışır; internetten fiyat/kalite veya hesap erişimi doğrulaması yapmaz. Son hizmet örnekleri CC0 lisanslı referans fotoğrafları ve özgün sentetik tasarımları birlikte kullanır. Canlı fal/World Labs/Pedra/ElevenLabs hâlâ kapalı, harici bütçe USD0 ve yeni deployment yetkisizdir. Önceki örnekler yeni AI üretimi gibi sunulmaz.
