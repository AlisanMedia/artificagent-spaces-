# V5.5 — müşteri yolu ve örneklerin doğruluğu

29 Ekim 2026. V5.4 üzerine ayrı feature branch; önceki owner raporları veya ürün motorları yeniden yazılmaz. Harici bütçe USD0; deployment/gerçek müşteri/sağlayıcı/ödeme kapalıdır.

## Yerel inceleme

`npm ci --ignore-scripts` → `npm run build` → `npm run start`.

- `http://127.0.0.1:3000/spaces/showcase`: tenant API'sine başvurmayan kamuya uygun sentetik hizmet/örnek galerisi. Gerçek müşteri girişi yoktur.
- `/spaces`: Hizmet → Medya → Tarz → İstek özeti. Tek ilk eylemle video dosyası seçilebilir; hizmet kartından AI3D/360 gereksinimi görülebilir. Örnek mülkle deneme kaynak ekler; hazır örnek videoyu yeni çıktı saymaz.
- Video → istek özeti → Yerel örnek oluştur: eski auth/grant/job/idempotency/worker hattı, gerçek MP4 ve farklı incelemeci kapısı aynen sürer. AI3D ve360 canlı üretim düğmeleri kapalıdır. Ölçülü yerel3D ve önceki video kurgu seçenekleri gelişmiş bölümde korunur.
- `/spaces/projects/<gerçek-job-id>`: session/RLS kapsamındaki kayıt ve güncel kaynak sürümüyle sonuç. Yüzde veya yapay ilerleme yoktur. Onaydan önce download/publish reddedilir; source değişince eski önizleme ve teslim kapanır. URL seçicisi yetki değildir.
- Yeni Çalışma / Projelerim / Medya Arşivi / Hesap. Arşiv yalnız yetkili projelerin kaynaklarına giriş sağlar; ayrı cloud DAM değildir. Yönetim bağlantıları server authorization yerine geçmez. İnceleme, analitik, white-label, partner ve kullanım modülleri eski yetki kapılarıyla devam eder.

## Örnek gösterimi

Video galerisi dört gerçek, ayrı H.264 MP4 kullanır. Doğal/Premium/Keşfet aynı sentetik salon karesine bağlı farklı yerel kurgu örnekleridir; Dış Cephe bağımsız özgün sentetik cephe çalışmasına bağlıdır. Hiçbiri fal/Kling/Seedance üretimi veya o modellerin kamera hareketine kalite kanıtı değildir. Gerçek decoder metadata'sı gösterilir, preloading kapalıdır, ses/autoplay yoktur. Bozuk kaynakta çalışıyormuş gibi player bırakılmaz.

3D, önceki ölçülü sentetik GLB/Three.js viewer'ını kullanır. Panorama aynı CAD'nin salon kamerasından gerçekten equirectangular render edilmiş1024×512 dosyadır; yerel küresel viewer döndürülür. Tek oda, oda/hotspot geçişi yoktur; free-walk3D veya Pedra turu değildir. Ağır Three.js yalnız başlatınca yüklenir. Tam ekran tarayıcı destekliyorsa çalışır, aksi durumda açıklama gösterilir. Render/doku/observer/listener/RAF kaynakları kapanışta bırakılır.

`BeforeAfterSlider`, ana üç üründen ayrı, gerçek dosya düzeyinde fotoğraf düzenleme örneğidir. Aynı kamera/özgün PNG/hash/geometri; gerçek Sharp ton ve netlik dönüşümü. CSS filtre/crop/ilgisiz fotoğraf/AI-staging iddiası yoktur. Native range pointer/touch/ok/Home/End kullanır; aynı boyut ve sabit aspect layout shift'i önler. Kaynak eşleşmezse veya image yüklenmezse slider kapanır.

`npm run showcase:verify` build kapısı; registry şeması, yerel path/hash/rights, aynı kaynak bağlantıları, tam MP4 decode, codec/duration/audio/metadata,GLB magic,2:1pano ve gerçek comparison dönüşümü doğrulanır. Sonuçta belgelendirilen dosya hakları test edilir; görsel kalite veya kör insan kabulü test edilmiş sayılmaz.

## İzole statik paket

`npm run preview:build` → `npm run preview:serve`: yalnız loopback3100, `/showcase/` yeni galeri, `/spaces/` korunmuş V5 örnek stüdyosu, `/evaluation/` korunmuş değerlendirme formu. Statik paket Next workspace/backend ile karıştırılmaz; API/auth/admin/tour/secret erişimi404/405,functions0. Hizmet seçimi statik galeride yalnız ilgili hazır örneği açar ve üretim sunucusu olmadığı açıklanır. Gerçek dört adımlı iş/QA yolu tam yerel Next uygulamasındadır. Bu komut internet deployment yapmaz.

## Ölçüm ve sınırlar

Native browser medya değerleri ve ağ/HTTP durumları ölçülür; iş başarısı veya emlakçı kabulü uydurulmaz. Genişlikler375/390/430/768/1024/1280/1440, keyboard/focus/reduced-motion/axe ve iki Chromium emülasyon projesi kullanılır. Gerçek iPhone/Safari ve ekran okuyucu manuel doğrulaması ayrıdır. Yeniden çizilmiş arayüz ticariAI, native1080p, kabul edilmiş30snsağlayıcı üretimi veya kârlılık kanıtı değildir.
