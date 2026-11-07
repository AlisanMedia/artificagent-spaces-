---
name: ArtificAgent Spaces — Mimari Sergi
description: Mineral çalışma yüzeyi, mürekkep medya sahnesi ve kobalt seçim dili.
colors:
  primary: "#2849ce"
  cobalt-wash: "#e7edff"
  mineral-canvas: "#eef2f7"
  paper: "#fff"
  ink: "#172737"
  slate: "#526274"
  line: "#d3dce6"
  ink-shell: "#142433"
  shell-paper: "#f1f5fb"
  shell-muted: "#bccbdc"
  ink-raised: "#20364b"
  field-line: "#b6c3d2"
  upload-fill: "#f5f7fc"
  upload-line: "#a7b8d9"
  hold-fill: "#fff1ef"
  hold-ink: "#8e291d"
  hold-line: "#e8bab2"
typography:
  display:
    fontFamily: Manrope, sans-serif
    fontSize: clamp(2.25rem, 3.4vw, 3.5rem)
    fontWeight: 650
    lineHeight: 1.13
    letterSpacing: -0.04em
  headline:
    fontFamily: Manrope, sans-serif
    fontSize: 2.5rem
    fontWeight: 650
    lineHeight: 1.14
    letterSpacing: -0.04em
  title:
    fontFamily: Manrope, sans-serif
    fontSize: 24px
    fontWeight: 650
    lineHeight: 1.25
  body:
    fontFamily: Manrope, system-ui, sans-serif
    fontSize: 16px
    lineHeight: 1.6
    letterSpacing: "0"
  supporting:
    fontFamily: Manrope, system-ui, sans-serif
    fontSize: 14px
    lineHeight: 1.6
  label:
    fontFamily: Manrope, system-ui, sans-serif
    fontSize: 14px
    fontWeight: 650
  caption:
    fontFamily: Manrope, system-ui, sans-serif
    fontSize: 12px
    lineHeight: 1.65
rounded:
  step: 8px
  field: 9px
  control: 10px
  action: 12px
  panel: 14px
  stage: 16px
spacing:
  space-1: 8px
  space-2: 16px
  compact-panel: 18px
  control-inline: 20px
  space-3: 24px
  paired-gap: 28px
  space-4: 32px
  wide-edge: 36px
  space-6: 48px
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.paper}"
    typography: "{typography.label}"
    rounded: "{rounded.action}"
    padding: 12px 20px
  button-secondary:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: 10px 16px
  button-inverse:
    backgroundColor: "{colors.paper}"
    textColor: "#1b364e"
    typography: "{typography.label}"
    rounded: "{rounded.action}"
    padding: 12px 20px
  button-sample:
    backgroundColor: transparent
    textColor: "{colors.primary}"
    rounded: "{rounded.control}"
    padding: 12px
  input-default:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.field}"
    padding: 10px 12px
  navigation-active:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.paper}"
    rounded: "{rounded.control}"
    padding: 12px 16px
  chip-mode:
    backgroundColor: "#23394d"
    textColor: "#e3edf8"
    rounded: 30px
    padding: 5px 10px
  workbench:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.stage}"
    padding: 24px
  upload-panel:
    backgroundColor: "{colors.upload-fill}"
    textColor: "{colors.slate}"
    rounded: "{rounded.action}"
    padding: 22px
  style-card-selected:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.action}"
---

# Design System: ArtificAgent Spaces

## Overview

**Creative North Star: "Mimari Sergi"**

Mimari Sergi, mülk medyasına açık ve ölçülü bir sergileme alanı verir. Mineral zemin çalışma alanını taşır; mürekkep paneller gezinmeyi ve gerçek medya sahnesini tanımlar. Kobalt, ortak kimlikte seçim ve eylemi görünür kılar. Düz yüzeyler, belirgin yazı hiyerarşisi ve dengeli boşluklar aynı dili müşteri stüdyosu, vitrin, yönetim, sonuçlar, eski çalışma alanı ve izole statik sunumda sürdürür.

Manrope hem başlığı hem arayüzü taşır. Medya kendi kaynak ve çıktı açıklamasıyla birlikte görünür; görsel alanın ağırlığı eldeki gerçek örnekten gelir. Çalışma kontrolleri hafif yüzeylerde, izleme kontrolleri koyu yüzeylerde kalır. Beyaz etiketli eylemler tenant rengini korur; bu değişkenlik ortak malzeme ve tipografi dilinin parçasıdır.

