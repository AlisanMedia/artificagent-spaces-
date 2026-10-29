# V5.5 sentetik örnek hakları ve provenance

Bu örnekler owner'ın yalnız sentetik yerel/public-safe geliştirme yetkisiyle bu proje için yazıldı. Rakip, stock servis veya gerçek ev medyası alınmadı. Yeni dependency/font yok; mevcut self-hosted OFL Manrope/Newsreader aynen korunur. Proje medyası `PROJECT_AUTHORED_SYNTHETIC` olarak sınıflanır; üçüncü tarafa geniş lisans verildiği veya AI sağlayıcı ticari hakkı onaylandığı iddia edilmez.

Makine kaydı: `fixtures/showcase-v55/registry.json`. Varlık başına ID/path/SHA256/bytes/tür/width/height, ilgili property/camera/source, hak ve production:false. Video duration/codec/pixel format/audio ölçülür. Dört video sample ve iki spatial sample ürün/tarz/source/output/açıklama/erişilebilirlik bilgisi taşır. Kaynak ve ölçüler özel tenant verisi değildir; sadece Golden-v5 sentetik CAD ve ayrı sentetik cephe çalışmasıdır.

| Örnek | Gerçek kaynak ve işlem | İddia edilmeyen |
|---|---|---|
| natural/premium/explore | Golden-v5 living.png, mevcut allowlisted FFmpeg kaynak-görsel kurgu hattı | Canlı model, fotogerçekçiAI, orijinalfotoğraftan görülmeyen alan |
| exterior | Yeni özgün facade.svg → Sharp PNG → yerel FFmpeg kurgu | Gerçek bina/adres, Golden planının dış cephesi veya AIcrane hareketi |
| poster/thumbnail | Kendi MP4'ünün0.5sn decode karesi → WebP;320×180 küçük türev | Başka mülk veya native yüksek çözünürlük |
| comparison | Aynı Golden living.png → iki gerçek WebP; after: normalise(1,99)+sharpen(0.8) | CSS filtre, farklı kadraj, yenioda/mobilya, AIenhancement servisi |
| GLB | Önceki bağımsız metrik sentetik Golden CAD | Fotoğraf rekonstrüksiyonu, Marble çıktısı veya gerçek konut |
| panorama | Aynı CAD/GLB, camera-living poz/target eksen dönüşümü, CyclesCPU16sample/seed55,1024×512 equirectangular | Normalfotoğrafa360ikonu, gerçek konutcapture,Pedrahostedtur |

`scripts/build-showcase-v55.ts` ve sabit `scripts/showcase-panorama.py` tekrar üretim içindir. Kullanıcı argümanı, arbitraryPython, müşteri girdisi veya harici URL kabul etmez. Kaynak dosyalar eski Golden hash'leri değiştirilmeden kullanılır. Yerel sentetik iki test kimliğiyle QA geçişi, gerçek bağımsız insan puanı veya hukuk onayı değildir; registry humanReviewers:null kalır. Codec/Blender/Sharp sürümleri farklı sistemde bit eşitliği garantisi vermez; commitli hakları açık varlıkların hash/decode doğrulaması build için esastır.

Kalite açığı açıktır: Golden render ve çizim ticari fotoğraf gerçekçiliğinde değildir. Lisanslı gerçek konut örnekleri, gerçek sağlayıcı çıktıları ve bağımsız iki insan kalite puanı henüz yoktur. Bu eksikliği stock veya sahteAI çıktıyla gizlemiyoruz.
