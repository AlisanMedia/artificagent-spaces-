import type { StudioProduct } from "./real-estate-styles";

/** Product taxonomy, not an inference entitlement or authorization boundary. */
export const SERVICE_CATALOG_VERSION = "spaces-services-v1" as const;
export const SERVICE_CATEGORIES = [
  { id: "video", label: "Video", summary: "İlanınıza hareket katın." },
  {
    id: "photo",
    label: "Fotoğraf",
    summary: "Mülkünüzü doğru ve özenli gösterin.",
  },
  {
    id: "tour",
    label: "Sanal tur ve plan",
    summary: "Mekânı tanıtan farklı deneyimler.",
  },
  {
    id: "marketing",
    label: "İlan ve marka",
    summary: "Tanıtımınızı tek yerde hazırlayın.",
  },
  {
    id: "analysis",
    label: "Hesaplama ve bilgi",
    summary: "Varsayımları açık hesaplar ve kaynaklar.",
  },
  {
    id: "office",
    label: "Ofis ve partner",
    summary: "Ekibinizin çalışmasını düzenleyin.",
  },
] as const;
export type ServiceCategory = (typeof SERVICE_CATEGORIES)[number]["id"];
export type CompetitorSource =
  | "owner-baseline"
  | "emlakvideo"
  | "reele"
  | "pedra"
  | "reimaginehome"
  | "applydesign"
  | "styldod";
export type ServiceAction =
  | { readonly kind: "LOCAL_VIDEO"; readonly product: "video" }
  | { readonly kind: "LOCAL_SAMPLE"; readonly product: "ai-3d" | "tour-360" }
  | {
      readonly kind: "LOCAL_CALCULATOR";
      readonly tool: "mortgage" | "rental-yield";
    }
  | { readonly kind: "PLANNED" };
export type CatalogService = Readonly<{
  id: string;
  category: ServiceCategory;
  title: string;
  summary: string;
  input: string;
  output: string;
  disclosure: string;
  sources: readonly CompetitorSource[];
  action: Readonly<ServiceAction>;
}>;
type PlannedRow = readonly [
  id: string,
  title: string,
  summary: string,
  input: string,
  output: string,
  disclosure: string,
  sources: readonly CompetitorSource[],
];
function planned(
  category: ServiceCategory,
  rows: readonly PlannedRow[],
): CatalogService[] {
  return rows.map(
    ([id, title, summary, input, output, disclosure, sources]) => ({
      id,
      category,
      title,
      summary,
      input,
      output,
      disclosure,
      sources,
      action: { kind: "PLANNED" },
    }),
  );
}
const sourcePhoto = "Kullanım hakkı sizde olan mülk fotoğrafı.";
const concept =
  "Tasarımsal öneri, mevcut mülkün gerçek hâli değildir; açıkça etiketlenmeli ve incelenmelidir.";
