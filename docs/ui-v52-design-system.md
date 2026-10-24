# V5.2 — Kullanılabilir emlak stüdyosu

2026-10-24. V5.1 `2213b37c0b68813ebc6dcdb1d2cc4d1f671eaaa8` üzerine hedefli uygulama; yeniden scaffold veya pazarlama sitesi değildir. V2–V5 yetki/medya/review/voice/analitik/bayi/ekonomi sözleşmeleri korunur. Bu belge yasal veya ticari kabul değildir.

## İlk etkileşim

Statik örnek `/spaces/`: üç sessiz sekme (Oluştur / Örnekler / 3D Tur), kompakt ve görünür AI-kapalı etiketi, tek native dosya seçici, aynı davranışa bağlı drop alanı. İlk 390×844 görünümünde **Fotoğraf veya video ekle**. İkincil **Örnek mülkle dene**, boş stüdyoda hakları açık sabit örnekleri seçerek doğrudan tarz adımına gider. Sonraki adımlarda büyük başlık küçülür. Önceki CTA işlevseldi; giderilen sorun uzun üst bölüm ve ikinci yükleme alanının yarattığı tekrardır.

Üç belirgin eylemle hazır örnek: örnek mülk → tarz → hazır videoyu aç. Kartın tamamı native radio alanıdır; klavye/odak korunur. Sonuç gerçek, önceden hazırlanmış MP4'tür. Kullanıcı dosyası bu videoyu üretmez veya değiştirmez. Video oynatıcı poster öncelikli, otomatik oynatma/ses yok; gerçek dosya indirilebilir. Sonuçtaki açıklama: **Bu hazır örnek videodur; seçtiğin dosyadan oluşturulmadı.**

Örnekler, kişisel kaydedilmiş projeler olarak sunulmaz. Beş alanlı sentetik örnek mülkün planı/oda galerisi/doğrulanmış sentetik ölçüleri korunur. Ham CAD ana ekran görseli değildir. 3D: önce poster, açık **3D turu başlat** eylemiyle lazy Three.js/GLB; gerçek gezinme, günün zamanı, oda rotası, başlangıca dönme, kapatma. Gerçek ev rekonstrüksiyonu ve fiziksel güneş doğrulaması iddia edilmez. SHA ve lisans/kanıt bağlantıları kapalı, klavyeyle açılabilen **Teknik bilgi** altında.

Tam yerel uygulama `/spaces`: aynı görsel sözcük dağarcığı, tek yükleme girişi, gerçek özel yükleme/rights checkbox ve sunucu preflight. Örnek kısayolu mevcut yetkili `/fixture` yoluyla yeni yerel taslağa hakları açık örnek plan+fotoğraf ekler; mevcut dosyaların üzerine yazmaz. Bu fixture, statik beş alanlı Golden örneğiyle aynı değildir. Gerçek çıktı yine kaynaklardan render edilir; ayrı incelemeci onayı olmadan indirme/paylaşım yoktur. Yönetim ve Foundation arşivi özgün sınırlarında kalır. Statik davranış tam uygulamanın yerine geçirilmez.

## Token ve tipografi

| Token | Değer | Amaç |
|---|---|---|
| canvas | `#F7F6F2` | Sıcak açık stüdyo |
| surface | `#FFFFFF` | Seçim/dosya yüzeyleri |
| ink | `#192622` | Ana metin |
| subtle-text | `#58645D` | Yardımcı metin |
| brand-primary | `#0D624A` | Beyaz yazılı ana eylem, odak |
| soft-sage | `#E3EAE4` | Seçim ve dürüstlük açıklaması |
| border | `#D9DFD9` | Ölçülü ayırıcı |
| champagne | `#CAB58F` | Yalnız dekoratif; küçük yazı değil |
| cinema | `#101916` | Video ve 3D yüzeyi |

