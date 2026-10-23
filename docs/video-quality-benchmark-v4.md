# V4 video kalite laboratuvarı — 23 Ekim 2026

Bu belge çalışan `npm run lab:video` komutuna bağlıdır. Dış inference/harcama sıfırdır. Teknik PASS, ticari yaratıcılık, fotogerçekçilik veya görülmemiş mimarinin sadakati anlamına gelmez.

## Tekrar üretim ve değişmeyen girdiler

```bash
npm ci --ignore-scripts
npm run lab:fixtures
npm run lab:video
npm run economics
npm run benchmark:plan
```

FFmpeg/ffprobe, Blender/NumPy/Python, DejaVu Sans ve Linux `prlimit` mevcut olmalıdır. `lab:fixtures` ilk üretim dışında mevcut golden manifest/hash'leri doğrular; dosyaları sessizce yenilemez. SHA değişirse deney durur. Farklı FFmpeg/OS sürümlerinde aynı çıktı byte'ı vaat edilmez; gerçek her run kendi hash'ini kaydeder.

`fixtures/video-quality-v4/input-manifest.json`: proje için yazılmış sentetik salon illüstrasyonundan türeyen JPEG/WebP, H.264/BT.709 footage; gerçek ev/adres/kişi/müzik yok. HEIC sentinel gerçek HEIC decoder örneği değildir; seçim reddini sınar. Ayrı gerçek siyah MP4 blank/freeze negatifidir. Bu fixture'lar gerçek konut rekonstrüksiyonu değildir; yeni ticari lisans verilmedi.

Güvenli yerel çıktı `.spaces-local/video-quality-v4/` altındadır. İncelenmiş V4 kopyaları `artifacts/video-quality-v4/`; V2/V3 örnek ve screenshot'ları tarihsel byte'larıyla korunur. Raw test trace/log, signed link veya key public kanıta alınmaz.

## Sınırlı matris

| Kaynak | Tarz | Oran | İstenen süre |
|---|---|---|---:|
| İki sentetik fotoğraf | Doğal keşif | 16:9 | 4 sn |
| Desteklenen sessiz footage | Doğal keşif | 9:16 | 8 sn |
| Fotoğraf + footage | Sinematik tanıtım | 16:9 | 16 sn |
| İki sentetik fotoğraf | Sinematik tanıtım | 9:16 | 4 sn |
| Footage | Karma kurgu | 16:9 | 8 sn |
| Fotoğraf + footage | Karma kurgu | 9:16 | 16 sn |
| Karışık, laboratuvar adayı | Sinematik | 720×1280 | 15 sn |
| Fotoğraf, laboratuvar adayı | Karma | 1920×1080 | 30 sn |

İlk altı üretim gerçek property/asset/job/outbox/renderer yolu kullanır ve `awaiting-review` durumunda kalır. Adaylar aynı renderer'ın sabit allowlist edilmiş, HTTP üzerinden ulaşılamayan `isolated-quality-lab-v4` profilidir. Hiçbir aday download/release gate'i kazanmaz. UI/API hâlâ 640×360 / 360×640 ve 4/8/16 sn'dir.

Adaylarda 1 GiB **address-space** (`prlimit --as`), 75 CPU saniyesi, 90 sn renderer timeout, 50 MiB çıktı, sınırlı decoder/encoder thread uygulanır. Address-space limiti RSS veya OS/container sandbox değildir. Başarısız aday NOT_IMPLEMENTED olarak kaydolur; test atlanmış/PASS sayılmaz, kullanıcıya açılmaz. 1080p aday normalize ≤1600px fotoğrafı büyütür; başarılı encode bile **native 1080p detay** veya AI üretim kanıtı olmayacaktır.

## Nesnel kapılar

- Gerçek ffprobe: codec, pixel format, BT.709 matrix/transfer/primaries, ölçülen aspect/boyut/süre, byte ve hash.
- Tam dosya decode (`-xerror`) ve ayrıca 6 FPS, 96×54 merkez alan örneklemesi. Caption alanı blank/motion ölçümünü maskeleyemez.
- Blank run ≤0.34 sn; beklenmeyen frozen run <2 sn; sabit negatif gerçekten reddedilir. Bunlar örnekleme eşikleridir: daha kısa kusurları veya semantik hareket kalitesini kanıtlamaz.
- Güncel kaynak/revizyon/manifest hash, bağımsız beklenen asset ID/hash listesi ve kesintisiz shot provenance. Beklenti çıktıdan kopyalanarak kendini doğrulamaz.
- Caption gerçek raster bitmap genişlik/yükseklik sınırı, ≥16px yazı ve opak siyah/beyaz 21:1 teorik kontrast; %4 safe-area içinde. Bu OCR, sosyal platform safe-zone garantisi veya insan okunabilirlik sertifikası değildir.
- Tek video stream; audio/subtitle/data/chapter ve özel metadata yok. Kaynak sesleri kaldırılır. Gerçek AAC, HEVC, HDR ve metadata negatifleri unit suite'te yer alır.
- Siyah/donuk video, bozuk dosya, eksik provenance, yanlış medya hash'i ve source-revision drift negatifleri.

