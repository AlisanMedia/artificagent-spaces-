# V5.3 — bağımsız kullanılabilirlik değerlendirme protokolü

Bu belge **hazırlıktır**. Beş gerçek emlak profesyoneli henüz çalışmaya katılmadı; başarı oranı, fiziksel iPhone/Safari sonucu ve bağımsız insan kabulü **NOT_VERIFIED**. Sentetik otomasyon gerçek katılımcı değildir. V5.2 görsel tasarımı kabul edilen başlangıçtır; V5.3 yalnız ayrı değerlendirme sayfası, sıkı kayıt sözleşmesi ve kanıt toplama akışı ekler.

## Amaç ve çalışma koşulu

Teknik bilgisi olmayan bir emlakçının yüklemeye başlayabilmesini, örnek video ve 3D turu açabilmesini ve hazır örneğin kendi dosyasından üretilmediğini anlayabilmesini ölçer. Araç; ekran/ses kaydı, üçüncü taraf analitik, işe alım, katılımcı kimliği doğrulama veya otomatik release sistemi değildir. Mevcut gerçek uygulamanın ayrı reviewer/QA kapısını değiştirmez.

Owner/moderatör geliştirme ekibinde olmayan beş emlak profesyoneli bulur. İsim/iletişim bilgisi bu projeye alınmaz; kayıtlar P01–P05 kodlarını kullanır. Kimlerin gerçekten ayrı ve bağımsız olduğunu moderatör özel süreçte doğrular; JSON'daki beyan bunu kanıtlamaz. Testten önce gönüllü katılım, istediği anda durma ve kayıt kapsamı açıklanır; gerçek müşteri dosyası kullanılmaz. Fiziksel cihaz testi yapılacaksa cihaz ve tarayıcı moderatör tarafından ayrıca gözlemlenir. Formun Safari seçeneği cihaz doğrulaması değildir.

Tüm katılımcılar aynı **temiz commit + build hash** üzerinde ilk denemelerini yapar. Kullanılan gerçek HTTPS URL, Preview ortamı ve build manifesti moderatörün özel çalışma kaydında bulunur; URL erişimi henüz sağlanmadıysa çalışma başlamaz. Loopback Chromium regresyonu owner'ın telefonundan erişilebilir yayın olarak sunulamaz. Farklı sürümlerin yanıtları birleştirilmez. Kaydedilmemiş kaynak değişikliği bulunan build'de gerçek bağımsız kayıt tamamlanamaz.

## Altı görev

Görevler ve eşikler uygulamanın `src/domain/usability-evaluation.ts` sözleşmesinden `/evaluation/protocol.json` içine üretilir. Aşağıdaki süreler ölçülmüş kullanıcı performansı veya üretim SLA'sı değil, önceden belirlenen test hedefidir.

| Sıra | Katılımcı görevi                              | Gözlenen bitiş                                                           | Süre hedefi |
| ---- | --------------------------------------------- | ------------------------------------------------------------------------ | ----------- |
| 1    | Yeni mülk için fotoğraf eklemeye başlayın     | Native seçici açılır; iptal edilir, gerçek dosya seçilmez                | 30 sn       |
| 2    | Kendi dosyanız yerine örnek mülkle devam edin | Hazır örnek seçilir ve tarz adımı açılır                                 | 60 sn       |
| 3    | Video tarzını ve yönünü seçin                 | Üç tarzdan biri ve dikey/yatay tercih yapılır                            | 60 sn       |
| 4    | Örnek videoyu açın ve izleyin                 | Gerçek MP4 oynar; yalnız poster görülmesi yeterli değildir               | 90 sn       |
| 5    | 3D mülkü gezin                                | Başka bilinen odaya gidilir, bakış ve gün zamanı değişir                 | 180 sn      |
| 6    | Önizlemede ne olduğunu açıklayın              | Son soruda hazır örnek / yeni üretim / emin değilim seçeneklerinden biri | 60 sn       |

Görev 1 yalnız başlangıcı ölçer. Cihazdan sentetik dosya seçme/kaldırma/sıralama/hata durumları ayrıca otomasyonla doğrulanır; bu protokol gerçek dosya upload'u veya bulut üretimi vaat etmez. İstenirse ayrı bir ikinci denemede verilen sentetik PNG seçilebilir; ilk deneme sonucu bununla değiştirilmez.

Moderatör görevi bir kez tarafsız okur; hangi butona basılacağını söylemez. Form ayrı sekmede açılır; görev başlamadan süre başlatılır, gerçek bitişte durdurulur. Tek seferlik monoton tarayıcı sayacı kullanılır. Sekme askıya alınır, ölçüm unutulur veya süre güvenilir değilse değer NULL bırakılır; uydurulmaz. Bir saati aşan sayaç sonucu ölçüm sayılmaz. Süre tek başına başarı atamaz. Yardım verilirse SUCCESS_ASSISTED, başarısızsa FAILED, denenmediyse NOT_ATTEMPTED kaydedilir. 1–5 kolaylık ve kapalı sorun kategorileri isteğe bağlıdır; serbest yorum alanı özellikle yoktur. Son sorunun cevabı önceden söylenmez.

