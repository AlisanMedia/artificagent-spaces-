# V5.8 — yalnız V01 sağlayıcı yolu

30 Ekim 2026. Baz `1cecf225b0912a6112b9046f4afe1ab9763b4d49`; uygulama yeniden kurulmadı. Yeni hizmet/katalog/dashboard/tasarım yoktur. Gerçek model testi ve veri aktarımı yapılmadı; harici yetki USD0. Vercel bu yerel entegrasyonun önkoşulu değildir ve deployment yapılmaz.

## Uygulanan bağlantı

Mevcut private upload → V01 production request → mevcut jobs tablosunda `fal-v01` işi → tek submit → kalıcı sağlayıcı kimliği → bounded sunucu status/result GET → server-side MP4 alımı → ayrı1080p QA → özel depoda dosya → mevcut proje/reviewer ekranı → onaylı60sn indirme grant'i.

- Submit: `POST https://queue.fal.run/kling/v4/image-to-video`.
- Status: `GET https://queue.fal.run/kling/v4/requests/{id}/status`.
- Result: `GET https://queue.fal.run/kling/v4/requests/{id}`.
- Güncel [queue belgesi](https://fal.ai/docs/documentation/model-apis/inference/queue) owner/app kökünü önerir; modelin OpenAPI snapshot'ı tam endpoint yolunu da listeler. Bu fark kayda alındı: dönen status/result URL çifti yalnız aynı fal host/model/task kapsamındaki bu iki belgeli biçimle eşleşirse saklanır ve kullanılır. URL yoksa genel rehber kökü kullanılır; keyfi URL izleme veya ücretli yeniden submit yapılmaz. Submit receipt içinde status alanı zorunlu değildir. Mevcut diğer disabled builder'lar bu işte açılmaz.
- [Seçili Kling belgesi](https://fal.ai/models/kling/v4/image-to-video/api) Base64 data URI kabul ettiğini açıkça belirtir. EXIF/GPS temizlenmiş tek JPEG, yalnız hash/tenant/property/revision izni doğrulandıktan sonra server HTTPS JSON içinde aktarılır. Public kaynak URL'si veya kullanıcı grant'ini uzatma yoktur. Gönderim penceresi en fazla120sn; sağlayıcının sonraki saklaması farklı bir onay/retention koşuludur, dosya otomatik silinmiş sayılmaz.
- Prompt mevcut `video.natural.v1` sunucu profilinden gelir; serbest prompt, negatif-prompt alanı, model seçimi veya fallback yoktur.

## Dar ve doğrulanan yetki

Mevcut genel provider lock ve sentetik `maxCostMicroUsd:0` değişmedi. V01 için farklı bir sunucu güven sınırı vardır: trusted approver public key + Ed25519 imzalı, kısa ömürlü, immutable scope'lu test izni. Anahtar/env flag tek başına yetki değildir. Şu anda operasyonel canlı izin belgesi ve gerçek sağlayıcı anahtarı yoktur.

İzin; V01/model/profile, tek kaynak SHA ve tenant/property/revision,4 veya8sn, en-boy, en fazla3istek, poll/wall/transfer limitleri, kaynak/çıktı byte kapları, doğrulanmış fiyat kaydı ve her iş/toplam maliyet tavanını taşır. Hesap erişimi, hak/retention ve provider hardcap/overage incelemesi ayrı imzalı attestasyonlardır; kod bunların yerine hesap sözleşmesi icat etmez. Uygulama istemcisi izin oluşturamaz/değiştiremez. Canlı anahtar yalnız server secret yönetiminden `FAL_KEY` sınırında okunur; client/URL/log'a konmaz.

`v01_permit_usage` ve `v01_runs` içindeki count/cap rezervasyonu atomiktir. Bilinmeyen kabulde rezerv ve actual cost NULL korunur; sahte refund veya yeniden ücretli submit yoktur. Eski demo ledger'ına gerçek para yazılmaz.

## Kalıcılık ve hata davranışı

`READY → SUBMITTING → QUEUED → RESULT → INGRESS → REVIEW`; ayrıca `HOLD_UNKNOWN / REJECTED / CANCELLED`.

SUBMITTING, ağ çağrısından **önce** kaydedilir. Timeout veya bu noktadaki süreç kaybı, otomatik ikinciPOST değil HOLD_UNKNOWN üretir. Receipt kimliği kalıcı kaydedilir; reboot aynı job/request'i okur. Claim/fence/lease duplicate işleri ve geç iptal sonucunu durdurur. Poll sayısı/deadline/süre aralığı DB'dedir; GET yeniden denemeleri sınırlandırılmıştır. Verilen response URL'leri körlemesine izlenmez. İptal provider refund'ı sayılmaz.

Belirsiz kimlik uzlaştırması admin rolüne ek olarak farklı, kısa ömürlü, job/source/providerID bağlı imzalı reconciliation kanıtı ister; ardından authenticated status GET ile task doğrulanır. Başka mülkün rastgele taskID'si atanamaz. Gerçek billing ölçümü yoksa actual cost NULL kalır. İzin/deadline bittiğinde otomatik genişletme yoktur; yeni dış yetki olmadan iş bekler.

İlk yerel sürümde proje ekranı mevcut API üzerinden server poll adımlarını tetikler. Sekme kapalıyken bağımsız always-on hosted scheduler çalıştığı iddia edilmez; sayfa yeniden açılınca kalıcı işten devam edilir. Yerel disk PGlite'a aynı anda ikinci process worker bağlanmaz. Webhook ilk kabul için gerekli değildir; hosted scheduler bu yerel testi açmak için şart koşulmaz.

## Ayrı1080p çıktı ve mevcut teslim

1920×1080 veya1080×1920,4/8sn toleranslı süre, H264/yuv420p/SDR, tek video stream, byte/fps sınırı. Raw byte magic + bounded/protocol-restricted ffprobe; metadata remux **copy only**, ölçekleme/360p/720p fallback yoktur. Full decode, blank/freeze/frame/provenance kontrolleri ve SHA tekrar çalışır. Başarısız dosya teslim edilmez. Native kaynak ayrıntısı veya semantik yapı sadakati ölçülmüş sayılmaz.

Sonuç provider URL'sinden indirilip0600 private MP4'e alınır. Source/revision/fence commit anında tekrar denetlenir. Proje ekranı kaynağı, gerçek video adayını ve bağımsız inceleme durumunu birlikte gösterir. Final grant, çıktı SHA'sına da bağlanır; source değişimi/iptal/eski session erişimi reddedilir. V01 public publish server ve UI'de kapalıdır.

Offline testte farklı sentetik reviewer kimliği akış kapısını doğrular; gerçek insan kabulü değildir. **Gerçek provider modunda** local demo reviewer kimliğine geçmek yeterli değildir: farklı trusted reviewer key ile job/source/output/reviewer/revision bağlı imzalı insan inceleme kanıtı gerekir. Creator kendi çıktısını onaylayamaz. Key provisioning ve gerçek insan değerlendirmesi henüz yapılmadı; sohbete private key istenmez.

## Tekrarlanabilir offline uygulama deneyi

```bash
npm ci --ignore-scripts
npm run check
npm run test:governance
npm run test:e2e
npm run test:v01
npm run preview:build
npm run preview:test
```

Elle test için build sonrası `npm run v01:offline -- --serve`. Bu komut taze private/sentetik DB, izinli Golden kaynak, açıkça yerel üretilmiş1080p fixture ve **sadece offline** imza oluşturur. Key ve raw izinler console/Git'e yazılmaz. Loopback3008 açılır. Mevcut yerel demo hesabında Projelerim → V01 sentetik örnek → Tarzını seç → Offline V01 akışını dene. İkinci açılış mevcut işi sürdürür. Gerçek fal ağına veya secret'ına başvurmaz. Server Ctrl+C ile durdurulur; önceki private runtime/owner dosyaları silinmez.

Test fixture video, kaynak fotoğraftan mevcut yerel kurgu aracılığıyla hazırlanmış upscaled sentetik örnektir. Gerçek Kling görüntüsü veya native1080p ayrıntı iddiası değildir. Offline gateway gerçek gateway yerine yalnız imzalı fixture modunda seçilir; uygulamadaki production/job/ingress/QA/review/download kodu aynıdır. HTTP kodu ayrıca tamamen intercepted ağ testleriyle doğrulanır.

## Gerçek testin açık kapıları

Resmî public model sayfasında30Ekim1080p liste fiyatı0.235USD/sn görüldü:4sn için yalnız model bedeli0.94USD. Hesap erişimi, vergiler, başarısız/iptal ücretleri, minimumlar ve enforceable global cap doğrulanmadı; bu bir toplam maliyet garantisi veya bütçe onayı değildir. [Dated snapshot](../fixtures/v01-v58/public-price-observation.json).

Gerçek testten önce tek tabloda: seçili modelin hesap erişimi; server secret/approver/reviewer güven yapılandırması; sentetik test kaynağı ve veri-saklama koşulları; güncel hesap fiyatı ve en yüksek finansal risk; net istek/süre/üstlimit owner izni; kalan teknik doğrulama. Bunlar yokken gerçek çağrı yapılmaz. Commercial reseller/OEM/customer/hosted-auth/KMS/AV/OS-sandbox/load/privacy/deployment kapıları bu yerel entegrasyonun tamamlanmasıyla kapanmaz.

Rollback: uygulamayı durdur, private runtime'ı koru; V5.7 bazını ayrı worktree ve ayrı eski veri dizininde çalıştır. Yeni migration'lı DB'ye eski kodu bağlama. Force/reset/rebase/branch silme veya destructive SQL yoktur. Main/parent review politikaları ve önceki raporlar aynen korunur.


## Özel runtime derleme sınırı

V5.8 kontrolünde Next.js'in dinamik local runtime yolunu trace listesine kattığı görüldü; gerçek deployment yapılmadı. `.spaces-local` glob'u açıkça exclude edilir, runtime path bundler'ın statik dosya keşfinden ayrılır ve her `npm run build` sonrası `scripts/verify-private-build.mjs` gerçek `.nft.json` listelerini tarar. Private runtime veya secret-env referansı varsa build FAIL olur. Bu önlem worker/OS sandbox veya üretim deployment onayı değildir.
