# V4 medya uyumluluğu ve sürtünme — 23 Ekim 2026

Tek kaynak: `src/domain/media-capabilities.ts`. API grant/metadata, property upload, photo normalizer ve gerçek ffprobe validator aynı limitleri okur. SQL'deki mevcut bytes/duration sınırları değiştirilmedi; değiştirmek gerekirse yeni migration ve adversarial test gerekir. Frontend tavsiyesi authorization veya gerçek decode değildir.

| Alan | Gerçek destek / sınır |
|---|---|
| Fotoğraf | JPEG/PNG/WebP, ≤5,242,880 byte, her kenar≥64, ≤24 milyon pixel, tek sayfa. Magic + MIME + gerçek Sharp decode, orientation normalize, EXIF/GPS/XMP çıkarma; uzun kenar≤1600 JPEG |
| Video | MP4 ftyp/brand + gerçek ffprobe; yalnız H.264, 8-bit yuv420p/yuvj420p SDR; 0.25–30 sn, ≤20,971,520 byte, ≤60 FPS, her kenar64–1920 ve toplam≤2,073,600 pixel |
| Stream | Bir video, opsiyonel bir AAC ses. Diğer ses codec'i, ikinci video, subtitle/data reddedilir. Kabul edilen ses de normalize sırasında silinir |
| Renk | BT.709 veya izin verilen 601 matrix / etiketsiz SDR. HDR/PQ/HLG/bt2020 ve 10-bit reddedilir. Etiketsiz görüntünün fiziksel renk kalibrasyonu UNKNOWN |
| Normalize | 24 FPS, uzun kenar≤720, even dimensions, yuv420p/BT.709, ≤8 MiB; re-probe ve metadata allowlist |
| Kota | UI12 dosya; property20 kayıt /50 MiB. Eski/reddedilmiş kayıtlar kotada kalır. Signed grant60 sn, org/property/revision/session/MIME/byte/replace scope ve tek-use ID |
| Export | 640×360 veya360×640 H.264 MP4;4/8/16 sn. Fotogerçekçi AI yürüyüşü değil. Yüksek çözünürlük/15–30 sn deneyleri lab-only |
| Desteklenmeyen | HEIC/HEIF, MOV/QuickTime, WebM, HEVC, ProRes, AV1, 4K, HDR/10-bit, PDF, keyfî URL, müşteri kodu ve ses/müzik ekleme |

## Seçimi kaybetmeden yönlendirme

Picker `image/*,video/*` ile biçimi **seçmeye** izin verir; bu, decoder kabul listesini genişletmez. HEIC/MOV/WebM ve boyut/isim/MIME uyuşmazlığı seçilen kartta korunur, yüklenemez diye işaretlenir. Supported kopya eklenebilir; orijinal kullanıcı dosyası silinmez. Blocked kartın Blob URL'si/thumbnail decoder'ı açılmaz; upload/grant/quote/job oluşmaz. Sadece desteklenen kartların hak onaylı yüklemesi yapılır.

≤20 MiB MP4'te sınırlı, derinlik/box sayısı kontrollü BMFF header ipuçları H.264 dışı sample entry, bazı HDR/10-bit profilleri ve 4K boyutu için ön uyarı verir. Eksik/aldatıcı veya SPS-only metadata bunlardan kaçabilir; **backend ffprobe/decoder her zaman son karardır**. Bu tarayıcı ön kontrolü güvenlik veya tam codec tespiti diye sunulmaz. Sunucu reddi de mevcut seçimi/taslağı korur, ücretli üretim rezervasyonu başlatmaz.

Türkçe yardım cihazda JPEG veya H.264 MP4/SDR/8-bit/≤1080p kopya dışa aktarmayı önerir. Yalnız dosya uzantısını değiştirmek işe yaramaz. Cihaz ayarı mevcut eski dosyaları dönüştürmez. Özel dosyalar çevrimiçi dönüştürücüye gönderilmez; gerçek iPhone/Safari cihazında bu dönüşüm yolu test edilmedi.

