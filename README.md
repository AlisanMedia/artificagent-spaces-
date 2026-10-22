# ArtificAgent Spaces — yerel ürün laboratuvarı

Owner V2.0 yetkisi: **22 Ekim 2026**. Phase 1B kapalıdır; P2–P12 için sürekli yerel/sentetik geliştirme yetkilidir. Harici bütçe **0 USD**. Mevcut canlı ArtificAgent ElevenLabs agent’ına dokunulmaz.

Bu sürüm gerçek PostgreSQL/PGlite RLS, özel dosya saklama, kalıcı işler, FFmpeg MP4, Blender GLB ve Three.js serbest gezinme, bağımsız yerel inceleme, mülk kapsamlı rehber simülasyonu, izinli analiz, white-label ve partner sınırlarını içerir. **Üretim auth’u, ücretli AI, ElevenLabs oturumu, ödeme veya deployment etkin değildir.**

## Çalıştırma

Gereksinimler: Node **24.19.0**, npm **11.9.0**, FFmpeg/ffprobe, Blender 4.x, Python 3, DejaVu Sans. Bu makinede FFmpeg **7.1.5** ve Blender **4.3.2** test edildi. CI kendi araç sürümünü loglar; platformlar arası bit eşitliği iddia edilmez.

```bash
npm ci --ignore-scripts
npm run dev
```

`http://127.0.0.1:3000/spaces` adresini açın. Sunucu yalnız loopback’e bağlanır; Host/Origin, HttpOnly/SameSite cookie, RLS ve scoped grant kontrolleri uygulanır. Local test kimliği seçimi gerçek müşteri girişi değildir.

1. **Studio • yönetici** ile oturumu açın; Atrium fixture’ını seçin veya sentetik mülk oluşturun.
2. Yeni mülke **Ölçülü sentetik fixture ekle**; hak onaylı JPEG/PNG/WebP özel alana yüklenebilir. Gerçek fotoğraf/adres/iletişim verisi kullanmayın.
3. Üretim stüdyosunda POV / Sinematik / Hibrit / Serbest 3D seçin, sanal teklifi gösterip işi başlatın.
4. **Studio • bağımsız incelemeci** kimliğine geçin; mülk/işi seçip gerçek çıktıyı kaynakla karşılaştırın, kalite kontrolleriyle onaylayın.
5. Yöneticiye dönün; onaylı dosyayı indirin veya **1 saatlik yerel tur bağlantısı** oluşturun. Bu internet yayını değildir.
6. 3D turda WASD/oklar, sürükle-bak ve dokunmatik yön tuşları kullanılabilir. Daypart sanatsal simülasyondur. Bilinmeyen oda ve duvar geçişleri engellenir.
7. Ayrı analiz/rehber/iletişim izinlerini seçin. “Salon kaç metrekare?”, “Mutfak kaç metrekare?”, “Mutfak odasına götür”, “Akşam ışığını göster”, “Balkona götür” sorularını deneyin.
8. Analiz, marka ve partner sekmelerini inceleyin. North/South ayrı partner fixture’larıdır; raw child medya/lead erişimi yoktur. `.localhost` alan adları fixture’dır, DNS doğrulaması yapılmamıştır.

Video çıktıları **gerçek H.264 MP4 kaynak-görsel hareket/kesme demolarıdır**; fotogerçekçi AI POV yürüyüşü değildir. 3D, **gerçek metrik parametrik GLB + serbest tarayıcı navigasyonudur**; panorama veya MP4 değildir. Pencereler/balkon/manzara uydurulmaz. JSON kamera planı yalnız plan olarak etiketlenir.

## Tek komutla gerçek dosya örneği

Uygulama çalışmıyorken (PGlite veri dizininin sahibi tek süreç olmalıdır):

```bash
npm run demo:local
```

Yeni organizasyon, mülk, özel plan/fotoğraf, dört iş, ikinci yerel incelemeci, onaylı dosya ve scoped rehber/analiz örneği oluşturur. Gerçek çıktılar `.spaces-local/demo-evidence/` altındadır. `measured-results.json` süre/hash/codec/boyut kanıtını; **özel** `session-links.json` kısa ömürlü tur linklerini tutar. Link/token/key dosyaları Git’e gönderilmez.

```bash
npm run build
npm run start
```

Uygulama açıkken ayrı terminalde `npm run worker:local` loopback CPU zamanlayıcısını çalıştırır; PGlite dizinini ikinci süreçte açmaz. `.spaces-local/` veya `SPACES_LOCAL_DATA_DIR` özel dizindir; backup için önce uygulamayı/scheduler’ı durdurun. Uygulama kapanınca arka planda iş çalıştığı iddia edilmez.

## Doğrulama

```bash
npm run lint
npm run typecheck
npm run test:coverage
npm run test:governance
npm run security:check
npm run security:audit
npm run licenses
npm run build
npx --no-install playwright install --with-deps chromium
npm run test:e2e
npm run security:secrets
```

Browser testleri desktop/mobile Chromium ve axe içerir; SwiftShader test renderer’ıdır, gerçek GPU kapasitesi kanıtı değildir. Safari/iOS ve canlı ses gecikmesi ayrıca test edilmelidir. Değişmeyen required context **Foundation acceptance**; PR, workflow_dispatch ve main push tetikleri vardır. Artifact yalnız şeması doğrulanan aggregate sayılardır; raw trace/ses/transcript/yayın token’ı yüklenmez.

## Belgeler ve sınırlar

- [Mimari](docs/architecture.md), [checkpoint](AUTONOMOUS_BUILD_STATUS.md), [backlog](docs/autonomous-backlog.md).
- [Sağlayıcı kanıtları](docs/provider-verification.md), [açılış ve rollback](docs/release-playbook.md).
- [Phase 1 README](docs/archive/phase-1-readme.md), [tarihsel mimari](docs/archive/phase-1-architecture.md). Eski ekranlar JSON-only foundation arşividir; çalışan platform `/spaces` altındadır.
- Gerçek cloud/paid API/GPU/customer-data/DPA/production/DNS/payment işlemleri `BLOCKED_EXTERNAL_APPROVAL` kalır. GitHub bağımsız review zorunludur; main’e doğrudan push/bypass yoktur.
