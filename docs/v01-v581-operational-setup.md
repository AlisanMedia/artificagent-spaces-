# V5.8.1 — mevcut tek V01 testinin operasyonel kurulumu

7 Kasım 2026. Bu, yeni ürün/servis veya yeni bütçe talebi değildir. Mevcut [owner kaydı](v01-v581-owner-authorization.json) geçerlidir: V01 / `kling/v4/image-to-video` / `video.natural.v1`, tek tanımlı sentetik kaynak, **1 ücretli submit, 4 saniye, 16:9, 1920×1080 hedefi, toplam ek mali yük ≤10 USD**. Diğer hizmet, deployment, müşteri kullanımı, abonelik, otomatik yükleme ve model fallback kapalıdır.

## Doğru runtime ve gizli giriş

Bu görev **ChatGPT managed Cloud Environment** içinde yürütülür; kişisel bilgisayardaki CLI veya Vercel değildir. Gözlenen ortamda secret/outbound-identity bağlantısı yoktur; kaynak ortam yapılandırması da bağlı değildir. Mevcut araçlar yalnız ortam durumunu okuyabiliyor. Ortam arayüzü secret bağlantısı sunuyorsa **Environment settings** içinde, **uygulamanın gerçekten çalışacağı bu ortama** server-only `FAL_KEY` bağlanmalıdır. Başka ortamda/Vercel'de tanımlanmış anahtar bu sürece kendiliğinden ulaşmaz. Secret değeri sohbete, komut argümanına, Git'e veya ekran görüntüsüne yazılmaz.

Arayüz bağlantısı yoksa yetkili owner/operatörün **aynı runtime terminalinde** kullanabileceği tamamlanmış alternatif:

```bash
cd /workspace/artificagent-spaces-v581
npm run v01:operator -- status
npm run v01:operator -- setup
```

`setup`, isimli yetkili operatör ve mevcut owner kurulum yetkisinin referansını ister. Ayrı **KURULUMU ONAYLIYORUM** girişi yalnız operasyonel anahtar/güven kurulumu içindir; 10 USD bütçesini yeniden onaylatmaz. Ortamda uygun secret yoksa FAL_KEY **echo kapalı terminal girişinde** alınır. Shell history/argv/log kullanılmaz. Yeni Ed25519 anahtar yalnız bu açık kurulum adımı ve public fingerprint'in operatörce elle sabitlenmesi üzerine oluşturulur. Bu komutun bir isim/fingerprint alması, kişinin owner kimliğini veya hesap erişimini bağımsız doğruladığı anlamına gelmez; terminale erişen kişinin gerçekten yetkilendirilmesi owner/operatör sorumluluğudur. Agent bu görevin parçası olarak operasyonel anahtar oluşturmaz veya kendisini owner ilan etmez.

Dosyalar varsayılan olarak operatörün kullanıcı dizinindeki `.local/share/artificagent-spaces-v01-operator/` altında, Git ve uygulama dışında, 0700 dizin/0600 dosya olarak tutulur. Farklı güvenli konum için `SPACES_V01_OPERATOR_HOME` kullanılabilir; herhangi bir Git deposunun içinde olamaz. Özel signer dosyası uygulama yapılandırmasına verilmez. App yalnız public verification key dosyasını ve server-secret dosyasını alır. Bu yerel dosya izinleri OS sandbox/KMS yerine geçmez; aynı işletim sistemi kullanıcısından ayrı bir güvenlik alanı oldukları iddia edilmez.

Mevcut trusted public key varsa **üzerine yazılmaz**. Onunla eşleşen, zaten güvenli yerde tutulan signer dosyasının yolu `setup` komutunun isteğe bağlı ikinci argümanıdır; private key içeriği hiçbir argümana yazılmaz. Eşleşme yoksa işlem reddedilir. Offline fixture imzaları operasyonel owner kanıtı olarak kullanılmaz.

`FAL_KEY_FILE` ve `SPACES_V01_APPROVER_PUBLIC_KEY_FILE` mutlak, gerçek, owner'a ait, 0600 dosyalardır; symlink, fazla byte, çakışan env/file veya private key'in public verifier olarak verilmesi reddedilir. Uygulama süreci proxy ve CA ayarlarını aynen devralır. TLS doğrulaması, HTTPS proxy veya ağ secret mekanizması atlanmaz. Anahtarın bulunması model erişimi kanıtı değildir.

## Hesap kontrolü: ücretsiz GET; üretim sondası yok

```bash
npm run v01:operator -- account
```

Yalnız belgeli `GET https://api.fal.ai/v1/models/pricing?endpoint_id=kling%2Fv4%2Fimage-to-video` ve `GET https://api.fal.ai/v1/account/billing?expand=credits` kullanılır. Yanıtlar özel operatör dizinine kaydedilir; console hesabı/bakiyeyi/secret'ı göstermez. İstekler sabit allowlist, proxy/CA, yönlendirmesiz, en çok512KiB/30sn ve otomatik retry olmadan yapılır. Bu GET'ler ücretli inference değildir. Rol/scope nedeniyle403 gelmesi modelin erişime kapalı olduğunu kanıtlamaz.

**Standart hesapta Enterprise endpoint zorunlu değildir.** Yalnız halihazırda model-access-controls yetkisi bulunan hesapta isteğe bağlı `account --existing-enterprise-report` bu raporu okuyabilir. Enterprise yükseltmesi/abonelik istenmez. Rapor tek başına early-access istisnasını veya toplam mali tavanı kanıtlamaz; gerçek içerik incelenir.