**Key Characteristics:**

- Mineral zemin üzerinde beyaz çalışma yüzeyleri.
- Mürekkep gezinme ve medya panelleri.
- Kobalt ortak kimlik; yetkili tenant rengine açık eylemler.
- Manrope ile sıkı başlıklar ve rahat okunan açıklamalar.
- Gerçek medya, görünür kaynak açıklaması ve ölçülü durum geri bildirimi.

**Tarama ve kapsam.** Bu belge, 7 Kasım 2026 tarihli yerel uygulamanın Scan-mode kaydıdır. Son yüklenen [architectural-exhibition.css](src/app/architectural-exhibition.css), [uygulama yerleşimi](src/app/layout.tsx), [statik giriş](src/preview/entry.tsx) ve [değerlendirme girişi](src/preview/evaluation-entry.tsx) üzerinden CSS sırası elle incelendi. Kontrol ve font tabanı [studio-visual.css](src/app/studio-visual.css), [platform.css](src/app/platform.css), [globals.css](src/app/globals.css), [preview.css](src/preview/preview.css) ve [evaluation.css](src/preview/evaluation.css) ile karşılaştırıldı. [Güncel yüzey özeti](.impeccable/briefs/spaces-redesign.md), [stüdyo bileşenleri](src/features/platform/studio-presentation.tsx), [tenant renk bağlama noktası](src/features/platform/creation-studio.tsx) ve gerçek yerel ekran görüntüleri açıklamayı destekler. Ekran görüntüleri depo dışındaki yerel teslim kanıtıdır; bu belgenin parçası olan herkese açık görseller değildir.

Önbilgi, belgelenen görsel tokenların normatif katmanıdır; adlar etkin CSS değerlerinin belge içi karşılıklarıdır. Bu kayıt mevcut yüzeylerle sınırlıdır. Onaylı bir kompozisyon karşılaştırması yoktur; resmi seed, launcher, detector ve comp-diff çalıştırılmadı. Yöntem manuel kaynak ve gerçek render taramasıdır. Panel için gereken sentezlenmiş OKLCH rampaları yalnız sidecar gösterim verisidir; normatif token veya uygulamada kullanılan renk ölçeği değildir.

## Colors

Soğuk mineral nötrler ve koyu mürekkep yüzeyler tek ortak vurgu olan kobaltı taşır. Kesin renk değerleri önbilgidedir.

### Primary

- **Kobalt** — primary; ortak gezinmenin etkin durumu, stil seçimi ve markasız eylem tabanı.
- **Kobalt yıkama** — cobalt-wash; hafif seçim yüzeyi. Etkin adımlar ve farklı seçim bileşenleri kaynakta kendi yakın tonlarını korur.

### Neutral

- **Mineral zemin** — mineral-canvas; sayfanın çalışma zemini.
- **Beyaz yüzey** — paper; çalışma panelleri, form alanları ve ters renkli vitrin eylemi.
- **Metin mürekkebi** — ink; açık yüzeyde başlık ve esas metin.
- **Arduvaz metin** — slate; açıklamalar ve destek metni.
- **Mineral çizgi** — line; grupları ayıran ince sınır.
- **Mürekkep kabuk** — ink-shell; gezinme, medya ve izleme alanı.
- **Kabuk beyazı / kabuk destek metni** — shell-paper / shell-muted; koyu yüzeydeki metin rolleri.
- **Yükseltilmiş mürekkep** — ink-raised; koyu kabuk içindeki ikincil yüzey.
- **Alan çizgisi** — field-line; metin alanı, seçim kutusu ve çok satırlı alan sınırı.
- **Yükleme yüzeyi / yükleme çizgisi** — upload-fill / upload-line; dosya ekleme alanının hafif dolgusu ve kesikli sınırı.

Hata ve durdurma uyarısının semantik üçlüsü hold-fill, hold-ink ve hold-line'dır. Yönetim uyarıları kaynakta yakın ama ayrı metin ve sınır tonları kullanır; bunlar yeni bir vurgu kimliği değildir.

**The Tenant Accent Rule.** Tenant eylemlerinde sunucudan gelen eylem ve metin renklerini koru; kobaltı eşitlemek için marka verisini değiştirme.

