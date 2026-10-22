# ArtificAgent Spaces · Phase 1

Yerelde çalışan, tamamı sentetik verili Next.js + TypeScript foundation. Premium monochrome dashboard, dört yaratıcı modun UI akışı ve deterministik plan önizlemesi içerir.

**Bu uygulama bir ürün demosudur.** Kimlik doğrulama, gerçek tenant güvenliği, veritabanı, object storage, gerçek AI, video/3D üretimi, worker, ödeme veya deployment içermez. Gerçek mülk/müşteri verisi yüklemeyin. Phase 2 ve sonraki fazlar ayrı yazılı owner onayı gerektirir.

## Yerelde çalıştırma

Node.js **24.19.0**, npm **11.9.0** kullanın. Ek API key veya çevre değişkeni gerekmez.

~~~sh
npm ci --ignore-scripts
npm run dev
~~~

Tarayıcı: http://127.0.0.1:3000

Build edilen uygulama:

~~~sh
npm run build
npm run start
~~~

Sunucu yalnız loopback adresine bağlanır. Next telemetrisi runner tarafından kapatılır. Harici font/görsel kaynağı yoktur; tarayıcıdaki uygulama istekleri aynı origin ile sınırlıdır. Paket indirme ve npm advisory sorguları, kurulum/denetim sırasında ağ gerektirir; uygulama hiçbir AI API’sine bağlanmaz.

## Dört akış

| Mod | Yerel ayarlar | Gerçek teslim |
| --- | --- | --- |
| POV | Süre, oran, kamera temposu | JSON storyboard |
| Cinematic | Süre, oran, anlatım, altyazı alanı | JSON storyboard |
| Hybrid | Süre, oran, POV/sinematik dengesi | JSON storyboard |
| Interactive 3D | Detay planı, aydınlatma başlangıcı, ölçülü plan kontrolü | JSON sahne planı |

MP4, gerçek geometri veya gezilebilir 3D oluşturulmaz. Üç adımlı wizard ve sonuç görünümü yalnız akışı gösterir. Planlar bu sekmenin React belleğinde kalır, yenilemede sıfırlanır. İndirme, kullanıcının açık eylemiyle sentetik JSON dosyası oluşturur.

## Ekranlar

- / — dashboard, koleksiyon, mod seçimi ve örnek durumlar.
- /properties — arama, kategori, kart/liste görünümü.
- /properties/atrium — kaynak galerisi, örnek plan ve oda anotasyonları.
- /studio — dört modun ayar/inceleme/önizleme akışı.
- /library — sentetik görseller ve planlar; dosya yükleme yok.
- /activity — bu oturumdaki yerel planlar ve aşama görünümü.
- /reviews — checkbox kapılı, kalıcı olmayan yerel insan incelemesi.
- /settings — hareket tercihi ve demo reset.

İki örnek çalışma alanı arasında seçim yapılabilir. Bu, fixture filtresidir; bir yetkilendirme veya RLS uygulaması değildir. Tüm fixture’lar herkese açık istemci paketindedir.

## Kontroller

~~~sh
npm run lint
npm run typecheck
npm run test:coverage
npm run security:check
npm run build
npm run security:audit
npm run licenses
~~~

Birlikte lint/types/coverage/static guard/build:

~~~sh
npm run check
~~~

Browser testleri build edilmiş uygulamayı başlatır:

~~~sh
npx --no-install playwright install chromium
npm run test:e2e
~~~

Hazır sistem Chromium kullanılıyorsa PLAYWRIGHT_CHROMIUM_EXECUTABLE ile binary yolu seçilebilir. Bu ortamda /usr/bin/chromium kullanıldı. Gerçek Safari/Firefox testleri uygulanmadı.

Playwright desktop/mobile Chromium profilleri; dört mod, kanıt eksikliği, dosya diyaloğu, klavye, modal focus, 320px taşma, örnek scope filtresi, JSON indirme ve axe WCAG A/AA kontrollerini kapsar. Otomatik axe taraması tam erişilebilirlik sertifikası değildir.

## Bağımlılık ve güvenlik disiplini

Doğrudan bağımlılıklar tam sürümlüdür; package-lock.json transitive sürümleri ve integrity değerlerini kilitler. Lifecycle script’leri .npmrc ile kapalıdır. Node/npm dosyaları ve CI sabit sürüm kullanır. npm ci kilidi değiştirmeden kurulumu tekrarlar.

ESLint 10, TypeScript ESLint ve React Hooks kuralları kullanılır. Sonuçta yamasız braces bağımlılığı getiren framework lint eklentisi bulunmaz. Framework/domain sınırları ek static guard ve gerçek browser testleriyle kontrol edilir. npm audit verisi zamana bağlıdır; CI her çalışmada yeniden sorgular.

CSP aynı origin’e izin verir; object/frame/media ve cihaz yetkileri kapalıdır. Statik Next hydration için script/style unsafe-inline istisnası vardır. Bu üretim seviyesinde strict CSP değildir; gerçek auth/servis/ingestion öncesinde yeniden tasarlanmalıdır. Bu fazın kontrolleri gerçek tenant izolasyonu, pentest veya üretim uygunluğu kanıtlamaz.

## Mimari

~~~text
app → features / components → composition
                             ├─ application → domain / contracts
                             └─ adapters/fake → fixtures
~~~

Domain React/Next veya implementasyonlara bağımlı değildir. Application gerçek SDK çağırmaz. composition/local-runtime.ts yalnız iki stateless fake adapter bağlar. Private storage, provider routing, durable workflow ve GPU scheduler yalnız interface olarak tanımlıdır; implementasyonları yoktur.

Tasarım kararları ve sonraki fazın uygulanmamış güvenlik/veri planı docs/architecture.md içindedir. Faz sonu sonuçları tek PHASE_1_FOUNDATION_ACCEPTANCE_REPORT.md dosyasında teslim edilir.

## Git ve PR sınırı

Başlangıç çalışma alanında geçerli repo veya remote yoktu. Bu klasör yerel main baseline ve phase-1/foundation inceleme branch’iyle oluşturuldu. Remote/hosted repository/PR/branch protection oluşturulmadı; GitHub CI dosyası yalnız yapılandırmadır ve hosted ortamda çalıştırılmış sayılmaz.

Yetkili bir remote daha sonra sağlanırsa owner’ın repository admin’i gerekli status check’i ve review/branch protection’ı etkinleştirmelidir. Mevcut teslim yalnız Phase 1 owner kabulünü ister.
