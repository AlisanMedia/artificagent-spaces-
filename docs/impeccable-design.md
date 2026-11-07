# Impeccable ile stüdyo düzenlemesi

Owner'ın 7 Kasım 2026 tarihli “Ekle ve kullan bizim projede tasarımı değişsin bunu kullanarak” talimatı mevcut arayüze uygulanır. Yeni uygulama, hizmet kataloğu veya sağlayıcı motoru kurulmaz.

## Sabit kaynak ve çalışma biçimi

- Kaynak: [pbakaus/impeccable](https://github.com/pbakaus/impeccable/tree/687bc381bc9091bf252c0a05303640561014a425).
- Skill sürümü: 4.8.0. Kaynak ref: `687bc381bc9091bf252c0a05303640561014a425`.
- Lisans: Apache-2.0; orijinal LICENSE proje içindeki skill klasöründe tutulur.
- Konum: `.agents/skills/impeccable/`. 47 orijinal Markdown/lisans dosyası byte-for-byte korunur. `UPSTREAM.json` kaynak Git blob SHA1, yerel SHA256 ve boyutlarını kaydeder.
- Bu kurulum **yalnız belge tabanlıdır**. Upstream'in “Launcher unavailable” akışı kullanılır. Başlatıcı/binary, installer, hook, global ajan ayarı, telemetri ve Live/Apply servisi eklenmez. Resmî otomatik detector **NOT_RUN**; mevcut uygulama testleri onun yerine geçmiş gibi sunulmaz.
- Projeye özel sınırlar `PROJECT_INTEGRATION.md`, `AGENTS.md`, `PRODUCT.md` ve `DESIGN.md` içindedir. Owner ve proje güvenlik kuralları önceliklidir. Upstream'de örneklenen komutlar dış hizmet veya binary çalıştırma yetkisi değildir.

## Uygulanan tasarım kararları

`layout`, `distill`, `operate` ve `craft-floor` yönergeleri mevcut ürüne göre uygulanır:

1. `/spaces` görev ekranıdır: kısa başlık, tek bir ilk-ekran yükleme eylemi, okunur adımlar ve daha az çevre kutusu. Hak onayı, özel upload, revision ve üretim durumları aynı kalır.
2. `/spaces/showcase` örnek alanıdır: gerçek MP4 daha büyük görünür; video çerçevesindeki ikinci dekoratif koyu kutu kaldırılır. Lisans, kaynak ve yerel kurgu açıklaması görünür kalır.
3. Tekrarlanan aynı boy kartlar yerine video için belirgin medya alanı, diğer hizmetler için sade gruplar kullanılır. Doğrulanmış örneği olmayan hizmete hayalî medya eklenmez.
4. Unicode/emoji hizmet simgeleri mevcut Lucide çizgi sistemiyle değiştirilir. Yeni bağımlılık kurulmaz.
5. Dekoratif üst etiketler, rastgele italik başlık parçaları ve tekrar eden sloganlar kaldırılır; ürünün gerçek bilgileri ve işlem adları korunur.
6. Mevcut fildişi/orman yeşili/Manrope kimliği korunur. Newsreader mevcut editoryal alanlarda kullanılmaya devam eder. Gövde harf aralıkları, başlık ölçüsü, yatay/dikey boşluk ve klavye odağı birlikte ele alınır.
7. Örnekler sayfasının skip bağlantısı yalnız klavye odağında görünür. Native picker, player, range slider ve mevcut 3D/360 kontrolleri korunur.

## Tekrar kullanma

İleride bir UI değişikliğinde önce mevcut `PRODUCT.md` ve `DESIGN.md` okunur. İlgili orijinal playbook seçilir; UI düzenlemesinden hemen önce `reference/craft-floor.md` okunur. Belge tabanlı fallback açıkça belirtilir; kurulu olmayan launcher/detector çalışmış sayılmaz. Yerel uygulama gerçek ekranlarda incelenir, mevcut testler çalıştırılır. Otomatik üçüncü taraf script kurulumu gerekmez.

```sh
npm ci --ignore-scripts
npm run dev
# Yalnız yerel cihaz: http://127.0.0.1:3000/spaces
# Müşteri örnekleri: http://127.0.0.1:3000/spaces/showcase
npm run check
npm run test:governance
npm run test:e2e
npm run golden:verify
npm run preview:build
npm run preview:test
```

Önce/sonra görüntüleri ve gerçek test sonuçları ayrı owner tesliminde tutulur; eski görsel kanıtlar değiştirilmez. Tarayıcıda çalışan yerel uygulama hosted URL veya Vercel deployment kanıtı değildir.

## Sınırlar ve geri alma

Bu arayüz değişikliği tenant/RLS, özel medya, kaynak/provenance, QA, bağımsız reviewer, release, ledger, kapalı API transport veya mevcut dar V01 test yetkisini değiştirmez. Ücretli çağrı/deployment/müşteri açılışı yapılmaz. Bağımsız GitHub incelemeleri ve Foundation acceptance zorunluluğu sürer. Resmî tasarım detector'ü, gerçek iPhone/Safari ve bağımsız emlakçı kabulü çalıştırılmadıkça NOT_VERIFIED/NOT_RUN kalır.

Geri alma yalnız yeni feature commit'inin normal `git revert` işlemiyle, ayrı güvenli dalda ve geçerli review/CI süreciyle yapılır; owner dosyaları önceden korunur. Main/parent dalları üzerinde reset, force-push veya history rewrite yapılmaz. Eklenen CSS importları ve UI düzenlemeleri tek kapsamlı değişiklikte izlenir; backend migration yoktur.