Birincil eylem önbilgisi markasız kobalt tabanı gösterir. Gerçek müşteri stüdyosu eylem rengi --ux-accent, metin rengi --ux-accent-text üzerinden gelir; [creation-studio.tsx](src/features/platform/creation-studio.tsx) bunları workspace.brand değerlerine bağlar. Yerel sentetik tenant bu nedenle yeşil eylem gösterebilir. Yükleme imleci ve yerel seçim kontrolleri de bu değişkeni kullanır. Kimlik ve tenant eylemi farklı semantik rollerdir.

## Typography

**Display Font:** Manrope, sans-serif.

**Body Font:** Manrope, system-ui, sans-serif.

Manrope'un açık geometrisi hem medya sergisini hem yoğun çalışma kontrollerini taşır. [Mevcut OFL font manifesti](public/studio-assets-v52/manifest.json) ve [yerel font tanımları](src/app/studio-visual.css) kaynak kabul edilir. Newsreader italik dosyaları tarihsel kurulumda kalır; güncel ana başlık rolü Manrope'dur. Yeni font veya uzak font kaynağı eklenmez.

### Hierarchy

- **Display** — vitrinin akışkan ana başlığı; önbilgideki display rolü.
- **Headline** — müşteri stüdyosu ana başlığı; önbilgideki headline rolü. Yönetim başlığı daha sıkı bir yerel ölçü kullanır (2rem, satır yüksekliği 1.2); statik stüdyo başlığı aynı boyda farklı satır yüksekliği kullanır (1.16).
- **Title** — statik medya paneli başlığı; önbilgideki title rolü. Hizmet ailesi başlıkları daha küçük ve sıkıdır (18px, satır yüksekliği 1.3).
- **Body / Supporting** — arayüz tabanı ve hizmet açıklamaları; body ve supporting rolleri. Çalışma açıklamaları ve başlık çevresi metinleri kaynakta ara ölçüler de kullanır (15px).
- **Label / Caption** — birincil eylem ve medya doğruluk açıklaması; label ve caption rolleri. Gezinti ve yardımcı kontroller daha sıkı ölçüler kullanır (13px); küçük teknik açıklamalar yüzeye göre değişir (10–12px).

**The Sans Hierarchy Rule.** Ana başlıkları Manrope ile kur; başlık içindeki vurgu aynı yazı ailesi ve karakteri devralır.

Başlıklar dengeli satır kırılımı, paragraflar okunur satır kırılımı kullanır. Türkçe karakterleri ve metnin doğal büyük/küçük harf düzenini koru; arayüz gövdesini geniş harf aralıklı etiketlere dönüştürme.

## Layout

Ortak dil, sabit bir sayfa şablonu yerine çalışma yüzeyi ve medya yüzeyinin ilişkisini tanımlar. Müşteri kabuğu geniş ekranda sabit yan gezinmeye geçer (en az 1100px; ray genişliği 240px, gezinme genişliği 208px). Daha dar ekranda üst gezinme kullanılır. Eski çalışma alanı kendi mevcut kabuk ve mobil menü yapısını korur.

Müşteri içerik sınırı (1480px), vitrin sergi iç sınırı (1320px), statik ana içerik (1440px) ve eski çalışma alanı (1540px) ayrı mevcut konteynerlerdir. Masaüstü müşteri kenarı (36px), vitrin kenarı (48px) ve statik kenar (40px) kaynakta farklıdır. Dar ekranda müşteri kenarı (18px), vitrin ve statik kenarı (20px) olur; tüm yüzeylere tek bir hayali konteyner uygulama.

Stüdyo çalışma ve medya sütunları genişte eşleşir; açılışta oranları hafifçe ayrılır (0.98fr / 1.02fr). Genel çalışma alanı ve statik sunum tek sütuna iner (en fazla 899px). Stüdyo açılışı tablet aralığında iki sütunu korur (768–899px); telefon yerleşimi tek sütundur (en fazla 767px). Sabit medya paneli dar düzende normal akışa döner.

Hizmet kütüphanesi örnekli hizmetleri altı kolonluk ızgarada ikişer kolonla taşır; orta genişlikte iki, telefonda tek hizmet sütununa iner. Örneksiz hizmetler başlık, kısa açıklama ve eylem içeren yatay satırlardır; telefonda açıklama ayrı satıra geçer. Vitrin video düzeni genişte sonuç ve kaynağı birlikte gösterir; telefonda video üst sıraya, küçük kaynak ve açıklama alt sıraya geçer. Medyanın mevcut oran ve gösterim kurallarını koru.

