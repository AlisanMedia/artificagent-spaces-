# Hizmet kataloğu ve rakip incelemesi

29 Ekim 2026 · `spaces-services-v1` · Kaynak: altı resmî sitenin 15 herkese açık sayfası. Bu inceleme kısmi ürün keşfidir; hesap içi işlev, kalite, fiyat, API veya OEM/alt bayi lisansı kabulü değildir. Sadece kimlik bilgisi gerektirmeyen HTTPS GET kullanıldı; ücretli arama/tarama, signup, kredi veya inference yoktur. Rakiplerin kodu, görseli, videosu, markalı şablonu ve promptu alınmadı. Ortak hizmet türleri kendi Türkçe metinlerimizle yeniden gruplandı.

## İncelenen resmî kaynaklar

| Kaynak                                                                                                                                                                                         | Gözlenen kapsam                                                                                                   | Kullanılabilirlik çıkarımının sınırı                                                                              |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| [EmlakVideo.ai](https://emlakvideo.ai) — [video](https://emlakvideo.ai/kategori/video), [fotoğraf](https://emlakvideo.ai/kategori/foto), [pazarlama](https://emlakvideo.ai/kategori/pazarlama) | İlan/drone tarzı video, yaratıcı geçiş, arsa/proje, avatar, fotoğraf düzenleme, metin/afiş ve ofis/hesap araçları | Reklam sayfasında listeleniyor. Üretim denenmedi; yıldızlar, işlem süreleri, 4K ve satış vaatleri aktarılmadı.    |
| [Reel-E](https://www.reel-e.ai/features)                                                                                                                                                       | Tek yükleme sonrası video/fotoğraf/sayfa; kurgu, ses/altyazı, müzik, marka, lead ve analitik                      | Akış fikri gözlendi; gerçek kalite ve ticari fiyat karşılaştırması yapılmadı.                                     |
| [Pedra](https://pedra.ai) — [resmî API dizini](https://pedra.ai/api-documentation)                                                                                                             | Sanal mobilya/boşaltma/renovasyon, görsel iyileştirme, video, 360 tur, plan ve sosyal planlama                    | Dokümantasyon API yüzeylerini gösterir; bizim hesap erişimi, gerçek transport veya alt bayi hakkımızı kanıtlamaz. |
| [REimagineHome](https://www.reimaginehome.ai)                                                                                                                                                  | Mobilya/dekor, nesne temizliği, peyzaj, gökyüzü/akşam, yüzey, çözünürlük ve perspektif                            | Kamuya açık ürün adları gözlendi; görsel sadakat ve veri hakları doğrulanmadı.                                    |
| [ApplyDesign](https://www.applydesign.io/features)                                                                                                                                             | Sanal mobilya, çoklu açı, 360 dekorasyon, nesne modelleme, manuel düzenleme, video ve mülk sayfası                | Tek tık, hız ve kalite iddiaları bağımsız denenmedi.                                                              |
| [Styldod](https://www.styldod.com)                                                                                                                                                             | Fotoğraf/renovasyon/plan/render/video, profesyonel inceleme ve kurumsal medya iş akışları                         | Uzman hizmeti listesi, bizim hazır insan kapasitemiz veya SLA'mız değildir.                                       |

URL, tarih, HTTP sonucu ve SHA256 kayıtları: [competitors-2026-10-29.json](../fixtures/service-catalog/competitors-2026-10-29.json). Ham HTML ve araştırma logları kamuya kopyalanmadı. Arama sonucu veya tahmin edilmiş başka domain, resmî ürün kanıtı sayılmadı.

## Sade kullanım kararı

İlk ekran mevcut üç ürün yolunu ve tek yükleme eylemini korur. Ek araçlar **Tüm hizmetleri keşfet** altında kapalı başlar. Arama Türkçe harfleri ve aksansız yazımı destekler; tek kategori seçimi, kullanılabilirlik filtresi, altışar kart ve kısa hizmet detayı sunulur. Başlık sayısı hizmet satışı veya çalışan 75 entegrasyon demek değildir. Ana sayfaya 75 kart, yeni menü katmanı, prompt alanı veya model seçici eklenmedi.

Her detay gereken kaynak, gerçek/hedef çıktı, şimdiki durum ve kritik sınırı birlikte gösterir. Hazırlanan hizmet dosya/ücret kabul etmez; ilgisiz video veya sıradan fotoğrafı o hizmetin çıktısı gibi açmaz. Canlı provider, müşteri hesabı, fiyat veya süre vaadi yoktur. İki yerel video seçeneği mevcut stüdyoya gider; kaynak/grant/review/indirme kontrolleri aynıdır. İki tur seçeneği sadece doğrulanmış örnek açar. Statik önizlemede yeni video oluşturma eylemi gösterilmez.

Kapalı kataloğun kartları ve form alanları başlangıç DOM'una yüklenmez; yalnız açılınca oluşturulur. Sunucu çıktısındaki katalog istemci etkileşimleri bağlanana kadar `inert` kalır. Bu işaret erişim yetkisi değildir. Dosya seçici de mevcut oturum/rol/stüdyo hazır olmadan etkinleşmez; gerçek API yetkilendirmesi değişmez. Testler gizli SSR alanına erken dosya yazarak gerçek kullanıcı akışını atlamaz. Ekran boyutu/axe kanıtı ve gizlilik/funnel çekimleri ayrı görevlerde korunur; timeout veya güvenlik eşikleri artırılmaz.

## Korunan ürün doğruluğu

- EmlakVideo'nun listesinde “3D Tur” diye tanımlanan bazı çıktılar dönen maket **videosudur**. Bizde bu, **3D kat planı ve maket** kapsamına karşılık gelir; serbest gezilebilir AI dünya veya 360 turla eşitlenmez.
- Drone, uçuş, arsa gelişimi, dekorasyon, akşam, cephe ve alan değiştirme, gerekli kanıt yoksa açıkça **konsept/sanal değişiklik** kalır. Mülkün gerçek boyutu, manzarası veya bitmiş hâli olarak sunulamaz.
- Filigran/yazı düzenleme yalnız hak sahibinin yetkisiyle değerlendirilecek kapsamdır; üçüncü taraf atfı, sağlayıcı imzası veya zorunlu AI etiketi kaldırılamaz.
- Bölgesel deprem verisi bina güvenliği raporu değildir. EmlakVideo'nun ilgili kamu sayfası da resmî risk raporu olmadığını belirtiyor. Bizde bina için otomatik güvenlik notu yoktur.
- Gerçek faiz, vergi, DASK, ruhsat, müşteri, çevre/harita ve ekspertiz verisi alınmadı. Yeni iki hesaplayıcı sadece kullanıcının örnek varsayımlarını işler.
- Kaynaklı sesli rehber, serbest 3D, white-label, partner ve tenant/izin sınırları önceki ürün yetkisinden korunur; her biri birebir rakipte kanıtlandı diye işaretlenmez.

## Gerçek çalışan yeni araçlar

**Konut kredisi senaryosu:** aylık nominal faiz `r` için eşit taksit `P × r / (1 − (1+r)^(-n))`; sıfır faizde `P/n`. Küçük oranlarda sayısal kararlılık için `log1p`/`expm1` kullanılır. Tutarlar en çok 1 milyar TL, para girdileri en çok iki ondalık, vade 1–600 tam ay, aylık nominal faiz %0–10. Son taksit ödeme planı çıkarılmaz; toplam ve aylık değer ayrı yuvarlanır. Vergi/sigorta/komisyon/değişken oran dahil değildir. Banka teklifi veya gerçek oran karşılaştırması yoktur.

**Kira getirisi senaryosu:** yıllık gelir `aylık kira × dolu ay`, net `gelir − yıllık gider`, getiri `gelir veya net / alım bedeli`. Sıfır/negatif net gelirde pozitif geri dönüş süresi verilmez. Doluluk 0–12 tam ay; vergi/finansman/değer artışı hariçtir. Piyasa tahmini, teklif veya yatırım tavsiyesi değildir.

İki form da RAM'de çalışır; API, analytics gönderimi, localStorage, cookie, signup, lead, ödeme veya finansal işlem yoktur. Kapatınca girdiler temizlenir; alan düzenlenince eski sonuç kaldırılır. Negatif, sonsuz, geçersiz ve sınır dışı değerler reddedilir. Formlar ancak açıldığında ayrı bundle olarak yüklenir.

## API ve beta önceliği

1. Onaylı sınırlı sentetik deneyle mevcut fal video rotalarının gerçek kalitesi ve kabul edilmiş çıktı maliyetini ölçmek. Bütçe şimdi USD0, canlı deneme onaylı değildir.
2. Fotoğraf iyileştirme, sanal mobilya, temizleme ve akşam örneklerini tek, hakları açıklığa kavuşmuş sağlayıcı sözleşmesi altında ayrı test etmek. Pedra dizini aday doküman sağlar; bu çalışma seçili sağlayıcı stratejisini değiştirmez veya yeni API'ı etkinleştirmez.
3. Kaynaklı ilan metni/afiş ve marka paketini, aynı mülk/sürüm ve bağımsız yayın incelemesiyle bütünleştirmek.
4. Gerçek 360 için Pedra ve AI mekânsal yorum için World Labs hak/maliyet/veri kapılarını ayrı çözmek. Normal fotoğraf ile panorama gereksinimini karıştırmamak.
5. Harita, mevzuat, bina güvenliği, CRM, ses/kimlik, gerçek sosyal yayın ve ödeme gerektiren kapsamları lisans/veri/güvenlik/owner onayı olmadan açmamak.

Bu sıralama ürün hipotezidir; bağımsız emlakçı kullanılabilirliği veya “rakiplerden en iyi” sonucu ölçülmüş değildir. Vercel deployment/billing kapısı ve USD0 sınırı değişmez; yayına alınmadı.

## Tam hizmet listesi

Durumlar yalnız katalogdaki bu yolu anlatır. “Hazırlanıyor” satırında önceki yerel teknik altyapının bulunması, yeni self-service hizmetin canlı olduğu anlamına gelmez.

### Video — 14 kapsam

| Hizmet                        | Şimdiki durum                | Kaynak / çıktı şartı                                                                                                        |
| ----------------------------- | ---------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Emlak tanıtım videosu         | Yerel kurgu; canlı AI kapalı | Sıralanmış, izinli mülk fotoğrafları; yerel denemede yalnız sentetik kaynaklar. Yerel H.264 MP4 · 640 × 360 veya 360 × 640. |
| Reels ve Story videosu        | Yerel kurgu; canlı AI kapalı | İzinli fotoğraflar ve dikey biçim seçimi; yalnız sentetik yerel deneme. Yerel 9:16 H.264 MP4 · 360 × 640.                   |
| Drone hissi veren video       | Hazırlanıyor; üretim kapalı  | Kullanım hakkı sizde olan mülk fotoğrafı. Hedef: kısa MP4 klip.                                                             |
| Arsa ve parsel videosu        | Hazırlanıyor; üretim kapalı  | Yetkili parsel sınırı, lisanslı harita ve hakları doğrulanmış kaynaklar. Hedef: sınır açıklamalı MP4.                       |
| Havadan yaklaşma açılışı      | Hazırlanıyor; üretim kapalı  | İzinli dış cephe, lisanslı çevre verisi ve açık konsept izni. Hedef: açılış MP4 klibi.                                      |
| Konut projesi filmi           | Hazırlanıyor; üretim kapalı  | Hakları doğrulanmış proje renderları ve onaylı özellikler. Hedef: MP4 proje tanıtımı.                                       |
| İnşaat gelişim canlandırması  | Hazırlanıyor; üretim kapalı  | İzinli arsa görseli ve onaylı proje tasarımı. Hedef: konsept MP4.                                                           |
| Önce ve sonra dönüşüm videosu | Hazırlanıyor; üretim kapalı  | Aynı mülk ve kamera kadrajına ait doğrulanmış önce/sonra çifti. Hedef: eşleştirilmiş MP4.                                   |
| Tabela ve logo animasyonu     | Hazırlanıyor; üretim kapalı  | Size ait logo/tabela ve yazı kullanım hakları. Hedef: kısa MP4 veya şeffaf hareketli marka öğesi.                           |
| Yaratıcı video geçişleri      | Hazırlanıyor; üretim kapalı  | İzinli, ayrı sahneler ve açık yaratıcı kurgu seçimi. Hedef: geçişli MP4.                                                    |
| Sanal sunuculu tanıtım        | Hazırlanıyor; üretim kapalı  | Onaylı metin, avatar/ses kullanım izni ve kişisel temsil onayı. Hedef: sunuculu MP4.                                        |
| Seslendirme ve altyazı        | Hazırlanıyor; üretim kapalı  | Onaylı metin, lisanslı ses ve video kaynağı. Hedef: sesli MP4 ve altyazı dosyası.                                           |
| Müzikli ve ritimli kurgu      | Hazırlanıyor; üretim kapalı  | İzinli klipler ve ticari kullanıma uygun müzik lisansı. Hedef: müzikli MP4.                                                 |
| Yönlendirmeli video düzenleme | Hazırlanıyor; üretim kapalı  | Mevcut proje, yetkili oturum ve izinli düzenleme talebi. Hedef: incelenebilir yeni video sürümü.                            |

### Fotoğraf — 19 kapsam

| Hizmet                             | Şimdiki durum               | Kaynak / çıktı şartı                                                                                  |
| ---------------------------------- | --------------------------- | ----------------------------------------------------------------------------------------------------- |
| Fotoğraf iyileştirme               | Hazırlanıyor; üretim kapalı | Kullanım hakkı sizde olan mülk fotoğrafı. Hedef: düzenlenmiş JPEG/PNG.                                |
| Yüksek çözünürlük                  | Hazırlanıyor; üretim kapalı | Kullanım hakkı sizde olan mülk fotoğrafı. Hedef: boyutu doğrulanmış görsel.                           |
| Sanal mobilya yerleşimi            | Hazırlanıyor; üretim kapalı | Kullanım hakkı sizde olan mülk fotoğrafı. Hedef: sanal dekorasyon görseli.                            |
| Odayı boş gösterme                 | Hazırlanıyor; üretim kapalı | Kullanım hakkı sizde olan mülk fotoğrafı. Hedef: düzenlenmiş oda görseli.                             |
| Nesne ve dağınıklık temizliği      | Hazırlanıyor; üretim kapalı | Hakları size ait fotoğraf ve kaldırılacak nesne seçimi. Hedef: temizlenmiş görsel.                    |
| İzinli yazı ve marka temizliği     | Hazırlanıyor; üretim kapalı | Kaynak mülkiyeti ve yazılı kaldırma hakkı. Hedef: izinli görsel düzenlemesi.                          |
| Gündüzden akşama görünüm           | Hazırlanıyor; üretim kapalı | Kullanım hakkı sizde olan mülk fotoğrafı. Hedef: etiketli akşam görseli.                              |
| Gökyüzü düzenleme                  | Hazırlanıyor; üretim kapalı | Kullanım hakkı sizde olan mülk fotoğrafı. Hedef: etiketli gökyüzü düzenlemesi.                        |
| Duvar rengi denemesi               | Hazırlanıyor; üretim kapalı | Kullanım hakkı sizde olan mülk fotoğrafı. Hedef: renk önerisi görseli.                                |
| Zemin ve malzeme denemesi          | Hazırlanıyor; üretim kapalı | Kullanım hakkı sizde olan mülk fotoğrafı. Hedef: malzeme önerisi görseli.                             |
| İç mekân ve alan tasarımı          | Hazırlanıyor; üretim kapalı | İzinli kaynak, tasarım amacı ve varsa onaylı plan. Hedef: açıkça konsept olarak etiketli görsel.      |
| Dış cephe tasarımı                 | Hazırlanıyor; üretim kapalı | Kullanım hakkı sizde olan mülk fotoğrafı. Hedef: konsept cephe görseli.                               |
| Eskizden mimari görsel             | Hazırlanıyor; üretim kapalı | İzinli eskiz, onaylı tasarım ve ölçü bilgileri. Hedef: mimari konsept render.                         |
| Bahçe ve çevre tasarımı            | Hazırlanıyor; üretim kapalı | İzinli bahçe görseli ve tasarım sınırları. Hedef: etiketli peyzaj önerisi.                            |
| Mevsim ve sunum varyasyonu         | Hazırlanıyor; üretim kapalı | Kullanım hakkı sizde olan mülk fotoğrafı. Hedef: açıkça düzenlenmiş görsel.                           |
| Mobilya değiştirme ve çoklu açı    | Hazırlanıyor; üretim kapalı | Aynı odaya ait izinli açılar ve tasarım referansı. Hedef: incelenmiş görsel seti.                     |
| Perspektif ve dikey çizgi düzeltme | Hazırlanıyor; üretim kapalı | Kullanım hakkı sizde olan mülk fotoğrafı. Hedef: oranı kontrol edilmiş fotoğraf.                      |
| İllüstrasyon ve maket sunumu       | Hazırlanıyor; üretim kapalı | Hakları doğrulanmış fotoğraf ve izinli özgün görsel yön. Hedef: açıkça stilize görsel.                |
| Toplu fotoğraf hazırlama           | Hazırlanıyor; üretim kapalı | Tek mülkün izinli kaynakları ve kaynak-sürüm bağlantısı. Hedef: kaynaklarıyla eşlenmiş görsel paketi. |

### Sanal tur ve plan — 8 kapsam

| Hizmet                        | Şimdiki durum                  | Kaynak / çıktı şartı                                                                                                             |
| ----------------------------- | ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| AI 3D deneyim                 | Yalnız hazır etkileşimli örnek | Gelecekte izinli fotoğraflar; şu an bağımsız hazırlanmış sentetik GLB örneği. Şimdi: serbest gezilebilen sentetik 3D örnek.      |
| 360° sanal tur                | Yalnız hazır etkileşimli örnek | Gerçek 2:1 equirectangular panorama; standart oda fotoğrafı uygun değildir. Şimdi: lisanslı tek panorama için etkileşimli örnek. |
| 2D kat planı                  | Hazırlanıyor; üretim kapalı    | Doğrulanmış ölçüler, bağlantılar ve plan hakları. Hedef: ölçü kaynaklı 2D plan.                                                  |
| 3D kat planı ve maket         | Hazırlanıyor; üretim kapalı    | İzinli plan, doğrulanmış ölçüler ve tasarım ayrımı. Hedef: 3D plan görseli/modeli; video ayrıca belirtilir.                      |
| Arsa için 3D ve harita sunumu | Hazırlanıyor; üretim kapalı    | Yetkili sınır, lisanslı harita ve varsa onaylı proje. Hedef: etiketli harita veya konsept model.                                 |
| Sesli mülk rehberi            | Hazırlanıyor; üretim kapalı    | Onaylı mülk sürümü, yayın izni ve ziyaretçi ses onayı. Hedef: turla bağlantılı sesli rehber.                                     |
| 360° sanal dekorasyon         | Hazırlanıyor; üretim kapalı    | İzinli gerçek 2:1 panorama ve tasarım amacı. Hedef: düzenlenmiş 2:1 panorama.                                                    |
| Mobilyadan 3D nesne           | Hazırlanıyor; üretim kapalı    | İzinli ürün fotoğrafları ve gerekli ölçüler. Hedef: lisanslı/etiketli 3D nesne.                                                  |

### İlan ve marka — 13 kapsam

| Hizmet                         | Şimdiki durum               | Kaynak / çıktı şartı                                                                                   |
| ------------------------------ | --------------------------- | ------------------------------------------------------------------------------------------------------ |
| İlan açıklaması                | Hazırlanıyor; üretim kapalı | Kaynaklı mülk özellikleri; doğrulanmamış alanlar boş kalır. Hedef: düzenlenebilir metin taslağı.       |
| Sosyal medya metni             | Hazırlanıyor; üretim kapalı | Onaylı mülk bilgileri ve seçilen paylaşım kanalı. Hedef: metin taslağı; otomatik yayın yok.            |
| İlan afişi ve vitrin kartı     | Hazırlanıyor; üretim kapalı | İzinli fotoğraf, onaylı ilan bilgileri ve marka. Hedef: indirilebilir afiş/vitrin görseli.             |
| Mülk sunum dosyası             | Hazırlanıyor; üretim kapalı | İzinli kaynaklar ve onaylı bilgiler. Hedef: taslak PDF/sunum.                                          |
| Çok dilli ilan                 | Hazırlanıyor; üretim kapalı | Onaylı orijinal metin ve hedef dil. Hedef: incelenebilir çeviri taslağı.                               |
| Mesaj ve yorum yanıtları       | Hazırlanıyor; üretim kapalı | İzinli, kişisel bilgileri azaltılmış soru ve onaylı cevap bilgileri. Hedef: manuel gönderilecek metin. |
| Konum avantajları metni        | Hazırlanıyor; üretim kapalı | Lisanslı, güncel konum verisi ve doğrulanmış mesafeler. Hedef: kaynaklı açıklama.                      |
| Reklam başlığı ve açılış metni | Hazırlanıyor; üretim kapalı | Onaylı mülk bilgileri ve kampanya amacı. Hedef: başlık/metin alternatifleri.                           |
| Ofis kimliği ve logo           | Hazırlanıyor; üretim kapalı | Marka adı, izinli öğeler ve tasarım tercihleri. Hedef: incelenebilir marka taslağı.                    |
| Markaya özel müzik             | Hazırlanıyor; üretim kapalı | Ticari lisans, kullanım alanı ve onaylı yönlendirme. Hedef: lisanslı ses dosyası.                      |
| Mülke özel tanıtım sayfası     | Hazırlanıyor; üretim kapalı | Onaylı yayın, kaynaklar, marka ve iletişim onayı. Hedef: izinli mülk sayfası.                          |
| QR kartvizit ve paylaşım kartı | Hazırlanıyor; üretim kapalı | Sahipliği doğrulanmış, izinli HTTPS hedefi ve marka. Hedef: QR/kart görseli.                           |
| Sosyal medya yayın planı       | Hazırlanıyor; üretim kapalı | Yetkili sosyal hesap, yayın onayı ve kanal sözleşmeleri. Hedef: onaylı gönderi planı.                  |

### Hesaplama ve bilgi — 12 kapsam

| Hizmet                        | Şimdiki durum                    | Kaynak / çıktı şartı                                                                                                 |
| ----------------------------- | -------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Konut kredisi hesaplayıcı     | Cihazda çalışan yeni hesaplayıcı | Sizin girdiğiniz örnek kredi tutarı, aylık nominal faiz ve vade. Cihazda hesaplanan taksit ve yaklaşık toplam ödeme. |
| Kira getirisi senaryosu       | Cihazda çalışan yeni hesaplayıcı | Örnek alım bedeli, aylık kira, yıllık gider ve doluluk varsayımı. Brüt/net yıllık getiri ve basit geri dönüş süresi. |
| Alım satım gider senaryosu    | Hazırlanıyor; üretim kapalı      | Güncel resmî oranlar, işlem türü ve açık varsayımlar. Hedef: kaynaklı gider tablosu.                                 |
| Bölge ve piyasa özeti         | Hazırlanıyor; üretim kapalı      | Yetkili veri kaynağı, dönem ve kullanım izni. Hedef: kaynaklı bölge raporu.                                          |
| Güneş alma incelemesi         | Hazırlanıyor; üretim kapalı      | Doğrulanmış konum, yön, çevre geometrisi ve hesap modeli. Hedef: varsayımlı güneş çalışması.                         |
| Çatı güneş enerjisi senaryosu | Hazırlanıyor; üretim kapalı      | Doğrulanmış çatı, statik/izin durumu ve güncel teknik tarifeler. Hedef: uzman incelemeli senaryo.                    |
| Gölge incelemesi              | Hazırlanıyor; üretim kapalı      | Ölçülü çevre geometrisi, konum ve fiziksel hesap. Hedef: kaynaklı gölge çalışması.                                   |
| Deprem bilgi kaynakları       | Hazırlanıyor; üretim kapalı      | Güncel resmî bölge verisi ve yetkili mühendislik raporları. Hedef: kaynak bağlantılı bilgi özeti.                    |
| Çevre ve ulaşım özeti         | Hazırlanıyor; üretim kapalı      | Lisanslı POI/harita verisi ve doğrulanmış tarih/mesafe. Hedef: kaynaklı çevre özeti.                                 |
| Birleşik mülk raporu          | Hazırlanıyor; üretim kapalı      | Yetkili belgeler, güncel veriler ve paylaşım izni. Hedef: kaynaklı, incelenmiş rapor.                                |
| İnşaat bütçesi senaryosu      | Hazırlanıyor; üretim kapalı      | Kaynaklı birim maliyetler, tarih ve yetkili metraj. Hedef: taslak bütçe tablosu.                                     |
| Hakediş taslağı               | Hazırlanıyor; üretim kapalı      | Yetkili metraj, sözleşme ve döneme ait belgeler. Hedef: incelemeye tabi hesap taslağı.                               |

### Ofis ve partner — 9 kapsam

| Hizmet                          | Şimdiki durum               | Kaynak / çıktı şartı                                                                                                        |
| ------------------------------- | --------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Yetki ve danışman sunumu        | Hazırlanıyor; üretim kapalı | Doğrulanmış ofis bilgileri ve izinli mülk materyalleri. Hedef: düzenlenebilir sunum taslağı.                                |
| Emlak belge taslakları          | Hazırlanıyor; üretim kapalı | Yetkili, veri minimizasyonu uygulanmış belge girdileri. Hedef: imzasız taslak; hukuki onay yok.                             |
| Müşteri ve talep takibi         | Hazırlanıyor; üretim kapalı | Açık onaylı talep ve yetkili kurum oturumu. Hedef: kurumla sınırlı talep çalışma alanı.                                     |
| Ofise özel markalama            | Hazırlanıyor; üretim kapalı | Yetkili kurum, doğrulanmış marka öğeleri ve sözleşme. Hedef: kurumla sınırlı tema ve rapor markası.                         |
| Ajans ve bayi çalışma alanı     | Hazırlanıyor; üretim kapalı | Yetkili partner ilişkisi ve açık veri erişim sözleşmesi. Hedef: sınırlı ve denetlenebilir partner görünümü.                 |
| İlan etkileşim raporu           | Hazırlanıyor; üretim kapalı | İzinli etkinlik verisi, dönem ve kurum yetkisi. Hedef: kurumla sınırlı özet rapor.                                          |
| Uzman inceleme ve revizyon      | Hazırlanıyor; üretim kapalı | Aynı mülk/sürüme bağlı kaynaklar, çıktılar ve farklı incelemeci. Hedef: kayıtlı inceleme ve gerekirse yeniden çekim isteği. |
| Mimar ve yüklenici taslakları   | Hazırlanıyor; üretim kapalı | Yetkili proje belgeleri ve mesleki inceleme. Hedef: imzasız düzenlenebilir taslak.                                          |
| İlan yetkisi ve mevzuat rehberi | Hazırlanıyor; üretim kapalı | Tarihli resmî mevzuat kaynakları ve hukuki inceleme. Hedef: bilgi rehberi ve kontrol listesi.                               |