7 Kasım salt-okunur public kontrolünde [Kling lansmanı](https://fal.ai/kling-4) hâlâ **“API access coming soon”**, Playground/Agent kullanılabilir diyor. [Endpoint OpenAPI](https://fal.ai/api/openapi/queue/openapi.json?endpoint_id=kling/v4/image-to-video) mevcut, 4sn/1080p alanları uyumlu; ikisi de **hesaba özel entitlement değildir**. Ücretsiz hesap okuması kesin teyit vermezse minimum destek talebi:

> Mevcut hesabımız `kling/v4/image-to-video` queue API'sine gerçekten submit yapabilir mi (Playground değil)? Tek hakları açık sentetik JPEG'i inline data URI ile,4sn/1080p olarak göndermek istiyoruz. Bu hesap için endpoint enablement/early-access durumunu; model/başarısız iş/partner retry/fallback/tax/fee/minimum ve overage dâhil tek istek toplam ek mali yükünün10USD'yi aşmayacağını; bu tek kaynağa uygulanacak işleme ve saklama koşullarını teyit edin. Enterprise yükseltmesi veya yeni abonelik istemiyoruz.

Resmî belgeler: [account access](https://fal.ai/docs/platform-apis/v1/account/model-access-controls.md), [billing](https://fal.ai/docs/platform-apis/v1/account/billing.md), [account pricing](https://fal.ai/docs/platform-apis/v1/models/pricing.md), [retry/fallback](https://fal.ai/docs/documentation/model-apis/inference/reliability.md), [retention](https://fal.ai/docs/documentation/model-apis/media-expiration.md). Fiyat GET'indeki baz birim fiyatı,1080p katsayısı/tax/failed-job/overage dâhil bir hesap teklifi değildir. `X-Fal-No-Retry` ve fallback kapatma başlıkları da mali garanti değildir. Yeni kredi satın alınmaz, kart/auto-refill eklenmez.

## Gerçek kanıttan kısa izin; aynı uygulamadan tek submit

`setup` yalnız mevcut runtime/property/upload kodundan orijinal Golden fotoğrafı özel depoya alır, temiz kaynak hash'ini doğrular ve immutable property/revision/asset bağını kaydeder. FFmpeg örnek çıktı üretmez, production request veya inference başlatmaz. Mevcut runtime verisi üzerine yazılmaz. Yarım kalmış kaynağı tamamlamak için `prepare` vardır; mevcut veri uyuşmuyorsa otomatik temizleme yoktur.

Operatör dizinindeki `evidence-template.json` **NOT_VERIFIED/null/false** olarak oluşturulur. Gerçek hesap erişimi, tek sentetik kaynak için rights/transfer/retention ve **hesaba uygulanacak toplam ek mali tavan** güvenli özel belgelerden doğrulanır. Şablon yalnız bu inceleme sonrası doldurulur; hesap referansı hash, belgeler özel mutlak dosya yolu+SHA256 ile bağlanır. İçeriği public Git'e koymayın. İmzalama gerçek belgenin hukuki/mali doğruluğunu otomatik ispatlamaz; yetkili operatör doğrulanmamış alanı `true` yapamaz.

```bash
npm run v01:operator -- issue /private/operator/evidence.json
npm run v01:operator -- serve
```

`issue`: exact source/model/profile/owner record, aynı operatör, en çok24saatlik kanıt, dosya hash/izinleri, gerçek pozitif fiyat ve all-in ≤10USD, yeni satın alma0 doğrulanmadan imzalamaz. İzin **tek submit /4sn /16:9**, en çok15dk geçerli; ilk submit en çok120sn içinde, en çok60poll/5sn,5MiB kaynak/50MiB çıktı sınırındadır. Private signer yalnız operatör komutunda okunur; uygulama public key ile doğrular. Stable yetki kimliği ve kalıcı `issued-once.json`, restart/tekrar komut/izin dosyası kaybında yeni bütçe yaratılmasını önler. Marker silme, yeni dizinle ikinci test veya expired permit'i otomatik yenileme yoktur. Süre dolduysa mevcut iş ve kanıt korunarak inceleme/uzlaştırma gerekir.

`serve`, mevcut Next.js uygulamasını yalnız loopback3008'de çalıştırır. `/spaces` → mevcut onaylı sentetik mülk → tek onaylı fotoğraf → Doğal Tur sağlayıcı testi panelindeki **İzinli V01 testini başlat** yolu kullanılır. Bu eylem mevcut production request/job/durable submit/status/result/MP4 ingress1080pQA/private proje ekranına gider. Ağ belirsizliğinde ikinciPOST yoktur; aynı request ID ile sürdürme/uzlaştırma vardır. Müşteri beta veya Vercel yayınını açmaz. Sadece anahtar veya flag ile başka hizmet açılamaz.

Gerçek bağımsız reviewer yoksa üretim önkoşulu yapılmaz; dosya private **awaiting-review** durumunda kalır, final indirme/public share açılmaz. Ayrı reviewer imzası ve gerçek insan incelemesi, operatör test izninden bağımsızdır.

## Geri dönüş

Yerel server'ı durdurun; özel runtime, signer, issued-once ve request ID kanıtlarını koruyun. Eski kod için ayrı worktree ve ayrı veri dizini kullanın. Yeni migration'lı DB'yi eski kodla açmayın. Existing trust/permit marker'ı silmeyin, eski owner raporlarını değiştirmeyin. Main/PR2–4/ruleset/check, diğer sağlayıcılar ve canlı ElevenLabs değişmez. Bu kurulum ticari/production güvenliği, gerçek insan kabulü veya başarılı AI üretimi iddiası değildir.