JPEG/PNG/WebP + gerçek MP4; abort/retry, replace/remove/reorder, draft restore, eski grant, yanlış tenant/property/revision ve viewer rolleri baseline/V3 + V4 testlerinde kalır. Yeni V4 browser tests JPEG/WebP/MP4 akışı ile HEIC/MOV/WebM/HEVC-header reddini, opt-out ve review-gated preview'ı ekler. Header testi gerçek HEVC decode testi değildir; ayrıca unit suite gerçek libx265 dosyasının backend reddini doğrular.

## Gizlilik odaklı yerel huni

`StudioFunnel` yalnız **isteğe bağlı**, memory-only, bu sekmeye ait sentetik UX gözlemidir. Varsayılan kapalıdır; cookie/localStorage/HTTP/third-party analytics yok. İzin kapanınca veya sayfa yenilenince sayılar silinir, org switch'te izin kapatılır. En fazla512 olay sayılır. Strict whitelist dışında alan reddedilir; dosya adı/byte/URL/kişi/property/customer ID, adres, ses/transcript ve fingerprint yoktur. `conversionUplift: null`.

Adımlar: studio_entered, picker_opened, selection_supported/unsupported, rights_accepted, upload_succeeded/failed, style_selected, quote_returned, job_started, preview_opened, review_pending, approval_observed, download_completed. UI'daki quote/job/preview/approval/download gözlemi ilgili same-origin yanıtı/durumu sonrasında sayılır; bu client aggregate **ticari veya güvenilir backend satış kaydı değildir**. Henüz onay yoksa approval/download uydurulmaz. Tekil insan, müşteri dönüşümü veya uplift ölçülmez. V2 tenant-scoped backend engagement/lead/CRM doğruluk modeli ve consent/withdrawal/retention ayrı korunur.

## Güvenli sonraki ingestion sırası

1. Bugün: cihazdaki güvenilir araçla desteklenen kopya; özel veri transferi yok. Hangi biçimde kaç sentetik seçim reddedildiği yerel gözlenebilir; gerçek churn/uplift oranı UNKNOWN.
2. HEIC/HEIF için ayrı codec/lisans/CVE incelemesi, yalnız allowlisted still-image decode ve metadata testi; worker sandbox/AV tamamlanmadan açılmaz.
3. MOV kapsayıcı + SDR HEVC için isolated native worker, measured caps, golden real-device fixtures ve ses/data/dref reddi; mevcut ffmpeg'in codec okuyabiliyor olması kabul izni değildir.
4. HDR/10-bit/4K için gerçek renk yönetimi/tone-map/resize, renk kartı ve cihaz doğrulaması; clipping/washed colors/referans kaybı ölçülmeli. Pazarlama için sessiz dönüştürme yok.

Tüm genişlemeler için ayrı UID/container veya VM, kapalı egress/read-only FS, toplam RSS/CPU/pixel/time/output/tmp quota, malware scan/quarantine, at-rest encryption/KMS, rights/privacy/retention, restore ve native codec patch politikası üretim ön koşuludur. Bugün bunların tamamlandığı iddia edilmez; gerçek müşteri verisi ve production kapalıdır.

V4 kalite düzeltmesi: fotoğraf çalışma kadrajı seçilen en-boy oranıyla eşleşir; içerik yalnız kırpılır, kare ara-kadrajdan sıkıştırılmaz. Gerçek encoded video içindeki sentetik daire şeklinin yatay/dikey piksel oranı regresyon testidir. Bildirilen square olmayan video sample-aspect-ratio reddedilir; etiketsiz/N/A kaynağın fiziksel kalibrasyonu UNKNOWN kalır.

`artifacts/ux-funnel-v4/` snapshot'ları gerçekten çalışan sentetik Playwright oturumundan alınmış test kanıtıdır: unsupported selection→0upload/quote/job, gerçek preview→review pending, opt-out→0sayı. Bunları geliştirme kanıtı olarak saklamak runtime telemetry değildir; kullanıcı uygulamasında sayıların HTTP/persistent storage yolu yoktur.
