# Hizmet kapakları ve gerçek örnekler — 29 Ekim 2026

Owner'ın “pencere kapağı hizmetin sonucunu anlatmıyor” geri bildirimi üzerine V5.5'in ayrı `build/v5-5-service-media` devam branch'i. Tüm önceki kaynak/model/video ve owner raporları korunur. Yeni müşteri, provider veya deployment yetkisi değildir.

- Video kartı yalnız görsel değildir: yerinde oynatılabilen, mevcut `buildOutput`/private sanitizer ile üretilmiş gerçek nominal5sn/640×360 H.264MP4 kullanır. Aynı dosya Premium Sinematik galerisinde açılır; dört tarzın kaynak/poster/output bağı ayrı tutulur. Yapılan şey kaynak fotoğraftan hafif hareket/kurgu; canlı fal/Kling/Seedance veya fotogerçekçi kamera yürüyüşü değildir.
- Kaynaklar Poly Haven **Brown Photostudio 04** (Sergej Majboroda) ve **Modern Buildings 2** (Alexander Scholten) CC0 fotoğraf panoramalarıdır. Resmî API dosya boyutu/MD5 ve indirilen SHA256 karşılaştırıldı; lisans sayfası ticari kullanım/yeniden dağıtıma izin verdiğini açıkça belirtir. `fixtures/showcase-v55/public-rights.json` kaynak/hak/datum/hash kanıtını taşır. Bunlar gerçek müşteri dosyaları değildir; orijinal adres/GPS/metadata aktarılmaz, normalize edilmiş yerel örnekler sunulur. Hiçbiri platformda canlı AI ile üretilmiş gibi sunulmaz.
- 3D kapağı aynı açılabilen Golden GLB'nin yeni sabit isometrik render'ıdır; pencere yakın planı kaldırılır. Geometri/furnishing/kapı/pencere eklenmez. Bu örnek hâlâ sentetik, mobilyasız CAD; gerçek fotoğraftan kaliteli Marble rekonstrüksiyonu gösterilmiş sayılmaz.
- 360° kapağı ve viewer aynı gerçek 2:1 CC0 fotoğraf panoramasına bağlıdır. Kaynak oda ile3Dtasarımın aynı konut olduğu söylenmez; her spatial sample kendi property/source/output kapsamını doğrular. Tek nokta/oda geçişi yok; Pedra hosted bağlantısı veya AI üretimi değildir.

İndirilmiş ham JPEG'ler yalnız `.spaces-local/service-media-inputs` altında kalır (her biri≤48MB, tam SHA kilitli; kaynakdecode≤200Mpixel). Public dosyalar kaynakJPEG≤1280×720, panorama2048×1024, temizlenmiş metadata, bounded boyut/hash ile doğrulanır. Fotoğrafın perspektifi gerçek küresel projeksiyondan çıkarılır; panoramayı sıradan fotoğrafa 360ikonu koyarak taklit etmez. Movie kaynakları aynı sanitizer'dan geçer; özel runtime dosyaları geçici dizinde tutulup temizlenir. Uygulamanın synthetic-only müşteri intake kilidi genişletilmez: CC0 istisnası yalnız küratörlü kamuya uygun örneklere aittir.

`scripts/build-service-media.ts` yalnız önceden doğrulanmış sabit yerel girdilerle offline authoring yapar; ağ/secret/modelAPI içermez. `scripts/service-model-cover.py` mevcutGLB'den yeni kamera render'ıdır. `npm run showcase:verify` yeni lisans-kaynak ilişkilerini ve önceki medyayı birlikte denetler. `legacy-asset-hashes.json`, V5.5/3ee6c59'daki18eski varlığın byte'larını kilitler. Yeniden üretimde codec/Blender sürümü bit eşitliği garanti etmez; commitli hash/decode kapısı esastır.

## Yayın sınırı

Doğru ArtificAgent Spaces takımına erişim var; önceki proje/yayın listesi boştur. Yeni salt okunur billing kontrolünde geçmiş ücret kaydı okunabildi; bu, yeni yayın için enforceable zero-spend garantisi değildir. Payment method, açık invoices, trial sonrası yükümlülük ve sıfır harcama sınırı bu metadata ile doğrulanamıyor. Hesap/fatura ayrıntıları PUBLIC Git'e yazılmaz; ayrı owner kanıtında kalır. CLI auth/token yok; gizli değer talep edilmedi. Uydurma adres, farklı takım, plan değişikliği veya yeni deployment yapılmaz. Önceki no-deployment/billing kapısı korunur; bu geliştirmede harici harcamaUSD0.

## Açık kalite boşluğu

Yeni örnek “daha iyi kaynakla bugün çalışan yerel kurgu neye benzer?” sorusunu gerçekten yanıtlar. Ticari AI kalitesi, gerçek müşteri sonucunun aynı çıkacağı, provider/OEM/DPA hakları, bağımsız insan kabulü ve kârlılık kanıtlanmış değildir. Canlı AI kalitesi için ayrı bütçeli/izinli/provider-specific test gerekir; stock veya başka ürün videosuyla bu boşluk saklanmaz.
