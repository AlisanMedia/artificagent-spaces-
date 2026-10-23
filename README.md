# ArtificAgent Spaces — yerel ürün laboratuvarı

Owner V2.0 yetkisi: **22 Ekim 2026**. Phase 1B kapalıdır; P2–P12 için sürekli yerel/sentetik geliştirme yetkilidir. Harici bütçe **0 USD**. Mevcut canlı ArtificAgent ElevenLabs agent’ına dokunulmaz.

Bu sürüm gerçek PostgreSQL/PGlite RLS, özel dosya saklama, kalıcı işler, FFmpeg MP4, Blender GLB ve Three.js serbest gezinme, bağımsız yerel inceleme, mülk kapsamlı rehber simülasyonu, izinli analiz, white-label ve partner sınırlarını içerir. **Üretim auth’u, ücretli AI, ElevenLabs oturumu, ödeme veya deployment etkin değildir.**

## Çalıştırma

Gereksinimler: Node **24.19.0**, npm **11.9.0**, FFmpeg/ffprobe, Blender 4.x ve glTF exporter'ın NumPy bağımlılığı, Python 3, DejaVu Sans. Ubuntu paketlerinde `--no-install-recommends` kullanılıyorsa `python3-numpy` açıkça kurulmalıdır. Bu makinede FFmpeg **7.1.5** ve Blender **4.3.2** test edildi. CI kendi araç sürümünü loglar ve NumPy/glTF exporter preflight'ı çalıştırır; platformlar arası bit eşitliği iddia edilmez.

```bash
npm ci --ignore-scripts
npm run dev
```

`http://127.0.0.1:3000/spaces` adresini açın. Sunucu yalnız loopback’e bağlanır; Host/Origin, HttpOnly/SameSite cookie, RLS ve scoped grant kontrolleri uygulanır. Local test kimliği seçimi gerçek müşteri girişi değildir.

1. **Mülk medyasını yükle** ile sentetik fotoğraf/MP4 seçin; bir mülk veya test kimliği seçmek zorunlu değildir. İlk yükleme hazır yerel demo hesabı ve taslak oluşturur. Mevcut bir oturumun yetkisi kendiliğinden yükseltilmez.
2. Kullanım hakkı/sentetik veri/metadata ve ses temizliği onayını işaretleyin; **Dosyaları güvenle yükle**. Özel alana kaydedilen kaynakları değiştirin, sıralayın veya kaldırın. Geçmiş sürümler korunur.
3. **Tarzını seç** → Doğal keşif / Sinematik tanıtım / Karma kurgu. Dikey varsayılandır; Reels/Story, WhatsApp, YouTube ve ilan seçenekleri yalnız yerel dosya dışa aktarma tercihleridir. Şablonlar hafif renk düzeni ve başlığı değiştirir; farklı canlı AI modelleri değildir.
4. **İçeriği oluştur** → gerçek MP4 önizlemesi. Ücret alınmaz. Kısa kaynak videolar seçilen süreyi tamamlamak için tekrarlanabilir; sesleri kaldırılır.
5. Ayrı incelemeci `/spaces/manage?property=<proje>` alanından kaynak/çıktı ve gerekli kalite/hak kapılarını inceler. Yerel demoda test hesapları bu alandadır; kendi üretimini onaylama engeli korunur. Gerçek müşteri auth'u değildir.
6. Onay sonrası **İndir** veya 1 saatlik yerel tur bağlantısı. Gerçek sosyal ağ hesabına paylaşım, internet deployment veya ödeme yapılmaz.
7. **3D Sanal Tur — Premium / Beta** ikincil seçenektir: doğrulanmış ölçülü plan gerekir. Yerel demo çekmecesi ölçülü sentetik örnek ekleyebilir; birkaç keyfî fotoğraf gerçek konut rekonstrüksiyonu sayılmaz. Mevcut gerçek free-walk/voice consent/analytics/white-label/partner modülleri korunur.
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
