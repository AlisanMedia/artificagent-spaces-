# Impeccable ile bütün görsel sistem

Owner'ın 7 Kasım 2026 tarihli son talimatı önceki küçük düzenlemeyi reddeder ve bütün grafik tasarımı Impeccable yaklaşımına devreder. Mevcut uygulamanın görsel dünyası değiştirilir; yeni uygulama, hizmet kataloğu veya sağlayıcı motoru kurulmaz. İlk düzenlemenin kaynak ve kanıtları önceki Git commit'lerinde/owner tesliminde korunur.

## Sabit kaynak ve çalışma biçimi

- Kaynak: [pbakaus/impeccable](https://github.com/pbakaus/impeccable/tree/687bc381bc9091bf252c0a05303640561014a425).
- Skill sürümü: 4.8.0. Kaynak ref: `687bc381bc9091bf252c0a05303640561014a425`.
- Lisans: Apache-2.0; orijinal LICENSE proje içindeki skill klasöründe tutulur.
- Konum: `.agents/skills/impeccable/`. 47 orijinal Markdown/lisans dosyası byte-for-byte korunur. `UPSTREAM.json` kaynak Git blob SHA1, yerel SHA256 ve boyutlarını kaydeder.
- Bu kurulum **yalnız belge tabanlıdır**. Upstream'in “Launcher unavailable” akışı kullanılır. Başlatıcı/binary, installer, hook, global ajan ayarı, telemetri ve Live/Apply servisi eklenmez. Resmî otomatik detector **NOT_RUN**; mevcut uygulama testleri onun yerine geçmiş gibi sunulmaz.
- Projeye özel sınırlar `PROJECT_INTEGRATION.md`, `AGENTS.md`, `PRODUCT.md` ve `DESIGN.md` içindedir. Owner ve proje güvenlik kuralları önceliklidir. Upstream'de örneklenen komutlar dış hizmet veya binary çalıştırma yetkisi değildir.

## Uygulanan tasarım kararları

`new-work`, `operate`, `craft-floor` ve son tasarım inceleme/dokümantasyon akışı mevcut ürüne göre uygulanır. Kod odaklı yön sözleşmesi `.impeccable/briefs/spaces-redesign.md` içindedir; kurulu olmayan resmî concept-seed/comp-diff çalışmış sayılmaz:

1. `/spaces` görev ekranıdır: masaüstünde koyu sol gezinim, yükleme çalışma alanı ve gerçek medya sahnesi yan yanadır. Mobilde gezinim üstte toplanır, tek dosya seçici ilk ekranda kalır. Ayrıntılı hizmetler ilk yükleme/önizleme alanının ardından gelir. Hak onayı, özel upload, revision ve üretim durumları aynı kalır.
2. `/spaces/showcase` açılışı artık çalışan galeridir: dekoratif hero videosu yerine tek gerçek MP4 oynatıcısı, ona bağlı kaynak fotoğraf ve video/3D/panorama seçimi vardır. Lisans, kaynak ve yerel kurgu açıklaması görünür kalır.
3. Üç doğrulanmış örnek medya alanı olarak gösterilir. Örneği olmayan hizmetler kompakt katalog satırlarıdır; hayalî medya veya başarı durumu eklenmez.
4. Unicode/emoji hizmet simgeleri mevcut Lucide çizgi sistemiyle değiştirilir. Yeni bağımlılık kurulmaz.
5. Dekoratif üst etiketler, rastgele italik başlık parçaları ve tekrar eden sloganlar kaldırılır; ürünün gerçek bilgileri ve işlem adları korunur.
6. Önceki fildişi/orman yeşili genel tema yerine mineral `#eef2f7`, mürekkep `#142433`, kobalt `#2849ce` ve mevcut lisanslı Manrope kullanılır. Tenant'ın yetkili `--ux-accent`/`--ux-accent-text` marka renkleri kendi eylemlerinde geçerlidir; örnek tenant'ın yeşil düğmesi bu yüzden korunabilir. Newsreader dosyaları uyumluluk için kalır, baskın başlık sesi değildir.
7. Örnekler sayfasının skip bağlantısı yalnız klavye odağında görünür. Native picker, player, range slider ve mevcut 3D/360 kontrolleri korunur.
8. Yönetim, eski çalışma alanı ve inceleme bekleyen sonuç aynı yüzey/renk/tipografi sistemini kullanır. İzole statik önizlemede de aynı CSS yüklenir; yeni backend veya dış bağlantı eklenmez.
9. Yeni dünya, önceki konuşmayı devralmayan ayrı tasarım incelemecisine gerçek ekranlarla gönderilir. Bu ajan incelemesi GitHub bağımsız insan approval'ı veya emlakçı kullanılabilirlik kabulü değildir. Sonuç ve düzeltmeler ayrı owner kanıtında kaydedilir. `DESIGN.md` ve `.impeccable/design.json` çalışan kaynaklardan güncellenir.

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