Temel boşluk adımları önbilgidedir. Gerçek bileşenler buna bağlamsal ara boşluklar ekler; birleştirilmiş sütun aralığı ve sıkı panel dolgusu da kayıttadır. Telefon başlıkları stüdyoda (1.8rem / 1.2), vitrinde (1.85rem / 1.18) olur. Değerlendirme formunun kendi tek sütun kırılması bulunur (en fazla 600px).

**The Reflow Rule.** Dar ekranda çalışma alanlarını yeniden sırala ve satırlara böl; masaüstü tuvalini küçülterek sıkıştırma.

## Elevation & Depth

Derinlik çoğunlukla mineral, beyaz ve mürekkep yüzeylerin ton ilişkisiyle kurulur. Birincil eylem, seçili stil ve ana açılış çalışma paneli gölgesizdir. Diğer çalışma adımlarında hafif bir gölge kalır; eski mülk kartının hover gölgesi de mevcut tabandan devralınır. Dolayısıyla sistem düz ağırlıklıdır, mutlak gölgesiz değildir.

### Shadow Vocabulary

- **Çalışma paneli** — hafif mevcut ayrım (0 10px 32px #14243307); ilk adım bunu none ile kaldırır.
- **Eski mülk kartı hover** — tabandan kalan hafif geri bildirim (0 5px 22px #1e1e1e0a).
- **Modal perde** — iletişim kutusunun arkasını ayıran mürekkep katmanı (#0e20357a); bir yüzey gölgesi değildir.

**The Tonal Depth Rule.** Büyük yüzeyleri öncelikle ton, dolgu ve boşlukla ayır; gölgeyi yeni bir dekoratif katmana dönüştürme.

## Shapes

Dikdörtgen yüzeyler yumuşak ve sınırlı köşelerle kurulur. Ön bilgi alan, kontrol, eylem, panel ve medya sahnesinin gerçek yarıçaplarını içerir. Çalışma ve medya sahneleri genişte stage, telefonda panel rolünü kullanır. Seçili stil ince sınırla birlikte içe oturan çizgi kullanır (2px, çizgi kaydırması -2px). Örneksiz hizmet satırlarında köşe ve kutu kaldırılır; üst ayırıcı kalır.

Yükleme bölgesi kesikli bir sınırla tanınır (1px). Medya çerçevesi görüntüyü kaynakta belirlenen contain veya cover davranışıyla keser. Yerel durum rozeti dar kabukta kapsüldür (30px); masaüstü yan rayda daha düz bir köşeye geçer (8px). Her bileşeni aynı kapsül biçimine dönüştürme.

## Components

### Buttons

Birincil eylem dolu ve nettir. Ön bilgi tabanını, sidecar ise değişkenlere bağlı gerçek uygulamasını gösterir. Müşteri/statiğin ortak birincil eylemi en az (48px), ikincil kontrol çoğunlukla en az (44px) yüksekliğindedir. Eylem çevresindeki boşluk, simge ve Türkçe etiket aynı odakta kalır.

- **Primary:** Tenant eylem değişkenleri; markasız durumda kobalt ve beyaz.
- **Secondary:** Beyaz yüzey, mineral sınır ve mürekkep metin.
- **Inverse:** Koyu vitrin açılışında beyaz yüzey ve koyu metin; kaynakta ayrı bir renk ataması vardır.
- **Sample:** İkincil örnek eylemi şeffaf yüzeyde kobalt metinle gösterilir; ana dosya eylemiyle aynı ağırlığa çıkmaz.
- **States:** Güncel ortak hover eylem ve metin renklerini aynı yetkili değişkenlerden tekrar bağlar, sınırı eylem rengine alır ve parlaklığı değiştirir (brightness 0.94); devralınan bazı sessiz kontrollerin filtresi ayrı kalır. Basılı düğme hafifçe iner (1px). Devre dışı düğme soluktur (opacity 0.55) ve uygun imleci korur.

### Chips

Yerel çalışma rozeti mürekkep üzerinde açık metin taşır. Bu etiket mevcut çalışma bağlamını bildirir; yeni ürün yetkisi veya inceleme onayı anlamına gelmez. Masaüstü raydaki köşe değişimi Shapes bölümünde tanımlıdır.

### Cards / Containers

Çalışma paneli beyaz ve sakindir; medya paneli mürekkep yüzeyde yer alır. Dolgu ve yarıçap görevine göre seçilir. Örneği bulunan hizmette gerçek medya üstte, kısa kopya ve eylem altta kalır. Örneksiz hizmet yatay satır düzenini korur. Seçili stil kartının kobalt çizgisi ve işareti seçimi destekler; gölge eklemez.

### Inputs / Fields

Alanlar açık yüzeyde mürekkep metin ve field-line sınırı kullanır. Yaygın alan dolgusu (10px 12px), en küçük kontrol yüksekliği (44px) ve yerel placeholder tonu kaynakta tanımlıdır. Yönetim paneli alanları yakın bir açık dolgu kullanır. Hatalar yumuşak sıcak zemin ve koyu metinle, açıklamasıyla birlikte görünür. Native dosya seçici, radio/checkbox, range ve dialog davranışlarını koru.

### Navigation

Desktop müşteri gezinmesinde etkin sayfa kobalt dolgu ve beyaz metinle ayrılır. Etkin olmayan koyu ray düğmesi hover durumunda daha açık mürekkep yüzeye geçer; mobil gezinme hafif zemin üzerinde yatay ve sıkı kalır. Dört adımlı müşteri akışı ve statik üç adımlı sunum mevcut semantik adım durumlarını korur; birbirinin ürünü gibi belgelenmez.

### Media stage / Upload workspace

Medya ve kaynak açıklaması aynı bağlamda kalır. Videoda native oynatma kontrolleri, gerçek poster ve mevcut kadraj kullanılır. Yükleme bölgesi hafif dolgu, kesikli çizgi ve tam genişlikte dosya eylemiyle kurulur. Statik mobil yardımcı alan mevcut gerçek posteri ve eylemi küçük bir ızgarada tutar. Koyu paneldeki açıklamayı veya kaynak hakkı bilgisini dekoratif üst yazıyla kapatma.

**The Media Truth Rule.** Örnek medyanın kaynak, tür ve hazır örnek açıklamasını medya ile birlikte tut; stil veya durum rengi üretim ve inceleme kanıtı değildir.

**The Focus Rule.** Klavye odağını seçim durumundan ayırt et; koyu panelde açık odak rengini, açık panelde kobalt odağı koru.

Stüdyo, vitrin ve statik kontrollerin odağı açık yüzeyde dış çizgidir (3px; kaydırma 4px). Koyu başlık/önizlemede açık mavi kullanılır; sergi, yan gezinme ve eski çalışma alanı kaynakta kendi açık mavi tonlarını taşır. Eski çalışma alanı çizgi kalınlığını mevcut tabandan devralır (2px). Tam değer ve bağlamlar sidecar focus uzantısındadır.

Ortak eylem geçişleri durum geri bildirimidir (150ms). Devralınan çalışma adımı ve medya girişleri kısa sürelerini korur (240ms ve 200ms); bunlar yeni sayfa açılış koreografisi için izin değildir. Hareket azaltma tercihinde süreler sıfırlanır, kaydırma auto olur. Sesli otomatik oynatma, sonsuz efekt veya otomatik 3D dönüş ekleme.

## Do's and Don'ts

### Do:

- Do mineral zemin, beyaz çalışma yüzeyi ve mürekkep medya yüzeyinin görevlerini koru.
- Do seçimi kobalt kenar veya tonla, klavye odağını ayrıca görünür çizgiyle göster.
- Do tenant eylem ve metin renklerini mevcut yetkili değişkenlerden al.
- Do Türkçe metni, medya açıklamalarını ve gerçek örneğin oranını okunur tut.
- Do mobil ve tablet yerleşimlerini kaynakta tanımlanan yapısal kırılmalarla kur.
- Do hareket azaltma tercihinde animasyon ve geçiş sürelerini sıfırla.

### Don't:

- Don't ana başlıklara eski dekoratif serif veya ayrı italik parça dilini geri taşı.
- Don't her bilgi grubunu aynı ağırlıkta iç içe kartlara veya süslü ikon kutularına dönüştür.
- Don't örneği bulunmayan hizmete ilgisiz bir sonuç görseli ekle.
- Don't kaynak veya inceleme durumunu gizleyerek hazır örneği müşterinin üretilmiş sonucu gibi sun.
- Don't ortak kobalt görünümü uğruna tenant marka verisini veya yetki akışını değiştir.
- Don't renk rampalarını, ekran görüntülerini veya yerel kontrolleri canlı üretim, insan kabulü ya da dağıtım kanıtı say.