## Karar kuralı

- Her görev için 5 kaydın en az 4'ü yardımsız ve süre hedefi içinde olmalıdır. Ölçülmeyen süre bu eşiği geçirmez.
- Hazır videonun kendi seçtiği dosyadan üretilmediğini **5/5** kişinin anlaması zorunludur. Yanlış veya emin değilim yanıtı kritik yanlış anlama olarak kalır; yüksek ortalama bunu örtemez.
- Beş tamamlanmış bağımsız/profesyonel beyan, gönüllü export onayı ve aynı temiz kaynak gereklidir. Eksik kayıtlarla başarı oranı/kabul çıkarılmaz.
- Sentetik prova ve otomasyon kayıtları gerçek insan paydasından dışlanır. Aynı P01 kodu iki kez, farklı commit veya fazladan alan/kişi bilgisi reddedilir.
- Beş beyan eşiği geçse dahi sonuç yalnız **READY_FOR_MODERATOR_REVIEW** olur. `independentHumanAcceptance` ve gerçek Safari her zaman NOT_VERIFIED kalır; gerçek moderatör incelemesi ayrı kanıttır. Otomatik release yoktur.

## Mahremiyet, consent ve saklama

`/evaluation/` tamamen statik ve ayrı bundle'dır. Form yalnız sekme RAM'inde tutulur; POST, API, çerez, localStorage, telemetry veya ses kaydı yoktur. Alanlar kod, sürüm, görev/süre, kapalı kategori, cihaz/tarayıcı beyanı ve gönüllü export onayıdır. İsim, özgün dosya adı, adres, e-posta, telefon, IP/fingerprint, ses, raw transcript veya serbest metin tutulmaz. Pseudonymous kodun kişinin kimliğiyle eşlenmesi varsa kayıt anonim sayılmaz; eşleme bu repoda tutulmaz. Bu teknik kapsam hukuki KVKK/GDPR uygunluk kararı değildir.

JSON yalnız açık indirme onayıyla cihazda oluşturulur. Onay geri çekilince form/sayaç temizlenir; daha önce indirilen dosyaların cihazdan da silinmesi gerekir. Yenileme tüm girilen yanıtları siler. İndirme sonrası owner'ın onaylı özel kanalı kullanılmalıdır; gerçek yanıtları PUBLIC Git/PR/CI artifactine eklemeyin. Teklif edilen saklama süresi 14 gün; owner/moderatör uygun özel saklama/erişim ve silme sürecini çalışma öncesi belirler. Form herhangi bir veriyi uzaktan saklamaz/silemez. Otomatik sunucu silme veya şifreleme garantisi yoktur.

## Tekrar üretme

```bash
npm run preview:build
npm run preview:serve
# Yalnız loopback: /spaces/ ve /evaluation/; internet yayını değildir.
npm run usability:prepare
# Çıktıdaki özel packet yolunu kullanın; hazırlanmış kayıtlar DRAFT ve NULL'dır.
npm run usability:summarize -- --input .spaces-local/usability-v53/packet-XXXXXX/responses
```

Son komutta `packet-XXXXXX` gerçek prepare çıktısı ile değiştirilir. CLI yalnız `.spaces-local` içinde en fazla beş, <=32 KiB, allowlist P01–P05 JSON dosyasını okur; sembolik dosya/klasör, kaynak uyuşmazlığı, kişi alanı ve duplicate reddedilir. Varsayılan kaynak gerçek HEAD'dir. İndirilen kayıtlar bu özel klasöre elle konur; backend veya ortak bir veri deposu bağlanmaz. Kodun doğru olması dosyaları dolduranların gerçekten beş ayrı insan olduğunu göstermez.

`npm run preview:test` consent/temizleme, NULL başlangıç, kapalı alanlar, klavye, reduced-motion, yedi genişlikte overflow/axe, medyanın oynatılması, 3D ve kapalı API sınırını denetler. Test-only sayaç ve başarılı sentetik yanıtlar **SYNTHETIC_REHEARSAL** olarak işaretlidir; raporda gerçek insan sonucu kullanılmaz. CI sadece iki browser suite'in aggregate sayısını yayınlar, yanıt/transcript/screenshot yüklemez.

## Yayın ve owner aksiyonu

Vercel yalnız doğru owner-controlled ArtificAgent team'inde, mevcut non-billable allowance doğrulanınca, `artificagent-spaces-preview` adlı izole PREVIEW olarak mümkündür. Gold ve owner'ın reddettiği diğer çalışma alanları kullanılmaz. Production, domain/DNS, main auto-production, DB/functions/test-auth/private grants/live providers/payments kapalıdır. Doğru team hedefi/erişimi engellenirse static build korunur; URL veya katılımcı sonucu icat edilmez.

Görsel sürüm dondurma kanıtı: `node scripts/capture-studio-evidence.mjs --v53` yalnız yeni `.spaces-local/v53/visual-evidence/` altında 35 sentetik stüdyo ekranı ve üç koşullu mobil lab ölçümü üretir. Eski V5.2 ekranlarını değiştirmez. Sonuçlar çalıştırılmadan PASS sayılmaz.