V4, uzun fotoğraf planındaki sabit zoom adımının erken durmasını düzeltti: hareket artık plan boyunca sınırlı olarak sürer. Uzun Türkçe caption/marka, yaklaşık karakter hesabı yerine gerçek Pango/Sharp raster boyutuyla satıra bölünür. İlk nesnel deneydeki donma FAIL'i ve düzeltme saklanır; eşik düşürülmedi.

`measurements.json` encoder exit, encoder wall time, tüm renderer wall time, requested/actual süre, metadata, dosya hash'i, source/shot/caption provenance ve nesnel kapıları kaydeder. Per-encoder CPU/RSS güvenilir ölçülmediğinde NULL'dır. Bütün komut için OS resource ölçümü varsa `resources.json` ayrı kapsamı açıklar; SLA/p95/çok müşterili kapasite iddiası yoktur.

## İnsan scorecard ve 3D ayrımı

`review-scorecard.json`: 0–5 ölçütleri ilk üç saniye etkisi, keskinlik, kurgu sürekliliği, kaynak sadakati, okunabilirlik, mülk doğruluğu, kanal uygunluğu, marka ve satış kullanılabilirliği. 0 kullanılamaz/kritik ihlal; 1 yeniden üretim; 2 büyük düzeltme; 3 sınırda; 4 iyi; 5 çok iyi. **NULL incelenmedi demektir**, sıfır değildir.

Provider kimliği körlenmiş gerçek bağımsız insan incelemesi henüz yapılmadı. Assistant'ın gerçekten gördüğü ilk/orta/son kare notları varsa ayrı `assistant-frame-observations.json` içindedir; tam video/temporal veya insan approval yerine geçmez. Görülmeyen çıktıya puan verilmez. Yeni hayalî oda/pencere/ölçü/manzara kritik red; ölçüt ortalaması bu reddi silemez.

3D'nin GLB/metrik geometri/free-walk/collision gate'i korunur. Bu video laboratuvarı onu MP4/panorama veya gerçek mülk rekonstrüksiyonu olarak yeniden sınıflandırmaz. Blender/Three yerel sentetik fixture, Marble/world-model ve Unreal/GPU ayrı yetenek ve izin yollarıdır.

V4 son görsel incelemesinde iç shot kesmelerindeki fade-to-black blink de giderildi: fade yalnız tüm reel'in başı/sonunda kalır; orta kare parlaklığı gerçek decode testiyle kontrol edilir. Bu bir crossfade/creative continuity garantisi değildir.

## Son yerel ölçüm

| Örnek | İstenen / gerçek sn | Boyut | Byte | Encoder ms | SHA256 | Nesnel |
|---|---|---|---:|---:|---|---|
| photo-pov-horizontal-4 | 4 / 3.96 | 640×360 | 65866 | 807 | `681bd76e881ffbb748656bea6c5ff32dafd71610ff5b2b4d74b86eba1170862d` | PASS |
| footage-pov-vertical-8 | 8 / 8 | 360×640 | 211955 | 2019 | `e288e2acf5fc67301f87d7dc10f7220415e630251657475758e10c7467350cbb` | PASS |
| mixed-cinematic-horizontal-16 | 16 / 16.001667 | 640×360 | 297108 | 1894 | `7d844976d3f67133991de1aefbf3f6583cd77c3edcac8cc76eb1b80c14b01e03` | PASS |
| photo-cinematic-vertical-4 | 4 / 3.96 | 360×640 | 80636 | 1057 | `3748563eec0864685ae9b49ca3f6f21375deacb139aa768d8ce6fa786c79ad7a` | PASS |
| footage-hybrid-horizontal-8 | 8 / 8 | 640×360 | 172247 | 1348 | `4fa0c29a965ea0ebe088ea176b9fa05b9c2a8fe590f8d1ff31f1f17423693c34` | PASS |
| mixed-hybrid-vertical-16 | 16 / 16.001667 | 360×640 | 317845 | 2565 | `0c8fa24c5289b606bd39724bddefc2d80f55a6bd431e2e38610c2ba5f3809443` | PASS |
| candidate-720p-15 | 15 / UNKNOWN | geçerli dosya yok | — | — | — | NOT_IMPLEMENTED, exit 244, MEMORY_OR_ENCODER_LIMIT |
| candidate-1080p-30 | 30 / UNKNOWN | geçerli dosya yok | — | — | — | NOT_IMPLEMENTED, exit 187, MEMORY_OR_ENCODER_LIMIT |

Son protokol wall time 26074ms; bütün npm komutu 27.33sn,OS-reported user/systemCPU 38.258/6.634sn,peakprocessRSS 1207947264byte. Bu JS/PGlite/normalizasyon/probe dahil bütün komuttur; per-encoderRSS/CPU veya eşzamanlı process toplamı değildir. Aynı anda başka ağır task çalıştırılmadı. İki yüksek-tier aday yerel1GiB AS bütçesinde başarısız oldu; hiçbir limit/eşik bunları PASS yapmak için artırılmadı.

Final source aspect düzeltmesi: yatay1600×900/dikey900×1600 çalışma kadrajı; gerçek encoded red-circle ratio testi her iki yönde0.95–1.05sınırını doğrular. E0/E1 görüntüden ölçülü konut veya gerçek first-person camera path türetilmez.