Manrope arayüz, Newsreader italic yalnız editoryal vurgu. Dört latin/latin-ext değişken WOFF2, toplam 144160 bayt; iki özgün SIL OFL 1.1 metni uygulama ile sunulur. Npm bağımlılığı eklenmedi. Kaynak paketler `@fontsource-variable/manrope@5.3.0` ve `@fontsource-variable/newsreader@5.3.0`; tarball sha512 ve gerçek WOFF2 sha256 kaydı [manifestte](../public/studio-assets-v52/manifest.json). Fontlar harici CDN'e bağlanmaz, ayrıca indirme ürünü değildir. `fc-query`/FreeType gerçek font cmap unionunda `şğçıİöüçŞĞÇÖÜ` doğrulandı; test tarayıcısında iki fontun Türkçe yüklenmesi ayrıca kontrol edilir. CI dosya/hash/lisans/bütçe sözleşmesini denetler; FreeType ölçümü yapılmış yerel ilk kaynak incelemesidir.

8px ritim, mobil 18px kenar, 1280px içerik sınırı, 12–16px kartlar, ana eylem52px/araç44px. Gövde temeli16px; küçük açıklama/etiketler daha küçüktür. Asimetrik masaüstü metin düzeni mobilde kaldırılır. Tek çizgili özgün kapı/çerçeve logosu, mevcut lucide ikonları. Yeni stok, gerçek ev fotoğrafı veya ücretli/üretken AI varlığı yok.

## Hareket ve performans

Basış140ms, seçim200ms, adım240ms, küçük görsel200ms, oynatıcı hazır geçişi240ms. Hareket yalnız durum değişimini anlatır. Reduced-motion tüm bu animation/transition'ları kapatır; sürekli pulse, auto-rotation, parallax, sahte bekleme/yüzde yok. Gerçek tam uygulama durumları değiştirilmez.

Statik bağımlılık sınırı: server/PGlite/jose/Next import yasakları korunur. Sabit Golden JSON build sırasında şema + kaynak hash ile doğrulanır; istemcide gereksiz Golden şema başlatılmaz. Domain hata constructor'ı ve stil sabitleri ayrı saf modüle alındı; eski exportlar aynı kimliği taşır, denials test edilir. Gerçek 3D komutları runtime validasyonunu korur. İlk sayfa Three/GLB/MP4 indirmez. Manrope preload, diğer fontlar kullanımda, dış CDN yok.

LCP≤2.5s / CLS≤0.1 yalnız hedeflerdir; gerçek üç soğuk Chromium ölçümü karşılaştırma kayıtlarında yayımlanır. Bu ölçüm gerçek iPhone, saha Core Web Vitals veya Safari testi değildir. Beş bağımsız emlakçı ile kullanılabilirlik testi yapılmadı; insan tasarım kabulü test sayısından çıkarılamaz.

## Kanıt ve tekrar

- Önce: `artifacts/screenshots/v52/before/`; V5.1 sabit build, yedi genişlik × beş durum.
- Sonra: `artifacts/screenshots/v52/after/`; aynı genişlik/durumlar.
- `npm run preview:build`; `npm run preview:test`.
- `node scripts/capture-studio-evidence.mjs`: localhost3111 üzerinde sadece statik build, 35 ekran + üç mobil lab örneği; `artifacts/ui-v52/after-*.json`. Gerçek kullanıcı dosyası kullanmaz. CPU/network throttle şartları JSON'dadır. Sunucu/brauzer finally ile kapatılır.
- `npx --no-install tsx scripts/verify-studio-assets.ts`: hakları açık15 varlığın allowlist/hash/format/font lisans/ölçü/bütçe doğrulaması. Bilinmeyen dosya/symlink/hash/kaynak sapması fail closed.
- Vercel sonuçlarının kanıtı ayrı raporda; yerel statik build bir HTTPS yayını değildir. Gold Revenue OS alanı kullanılmaz.

Rollback: geçmiş değiştirilmez. Hedefli V5.2 commit'leri için bağımsız review ve required checks ile yeni revert PR hazırlanır; bu görevde PR oluşturulmaz/merge edilmez. Sahip raporları, V5.1 dosyaları ve eski ekranlar silinmez. Önizleme paketinin özel backend içerdiği varsayılamaz: sıfır function, kapalı API/yönetim/tour-grant/.env/.git yolları ayrı test edilir.