const entries: CatalogService[] = [
  {
    id: "listing-video",
    category: "video",
    title: "Emlak tanıtım videosu",
    summary: "Doğal, sinematik veya karma bir anlatımla mülk tanıtımı.",
    input:
      "Sıralanmış, izinli mülk fotoğrafları; yerel denemede yalnız sentetik kaynaklar.",
    output: "Yerel H.264 MP4 · 640 × 360 veya 360 × 640.",
    disclosure:
      "Şimdi kaynak fotoğraflardan yerel kurgu yapılır. Canlı AI kamera hareketi kapalıdır; final teslimi farklı bir incelemecinin onayına bağlıdır.",
    sources: ["emlakvideo", "reele", "pedra", "applydesign", "styldod"],
    action: { kind: "LOCAL_VIDEO", product: "video" },
  },
  {
    id: "social-video",
    category: "video",
    title: "Reels ve Story videosu",
    summary: "Telefon ekranına uygun dikey bir ilan kurgusu.",
    input:
      "İzinli fotoğraflar ve dikey biçim seçimi; yalnız sentetik yerel deneme.",
    output: "Yerel 9:16 H.264 MP4 · 360 × 640.",
    disclosure:
      "Mevcut video akışında Dikey · Reels seçilir. Ritme otomatik eşleme, sosyal hesaba yayın ve canlı AI üretimi yoktur; bağımsız teslim onayı korunur.",
    sources: ["emlakvideo", "reele", "applydesign"],
    action: { kind: "LOCAL_VIDEO", product: "video" },
  },
  ...planned("video", [
    [
      "aerial-video",
      "Drone hissi veren video",
      "Dış cepheyi havadan bakış hissiyle sunan kamera hareketi.",
      sourcePhoto,
      "Hedef: kısa MP4 klip.",
      "Sanal kamera hareketi gerçek drone çekimi diye sunulamaz. Fotoğrafta görünmeyen çevre doğrulanmış sayılmaz.",
      ["emlakvideo"],
    ],
    [
      "parcel-video",
      "Arsa ve parsel videosu",
      "Doğrulanmış sınırlar ve izinli haritayla arsa tanıtımı.",
      "Yetkili parsel sınırı, lisanslı harita ve hakları doğrulanmış kaynaklar.",
      "Hedef: sınır açıklamalı MP4.",
      "Resmî sınır veya imar hakkı uydurulamaz; harita lisansı ve güncel veri gerekir.",
      ["emlakvideo"],
    ],
    [
      "aerial-approach",
      "Havadan yaklaşma açılışı",
      "Mülke uzaktan yaklaşan yaratıcı açılış sekansı.",
      "İzinli dış cephe, lisanslı çevre verisi ve açık konsept izni.",
      "Hedef: açılış MP4 klibi.",
      "Uzaydan veya uçaktan görüntü, gerçek uçuş kaydı ya da doğrulanmış çevre değildir.",
      ["emlakvideo"],
    ],
    [
      "project-film",
      "Konut projesi filmi",
      "Onaylı proje görsellerini sıralı bir tanıtımda birleştirin.",
      "Hakları doğrulanmış proje renderları ve onaylı özellikler.",
      "Hedef: MP4 proje tanıtımı.",
      "Planlanan proje ile inşa edilmiş mevcut yapı ayrı belirtilmelidir.",
      ["emlakvideo"],
    ],
    [
      "construction-timelapse",
      "İnşaat gelişim canlandırması",
      "Arsadan tamamlanmış projeye konsept bir zaman akışı.",
      "İzinli arsa görseli ve onaylı proje tasarımı.",
      "Hedef: konsept MP4.",
      "Gerçek şantiye kaydı, teslim taahhüdü veya ruhsat kanıtı değildir.",
      ["emlakvideo"],
    ],
    [
      "transformation-video",
      "Önce ve sonra dönüşüm videosu",
      "Aynı kadrajdaki izinli görsellerden dönüşüm sunumu.",
      "Aynı mülk ve kamera kadrajına ait doğrulanmış önce/sonra çifti.",
      "Hedef: eşleştirilmiş MP4.",
      "Sanal değişiklik açıkça etiketlenir; farklı evler aynı dönüşüm gibi sunulamaz.",
      ["emlakvideo"],
    ],
    [
      "animated-sign",
      "Tabela ve logo animasyonu",
      "Kendi marka öğelerinize ölçülü hareket katın.",
      "Size ait logo/tabela ve yazı kullanım hakları.",
      "Hedef: kısa MP4 veya şeffaf hareketli marka öğesi.",
      "Marka hakkı ve metnin doğru kalması kontrol edilmelidir.",
      ["emlakvideo", "reele"],
    ],
    [
      "creative-transitions",
      "Yaratıcı video geçişleri",
      "Sahneler arasında ışık veya parça etkili yaratıcı kurgu.",
      "İzinli, ayrı sahneler ve açık yaratıcı kurgu seçimi.",
      "Hedef: geçişli MP4.",
      "Kurgu geçişi, odalar arasında gerçek fiziksel bağlantı varmış gibi anlatılamaz.",
      ["emlakvideo", "reele"],
    ],
    [
      "virtual-presenter",
      "Sanal sunuculu tanıtım",
      "Onaylı ilan metnini okuyan, açıkça sanal bir sunucu.",
      "Onaylı metin, avatar/ses kullanım izni ve kişisel temsil onayı.",
      "Hedef: sunuculu MP4.",
      "Gerçek kişiyi izinsiz taklit etmek veya sanal sunucuyu gerçek danışman gibi göstermek yoktur.",
      ["emlakvideo"],
    ],
    [
      "voiceover-captions",
      "Seslendirme ve altyazı",
      "Tanıtımınızı onaylı metin ve okunaklı altyazıyla destekleyin.",
      "Onaylı metin, lisanslı ses ve video kaynağı.",
      "Hedef: sesli MP4 ve altyazı dosyası.",
      "Canlı ses üretimi kapalıdır. Ses klonlama ayrıca açık izin gerektirir; mevcut canlı voice agent değiştirilmez.",
      ["emlakvideo", "reele", "pedra", "applydesign"],
    ],
    [
      "music-edit",
      "Müzikli ve ritimli kurgu",
      "İzinli müzikle sahnelerin temposunu düzenleyin.",
      "İzinli klipler ve ticari kullanıma uygun müzik lisansı.",
      "Hedef: müzikli MP4.",
      "Lisans ve platform kullanım hakkı doğrulanmadan müzik eklenmez; ritme eşleme henüz yoktur.",
      ["emlakvideo", "reele", "pedra"],
    ],
    [
      "guided-edit",
      "Yönlendirmeli video düzenleme",
      "Kısa seçimlerle sahne sırası ve sunum tercihlerini değiştirin.",
      "Mevcut proje, yetkili oturum ve izinli düzenleme talebi.",
      "Hedef: incelenebilir yeni video sürümü.",
      "Serbest talimat yetki, maliyet veya inceleme kapısını değiştiremez; AI düzenleme bağlı değildir.",
      ["reele"],
    ],
  ]),
  ...planned("photo", [
    [
      "photo-enhance",
      "Fotoğraf iyileştirme",
      "Işık, renk ve netliği daha dengeli hâle getirin.",
      sourcePhoto,
      "Hedef: düzenlenmiş JPEG/PNG.",
      "Bu hizmetin canlı veya kullanıcı dosyasına bağlı düzenleme hattı henüz yoktur. Görünür mimari korunmalıdır.",
      [
        "emlakvideo",
        "reele",
        "pedra",
        "reimaginehome",
        "applydesign",
        "styldod",
      ],
    ],
    [
      "photo-upscale",
      "Yüksek çözünürlük",
      "Uygun kaynak fotoğrafın çıktı boyutunu yükseltin.",
      sourcePhoto,
      "Hedef: boyutu doğrulanmış görsel.",
      "4K ve gerçek ayrıntı kalitesi test edilmeden vaat edilmez. Büyütülmüş dosya, gerçek yeni detay kanıtı değildir.",
      ["emlakvideo", "reimaginehome"],
    ],
    [
      "virtual-staging",
      "Sanal mobilya yerleşimi",
      "Boş oda için açıkça sanal olarak işaretli dekorasyon önerisi.",
      sourcePhoto,
      "Hedef: sanal dekorasyon görseli.",
      concept,
      [
        "emlakvideo",
        "reele",
        "pedra",
        "reimaginehome",
        "applydesign",
        "styldod",
      ],
    ],
    [
      "empty-room",
      "Odayı boş gösterme",
      "Mevcut eşyalar olmadan oda tasarımı fikri.",
      sourcePhoto,
      "Hedef: düzenlenmiş oda görseli.",
      "Kaldırılan mobilyanın arkasındaki duvar/döşeme tahmindir; mülkün gerçek boş hâli diye sunulamaz.",
      ["emlakvideo", "pedra", "reimaginehome", "applydesign", "styldod"],
    ],
    [
      "object-cleanup",
      "Nesne ve dağınıklık temizliği",
      "Seçili geçici nesneler için kontrollü düzenleme.",
      "Hakları size ait fotoğraf ve kaldırılacak nesne seçimi.",
      "Hedef: temizlenmiş görsel.",
      "Kusur, tesisat, yapısal unsur veya güvenlik sorunu gizlenemez; kişisel öğeler ayrıca incelenir.",
      ["emlakvideo", "reele", "pedra", "reimaginehome", "styldod"],
    ],
    [
      "owned-mark-cleanup",
      "İzinli yazı ve marka temizliği",
      "Yalnız size ait ve kaldırma hakkınız olan ek yazıları düzenleyin.",
      "Kaynak mülkiyeti ve yazılı kaldırma hakkı.",
      "Hedef: izinli görsel düzenlemesi.",
      "Üçüncü taraf filigranı, eser atfı, sağlayıcı imzası veya zorunlu AI etiketi kaldırılamaz.",
      ["emlakvideo"],
    ],
    [
      "day-to-dusk",
      "Gündüzden akşama görünüm",
      "Aynı kadraj için sanatsal akşam ışığı önerisi.",
      sourcePhoto,
      "Hedef: etiketli akşam görseli.",
      "Gerçek çekim saati, fiziksel güneş simülasyonu veya mevcut manzara kanıtı değildir.",
      ["reele", "reimaginehome", "styldod"],
    ],
    [
      "sky-replacement",
      "Gökyüzü düzenleme",
      "Dış mekân fotoğrafı için kontrollü gökyüzü seçimi.",
      sourcePhoto,
      "Hedef: etiketli gökyüzü düzenlemesi.",
      "Yeni manzara veya iklim koşulu gerçek ilan özelliği gibi gösterilemez.",
      ["pedra", "reimaginehome", "applydesign"],
    ],
    [
      "wall-paint",
      "Duvar rengi denemesi",
      "Mevcut yüzeylerde farklı boya tonlarını görselleştirin.",
      sourcePhoto,
      "Hedef: renk önerisi görseli.",
      concept,
      ["emlakvideo", "reimaginehome"],
    ],
    [
      "material-redesign",
      "Zemin ve malzeme denemesi",
      "Kaplama ve yüzeyler için alternatif tasarım fikirleri.",
      sourcePhoto,
      "Hedef: malzeme önerisi görseli.",
      concept,
      ["reimaginehome", "pedra"],
    ],
    [
      "interior-concept",
      "İç mekân ve alan tasarımı",
      "Yenileme veya oda kullanımına dair konsept alternatifler.",
      "İzinli kaynak, tasarım amacı ve varsa onaylı plan.",
      "Hedef: açıkça konsept olarak etiketli görsel.",
      "Oda genişletme gerçek metrekare veya mevcut mimariyi değişmiş gibi sunamaz; ölçüler kaynak gerektirir.",
      ["emlakvideo", "reimaginehome", "pedra", "styldod"],
    ],
    [
      "exterior-concept",
      "Dış cephe tasarımı",
      "Binanız için alternatif cephe malzemesi ve renk önerileri.",
      sourcePhoto,
      "Hedef: konsept cephe görseli.",
      concept,
      ["emlakvideo", "reimaginehome", "pedra"],
    ],
    [
      "sketch-render",
      "Eskizden mimari görsel",
      "İzinli çiziminizi tasarım sunumuna dönüştürme.",
      "İzinli eskiz, onaylı tasarım ve ölçü bilgileri.",
      "Hedef: mimari konsept render.",
      "Render uygulanmış yapı veya ölçülmüş dijital ikiz değildir.",
      ["emlakvideo", "pedra"],
    ],
    [
      "landscape-concept",
      "Bahçe ve çevre tasarımı",
      "Peyzaj, sert zemin ve havuz için konsept öneriler.",
      "İzinli bahçe görseli ve tasarım sınırları.",
      "Hedef: etiketli peyzaj önerisi.",
      "Eklenen havuz, ağaç veya düzenleme mevcut mülk özelliği değildir; izin/ruhsat vaadi yapılamaz.",
      ["reimaginehome"],
    ],
    [
      "seasonal-photo",
      "Mevsim ve sunum varyasyonu",
      "Fotoğrafın mevsimsel atmosferi için sanatsal alternatif.",
      sourcePhoto,
      "Hedef: açıkça düzenlenmiş görsel.",
      "Gerçek hava durumu, çevre bakımı veya mevsim kaydı değildir.",
      ["reimaginehome"],
    ],
    [
      "furniture-design",
      "Mobilya değiştirme ve çoklu açı",
      "Aynı oda için tutarlı mobilya ve stil alternatifleri.",
      "Aynı odaya ait izinli açılar ve tasarım referansı.",
      "Hedef: incelenmiş görsel seti.",
      "Mobilyanın satışa dahil olduğu varsayılamaz. Açılar arası tutarlılık gerçek üretimde ayrıca test edilmelidir.",
      ["reimaginehome", "applydesign", "pedra"],
    ],
    [
      "perspective-correction",
      "Perspektif ve dikey çizgi düzeltme",
      "Mimari çekimlerde kadrajı ve dikey çizgileri düzenleme.",
      sourcePhoto,
      "Hedef: oranı kontrol edilmiş fotoğraf.",
      "Mekânı daha büyük göstermek için geometri çarpıtılamaz; düzenleme inceleme gerektirir.",
      ["pedra", "reimaginehome"],
    ],
    [
      "illustrated-property",
      "İllüstrasyon ve maket sunumu",
      "Mülkünüz için özgün çizim, albüm veya minyatür sunum.",
      "Hakları doğrulanmış fotoğraf ve izinli özgün görsel yön.",
      "Hedef: açıkça stilize görsel.",
      "Başka marka/sanatçının özgün stil veya varlıkları kopyalanmaz; çıktı gerçek fotoğraf diye sunulmaz.",
      ["emlakvideo"],
    ],
    [
      "batch-photo",
      "Toplu fotoğraf hazırlama",
      "Bir ilanın görsellerini tutarlı seçimlerle düzenleme.",
      "Tek mülkün izinli kaynakları ve kaynak-sürüm bağlantısı.",
      "Hedef: kaynaklarıyla eşlenmiş görsel paketi.",
      "Toplu düzenleme her görselin kaynağını ve bağımsız inceleme gereğini kaldırmaz.",
      ["reimaginehome", "styldod"],
    ],
  ]),
  {
    id: "ai-3d-tour",
    category: "tour",
    title: "AI 3D deneyim",
    summary: "Mekânı etkileşimli olarak keşfetmeye yönelik deneyim.",
    input:
      "Gelecekte izinli fotoğraflar; şu an bağımsız hazırlanmış sentetik GLB örneği.",
    output: "Şimdi: serbest gezilebilen sentetik 3D örnek.",
    disclosure:
      "World Labs üretimi kapalıdır. Örnek, fotoğraftan üretilmiş gerçek mülk veya ölçülmüş dijital ikiz değildir.",
    sources: ["owner-baseline"],
    action: { kind: "LOCAL_SAMPLE", product: "ai-3d" },
  },
  {
    id: "panorama-tour",
    category: "tour",
    title: "360° sanal tur",
    summary: "Gerçek 2:1 panorama üzerinden etrafa bakın.",
    input:
      "Gerçek 2:1 equirectangular panorama; standart oda fotoğrafı uygun değildir.",
    output: "Şimdi: lisanslı tek panorama için etkileşimli örnek.",
    disclosure:
      "Pedra üretimi ve dış paylaşım kapalıdır. Örnekte oda geçişi veya fotoğraftan serbest 3D üretimi yoktur.",
    sources: ["pedra", "styldod", "applydesign"],
    action: { kind: "LOCAL_SAMPLE", product: "tour-360" },
  },
  ...planned("tour", [
    [
      "floorplan-2d",
      "2D kat planı",
      "Onaylı ölçülerden okunaklı bir plan hazırlama.",
      "Doğrulanmış ölçüler, bağlantılar ve plan hakları.",
      "Hedef: ölçü kaynaklı 2D plan.",
      "Ölçüsüz fotoğraflardan kesin metrekare ve görünmeyen oda çıkarılamaz.",
      ["pedra", "styldod"],
    ],
    [
      "floorplan-3d",
      "3D kat planı ve maket",
      "Onaylı plandan sabit render veya model sunumu.",
      "İzinli plan, doğrulanmış ölçüler ve tasarım ayrımı.",
      "Hedef: 3D plan görseli/modeli; video ayrıca belirtilir.",
      "Dönen maket videosu, serbest gezilebilir tur değildir. Ölçüler bağımsız kaynak gerektirir.",
      ["emlakvideo", "pedra", "styldod"],
    ],
    [
      "parcel-visual",
      "Arsa için 3D ve harita sunumu",
      "Sınırları doğrulanmış arsa için görsel sunum.",
      "Yetkili sınır, lisanslı harita ve varsa onaylı proje.",
      "Hedef: etiketli harita veya konsept model.",
      "Mülkiyet, imar hakkı veya resmî sınır garantisi verilemez.",
      ["emlakvideo"],
    ],
    [
      "guided-tour",
      "Sesli mülk rehberi",
      "Sadece seçili mülkün onaylı bilgilerini anlatan rehber.",
      "Onaylı mülk sürümü, yayın izni ve ziyaretçi ses onayı.",
      "Hedef: turla bağlantılı sesli rehber.",
      "Yerel simülasyon korunur; gerçek ElevenLabs oturumu kapalıdır. Başka mülk bilgisi, kesin rezervasyon veya ölçü uydurulamaz.",
      ["owner-baseline"],
    ],
    [
      "panorama-staging",
      "360° sanal dekorasyon",
      "Panorama içinde açıkça sanal olarak etiketli mobilya.",
      "İzinli gerçek 2:1 panorama ve tasarım amacı.",
      "Hedef: düzenlenmiş 2:1 panorama.",
      "Görsel yerleştirme fiziksel oda veya serbest geometri üretimi değildir; dikiş ve kaynak tutarlılığı incelenmelidir.",
      ["applydesign", "pedra"],
    ],
    [
      "custom-object-3d",
      "Mobilyadan 3D nesne",
      "Hakları doğrulanmış bir ürün için 3D sunum öğesi.",
      "İzinli ürün fotoğrafları ve gerekli ölçüler.",
      "Hedef: lisanslı/etiketli 3D nesne.",
      "Ölçüsüz model gerçek üretim boyutu veya kullanım uygunluğu kanıtı değildir.",
      ["applydesign"],
    ],
  ]),
  ...planned("marketing", [
    [
      "listing-copy",
      "İlan açıklaması",
      "Onaylı mülk bilgilerinden anlaşılır bir ilan taslağı.",
      "Kaynaklı mülk özellikleri; doğrulanmamış alanlar boş kalır.",
      "Hedef: düzenlenebilir metin taslağı.",
      "Fiyat, müsaitlik, manzara, metrekare veya yasal uygunluk uydurulamaz.",
      ["emlakvideo", "pedra"],
    ],
    [
      "social-copy",
      "Sosyal medya metni",
      "İlanınıza uygun kısa paylaşım açıklamaları.",
      "Onaylı mülk bilgileri ve seçilen paylaşım kanalı.",
      "Hedef: metin taslağı; otomatik yayın yok.",
      "Erişim, satış veya etkileşim artışı garantisi verilemez.",
      ["emlakvideo"],
    ],
    [
      "listing-poster",
      "İlan afişi ve vitrin kartı",
      "İzinli görseller ve doğru bilgilerle ilan tasarımı.",
      "İzinli fotoğraf, onaylı ilan bilgileri ve marka.",
      "Hedef: indirilebilir afiş/vitrin görseli.",
      "Yanıltıcı fiyat, sahte rozet veya gerçek olmayan sonuç kullanılamaz.",
      ["emlakvideo", "pedra"],
    ],
    [
      "listing-brochure",
      "Mülk sunum dosyası",
      "Mülk görselleri ve belgeli özellikleri tek sunumda.",
      "İzinli kaynaklar ve onaylı bilgiler.",
      "Hedef: taslak PDF/sunum.",
      "Belgesiz özellik, resmî değer veya hukuki güvence eklenemez.",
      ["emlakvideo"],
    ],
    [
      "listing-translation",
      "Çok dilli ilan",
      "Doğrulanmış ilan metninin dil uyarlaması.",
      "Onaylı orijinal metin ve hedef dil.",
      "Hedef: incelenebilir çeviri taslağı.",
      "Çeviri hukuki sözleşme onayı değildir; yeni mülk iddiaları eklenemez.",
      ["emlakvideo"],
    ],
    [
      "reply-drafts",
      "Mesaj ve yorum yanıtları",
      "Danışmanın inceleyip kullanacağı kısa yanıt taslakları.",
      "İzinli, kişisel bilgileri azaltılmış soru ve onaylı cevap bilgileri.",
      "Hedef: manuel gönderilecek metin.",
      "Otomatik mesaj gönderilmez; fiyat taahhüdü veya randevu onayı uydurulamaz.",
      ["emlakvideo"],
    ],
    [
      "location-copy",
      "Konum avantajları metni",
      "Belgeli çevre özelliklerini anlaşılır biçimde anlatma.",
      "Lisanslı, güncel konum verisi ve doğrulanmış mesafeler.",
      "Hedef: kaynaklı açıklama.",
      "Okul, ulaşım, mesafe veya güvenlik iddiası kaynaksız yazılamaz.",
      ["emlakvideo"],
    ],
    [
      "campaign-hooks",
      "Reklam başlığı ve açılış metni",
      "Aynı ilan için farklı, açık ve ölçülü başlıklar.",
      "Onaylı mülk bilgileri ve kampanya amacı.",
      "Hedef: başlık/metin alternatifleri.",
      "Sahte kıtlık, garanti getiri veya ölçülmemiş dönüşüm iddiası yoktur.",
      ["emlakvideo"],
    ],
    [
      "agency-logo",
      "Ofis kimliği ve logo",
      "Ajansınız için hakları kontrol edilebilir marka taslağı.",
      "Marka adı, izinli öğeler ve tasarım tercihleri.",
      "Hedef: incelenebilir marka taslağı.",
      "Tescil veya benzersizlik garantisi değildir; üçüncü taraf marka taklidi yoktur.",
      ["emlakvideo"],
    ],
    [
      "brand-music",
      "Markaya özel müzik",
      "Hakları açık, markaya uygun müzik taslağı.",
      "Ticari lisans, kullanım alanı ve onaylı yönlendirme.",
      "Hedef: lisanslı ses dosyası.",
      "Üretim bağlı değildir; telif ve dağıtım izinleri ayrıca doğrulanmalıdır.",
      ["emlakvideo", "reele"],
    ],
    [
      "property-page",
      "Mülke özel tanıtım sayfası",
      "Video, görsel ve izinli iletişim için tek sayfa.",
      "Onaylı yayın, kaynaklar, marka ve iletişim onayı.",
      "Hedef: izinli mülk sayfası.",
      "Yeni web yayını ve müşteri bağlantısı kapalıdır; mevcut yayın-token güvenliği korunur.",
      ["reele", "applydesign"],
    ],
    [
      "qr-business-card",
      "QR kartvizit ve paylaşım kartı",
      "Onaylı bağlantı için sade bir paylaşım öğesi.",
      "Sahipliği doğrulanmış, izinli HTTPS hedefi ve marka.",
      "Hedef: QR/kart görseli.",
      "Özel kaynak bağlantıları veya süresi geçmiş grant QR içine gömülemez; dış yayın izni gerekir.",
      ["emlakvideo", "reele"],
    ],
    [
      "social-scheduling",
      "Sosyal medya yayın planı",
      "Onaylanmış içerikler için düzenli paylaşım takvimi.",
      "Yetkili sosyal hesap, yayın onayı ve kanal sözleşmeleri.",
      "Hedef: onaylı gönderi planı.",
      "Canlı hesap bağlantısı veya otomatik paylaşım etkin değildir; başkasının hesabına erişilmez.",
      ["pedra"],
    ],
  ]),
  {
    id: "mortgage",
    category: "analysis",
    title: "Konut kredisi hesaplayıcı",
    summary: "Tutar, aylık faiz ve vadeyle yaklaşık taksit hesabı.",
    input: "Sizin girdiğiniz örnek kredi tutarı, aylık nominal faiz ve vade.",
    output: "Cihazda hesaplanan taksit ve yaklaşık toplam ödeme.",
    disclosure:
      "Banka teklifi değildir. Vergi, sigorta, komisyon ve değişken faiz dahil değildir; canlı oran alınmaz.",
    sources: ["emlakvideo"],
    action: { kind: "LOCAL_CALCULATOR", tool: "mortgage" },
  },
  {
    id: "rental-yield",
    category: "analysis",
    title: "Kira getirisi senaryosu",
    summary: "Girilen fiyat ve giderlerle basit getiri karşılaştırması.",
    input: "Örnek alım bedeli, aylık kira, yıllık gider ve doluluk varsayımı.",
    output: "Brüt/net yıllık getiri ve basit geri dönüş süresi.",
    disclosure:
      "Tahmin veya yatırım tavsiyesi değildir. Vergi, finansman ve değer artışı dahil değildir; getiri garantisi yoktur.",
    sources: ["emlakvideo"],
    action: { kind: "LOCAL_CALCULATOR", tool: "rental-yield" },
  },
  ...planned("analysis", [
    [
      "transaction-cost",
      "Alım satım gider senaryosu",
      "Belgeli oranlarla maliyet kalemlerini bir araya getirme.",
      "Güncel resmî oranlar, işlem türü ve açık varsayımlar.",
      "Hedef: kaynaklı gider tablosu.",
      "Vergi, DASK ve tapu oranları doğrulanmadan otomatik oran uydurulmaz; hukuki/mali onay gerekir.",
      ["emlakvideo"],
    ],
    [
      "region-report",
      "Bölge ve piyasa özeti",
      "Lisanslı güncel verilerle karşılaştırmalı bölge bilgisi.",
      "Yetkili veri kaynağı, dönem ve kullanım izni.",
      "Hedef: kaynaklı bölge raporu.",
      "Resmî ekspertiz veya kesin satış fiyatı değildir; güncel veri olmadan değer tahmini yapılmaz.",
      ["emlakvideo"],
    ],
    [
      "sunlight-study",
      "Güneş alma incelemesi",
      "Ölçülü sahne ve tarih üzerinden ışık çalışması.",
      "Doğrulanmış konum, yön, çevre geometrisi ve hesap modeli.",
      "Hedef: varsayımlı güneş çalışması.",
      "Mevcut sanatsal gün saatleri fiziksel ölçüm değildir; güneş saati garantisi verilmez.",
      ["emlakvideo"],
    ],
    [
      "solar-roof",
      "Çatı güneş enerjisi senaryosu",
      "Kaynaklı tarifelerle varsayımsal çatı sistemi değerlendirmesi.",
      "Doğrulanmış çatı, statik/izin durumu ve güncel teknik tarifeler.",
      "Hedef: uzman incelemeli senaryo.",
      "Tasarruf, geri ödeme veya kurulum uygunluğu garantisi verilemez; uzman ve güncel kaynak gerekir.",
      ["emlakvideo"],
    ],
    [
      "shadow-study",
      "Gölge incelemesi",
      "Doğrulanmış geometriyle tarih ve saat karşılaştırması.",
      "Ölçülü çevre geometrisi, konum ve fiziksel hesap.",
      "Hedef: kaynaklı gölge çalışması.",
      "Yerel 3D görsel efektleri gerçek konutun gölge analizi değildir.",
      ["emlakvideo"],
    ],
    [
      "seismic-sources",
      "Deprem bilgi kaynakları",
      "Yetkili kaynakları yapı raporlarından ayrı gösterme.",
      "Güncel resmî bölge verisi ve yetkili mühendislik raporları.",
      "Hedef: kaynak bağlantılı bilgi özeti.",
      "Bölge haritası bina güvenliği raporu değildir. Yapı için güvenli/güvensiz notu veya sertifika üretilemez.",
      ["emlakvideo"],
    ],
    [
      "amenity-report",
      "Çevre ve ulaşım özeti",
      "Belgeli yakın çevre bilgilerini tek yerde toplama.",
      "Lisanslı POI/harita verisi ve doğrulanmış tarih/mesafe.",
      "Hedef: kaynaklı çevre özeti.",
      "Kişisel adres dış servise gönderilmez; mesafe ve çevre skoru kaynaksız üretilemez.",
      ["emlakvideo"],
    ],
    [
      "property-report",
      "Birleşik mülk raporu",
      "Onaylı kaynaklardan hazırlanacak mülk özeti.",
      "Yetkili belgeler, güncel veriler ve paylaşım izni.",
      "Hedef: kaynaklı, incelenmiş rapor.",
      "Mülkiyet, deprem güvenliği, ruhsat veya fiyat garantisi değildir.",
      ["emlakvideo"],
    ],
    [
      "construction-budget",
      "İnşaat bütçesi senaryosu",
      "Varsayımları belirtilmiş maliyet kalemleri.",
      "Kaynaklı birim maliyetler, tarih ve yetkili metraj.",
      "Hedef: taslak bütçe tablosu.",
      "Sabit teklif, resmî keşif veya gerçekleşmiş maliyet değildir.",
      ["emlakvideo"],
    ],
    [
      "progress-payment",
      "Hakediş taslağı",
      "Onaylı miktarlardan dönemsel çalışma tablosu.",
      "Yetkili metraj, sözleşme ve döneme ait belgeler.",
      "Hedef: incelemeye tabi hesap taslağı.",
      "Gerçek fatura, ödeme, onaylanmış hakediş veya bağlayıcı belge oluşturulmaz.",
      ["emlakvideo"],
    ],
  ]),
  ...planned("office", [
    [
      "listing-presentation",
      "Yetki ve danışman sunumu",
      "Danışmanın onaylayacağı sade hizmet sunumu.",
      "Doğrulanmış ofis bilgileri ve izinli mülk materyalleri.",
      "Hedef: düzenlenebilir sunum taslağı.",
      "Sahte başarı, müşteri görüşü veya hizmet garantisi eklenemez.",
      ["emlakvideo"],
    ],
    [
      "document-drafts",
      "Emlak belge taslakları",
      "Uzman incelemesine sunulacak belge düzeni.",
      "Yetkili, veri minimizasyonu uygulanmış belge girdileri.",
      "Hedef: imzasız taslak; hukuki onay yok.",
      "Avukatlık hizmeti, imzalanmış yetki, resmî belge veya hukuki uygunluk garantisi değildir.",
      ["emlakvideo"],
    ],
    [
      "lead-workspace",
      "Müşteri ve talep takibi",
      "Yalnız kendi ofisine ait izinli talepleri düzenleme.",
      "Açık onaylı talep ve yetkili kurum oturumu.",
      "Hedef: kurumla sınırlı talep çalışma alanı.",
      "Yerel sentetik lead altyapısı korunur; gerçek CRM, dış aktarım ve müşteri aktivasyonu kapalıdır.",
      ["emlakvideo", "reele"],
    ],
    [
      "white-label",
      "Ofise özel markalama",
      "Aynı ürün deneyimini izinli ofis kimliğiyle sunma.",
      "Yetkili kurum, doğrulanmış marka öğeleri ve sözleşme.",
      "Hedef: kurumla sınırlı tema ve rapor markası.",
      "Yerel tema altyapısı korunur; özel alan adı, canlı hesap ve alt bayi sözleşmesi ayrıca onay gerektirir.",
      ["reele", "pedra"],
    ],
    [
      "partner-workspace",
      "Ajans ve bayi çalışma alanı",
      "Atanmış alt ofisler için izinli yönetim görünümü.",
      "Yetkili partner ilişkisi ve açık veri erişim sözleşmesi.",
      "Hedef: sınırlı ve denetlenebilir partner görünümü.",
      "Yerel partner altyapısı korunur; başka ofislerin ham medya ve lead verisine erişim açılmaz.",
      ["pedra", "styldod"],
    ],
    [
      "engagement-report",
      "İlan etkileşim raporu",
      "Onaylı görüntüleme ve doğrulanmış talepleri ayrı izleme.",
      "İzinli etkinlik verisi, dönem ve kurum yetkisi.",
      "Hedef: kurumla sınırlı özet rapor.",
      "Yerel sentetik analitik korunur. Görüntüleme satış değildir; ham konuşma kaydı veya izinsiz takip toplanmaz.",
      ["reele", "styldod"],
    ],
    [
      "expert-review",
      "Uzman inceleme ve revizyon",
      "Kaynak ve sonucu karşılaştıran bağımsız kalite süreci.",
      "Aynı mülk/sürüme bağlı kaynaklar, çıktılar ve farklı incelemeci.",
      "Hedef: kayıtlı inceleme ve gerekirse yeniden çekim isteği.",
      "Mevcut zorunlu yerel inceleme korunur. Ücretli uzman hizmeti, insan kapasitesi ve teslim SLA henüz sunulmaz.",
      ["styldod", "pedra"],
    ],
    [
      "architect-documents",
      "Mimar ve yüklenici taslakları",
      "Proje belgelerini uzman incelemesi için düzenleme.",
      "Yetkili proje belgeleri ve mesleki inceleme.",
      "Hedef: imzasız düzenlenebilir taslak.",
      "Ruhsat, statik onay, mesleki imza veya uygulanabilir proje garantisi değildir.",
      ["emlakvideo"],
    ],
    [
      "listing-compliance-guide",
      "İlan yetkisi ve mevzuat rehberi",
      "Güncel resmî kaynaklarla yönlendirme.",
      "Tarihli resmî mevzuat kaynakları ve hukuki inceleme.",
      "Hedef: bilgi rehberi ve kontrol listesi.",
      "EİDS bağlantısı, kimlik/yetki doğrulaması veya hukuk onayı yapılmaz; kişisel belge toplanmaz.",
      ["emlakvideo"],
    ],
  ]),
];

export function validateServiceCatalog(services: readonly CatalogService[]) {
  const seen = new Set<string>();
  for (const service of services) {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(service.id) || seen.has(service.id))
      throw Error("SERVICE_CATALOG_ID_INVALID");
    seen.add(service.id);
    if (
      !SERVICE_CATEGORIES.some(
        (category) => category.id === service.category,
      ) ||
      !service.sources.length ||
      service.sources.some(
        (s) =>
          ![
            "owner-baseline",
            "emlakvideo",
            "reele",
            "pedra",
            "reimaginehome",
            "applydesign",
            "styldod",
          ].includes(s),
      ) ||
      [
        service.title,
        service.summary,
        service.input,
        service.output,
        service.disclosure,
      ].some((v) => !v.trim())
    )
      throw Error("SERVICE_CATALOG_INCOMPLETE");
    if (
      !["LOCAL_VIDEO", "LOCAL_SAMPLE", "LOCAL_CALCULATOR", "PLANNED"].includes(
        service.action.kind,
      )
    )
      throw Error("SERVICE_CATALOG_ACTION_DENIED");
    if (
      service.action.kind === "LOCAL_VIDEO" &&
      (!["listing-video", "social-video"].includes(service.id) ||
        service.action.product !== "video")
    )
      throw Error("SERVICE_CATALOG_ACTION_DENIED");
    if (
      service.action.kind === "LOCAL_SAMPLE" &&
      !(
        (service.id === "ai-3d-tour" && service.action.product === "ai-3d") ||
        (service.id === "panorama-tour" &&
          service.action.product === "tour-360")
      )
    )
      throw Error("SERVICE_CATALOG_ACTION_DENIED");
    if (
      service.action.kind === "LOCAL_CALCULATOR" &&
      (!["mortgage", "rental-yield"].includes(service.action.tool) ||
        service.id !== service.action.tool)
    )
      throw Error("SERVICE_CATALOG_ACTION_DENIED");
  }
  return services;
}
validateServiceCatalog(entries);
export const SERVICES: readonly CatalogService[] = Object.freeze(
  entries.map((service) =>
    Object.freeze({
      ...service,
      sources: Object.freeze([...service.sources]),
      action: Object.freeze(service.action),
    }),
  ),
);
export function serviceById(id: string): CatalogService | undefined {
  return SERVICES.find((service) => service.id === id);
}
export function serviceStatus(service: CatalogService) {
  switch (service.action.kind) {
    case "LOCAL_VIDEO":
      return "Yerel kurgu";
    case "LOCAL_SAMPLE":
      return "Etkileşimli örnek";
    case "LOCAL_CALCULATOR":
      return "Cihazda hesaplanır";
    case "PLANNED":
      return "Hazırlanıyor";
  }
}
function searchable(value: string) {
  return value
    .toLocaleLowerCase("tr-TR")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replaceAll("ı", "i");
}
export function findServices(
  query: string,
  category: ServiceCategory | "all",
  availableOnly = false,
) {
  const words = searchable(query.slice(0, 160))
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  return SERVICES.filter(
    (service) =>
      (category === "all" || service.category === category) &&
      (!availableOnly || service.action.kind !== "PLANNED") &&
      words.every((word) =>
        searchable(`${service.title} ${service.summary}`).includes(word),
      ),
  );
}
export function serviceProduct(service: CatalogService): StudioProduct | null {
  return service.action.kind === "LOCAL_VIDEO" ||
    service.action.kind === "LOCAL_SAMPLE"
    ? service.action.product
    : null;
}
