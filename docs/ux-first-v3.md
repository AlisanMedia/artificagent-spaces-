# UX-first V3 — uygulanan akış / 23 Ekim 2026

Owner V3 devam talimatı V2 yetkisini ve yasaklarını korur. PR #2/head db01ef3 korunur; V3 `build/ux-first-v3` üzerinden bu branch'e stacked PR'dır. Harici bütçe0; model/cloud/ElevenLabs/payments/deploy/DNS/real customer aktivasyonu yoktur.

## Müşterinin yolu

`/spaces`: tek güçlü **Mülk medyasını yükle** CTA → hak onaylı özel upload → üç video tarzı/şablon/format → oluştur → gerçek önizleme → farklı incelemeci → onaylı indirme/yerel paylaşım. İlk yüklemede yalnız oturumsuz yerel demo için hazır sentetik hesap kullanılır; var olan viewer/reviewer hesabı admin'e çevrilmez. Test kimlikleri yönetim alanındadır, gerçek auth değildir.

Oluştur / Projelerim / Paylaşımlar-Sonuçlar; `/spaces/manage` altında V2 yönetim araçları. 3D ikincil Premium/Beta, yalnız doğrulanmış metrik sahnede. Voice/facts/consent, analytics/lead, brands/partner, credits ve QA/V2 testleri kaldırılmadı. Role göre yönetim menüsü azaltılır; API/RLS her istekte ayrı enforce edilir.

## Teknik sınırlar

- `src/domain/media-intake.ts`: strict filename/MIME/size/revision; MOV/WebM veya sahte extension MIME eşleşmesi red. Filename private dosya yolu/komut/metadataya dönüşmez; token içinde saklanmaz.
- `/properties/:id/media-grant`: org/property/revision/session + MIME, gerçek byte sınırı, optional owned replacement ID ile 60 saniyelik HMAC grant. `/media-upload`: actual stream cap, Content-Type+byte match, hak onayı, güncel rol/revision, one-use asset ID. Tekrar grant yeni ID alır; eski nonce tekrarı DB tarafından engellenir.
- JPEG/PNG/WebP: eski gerçek magic/decode/pixel/EXIF-GPS temizliği korunur. Reddedilen karantina geçici orijinalleri de temizlenir.
- H.264 MP4: ftyp/brand, gerçek ffprobe, tek video ve yalnız opsiyonel AAC;20MiB,0.25–30s,≤60fps,≤1920 her eksen /2,073,600 piksel. ffmpeg file/pipe whitelist, dış referans/absolute path kapalı, allocation/pixel/threads/timeout caps, ses/subtitle/chapter/metadata çıkarma,24fps/≤720 normalize, yeniden ffprobe ve allowlisted tags. Private0700/0600; successful hash SHA256. Geçici video tüm sonuçlarda finally ile silinir; abort desteklenir. En fazla bir video normalization aynı anda; busy429/manual retry, paid auto fallback yok. Tam AV/OS sandbox veya codec CVE garantisi değildir; gerçek müşteri video/production yasaktır.
- `property_media_revisions`: tenant/property/revision/asset composite FK,forced RLS, immutable geçmiş. Sıralama/kaldırma/değiştirme yeni sürüm oluşturur. Yeni kaynak ekleme mevcut job ile donmuş sürümü fork eder; frozen trigger doğrudan append'i de reddeder. Replacement tek transaction'da olur; geçmiş nesne fiziksel silinmez. Kaynak grant'i güncel koleksiyona bağlıdır. Eski özel dosya/metadata/kota retention işi V2 açılış gate'lerinde kalır.
- Job transactional property lock + source snapshot + epoch/lease/outbox/virtual reserve korunur. Seçilen medya sırası snapshot'a bağlanır; source tamper/hash, role/tenant/revision/one-use testleri vardır.
- Gerçek FFmpeg MP4: normalize footage + photo pan/zoom, mode'a göre bounded hız/fade, şablona göre hafif renk/başlık, optionally tenant brand name + clean owned JPEG logo. Caption text file allowlist, shell/eval yok. Brand hash/snapshot output provenance'da tutulur. Kısa video süreyi tamamlamak için loop edebilir. Codec H264/yuv420p/BT709,640×360 veya360×640,4/8/16s. Müzik/voiceover yok.
- Creator preview grant sadece kendi awaiting-review çıktısı için edit yetkisiyle okunur; indirme/publication gate değildir. Ayrı review + all QA gates + current version hâlâ gerekir. Videoyu görmüş yetkili kişinin tarayıcıdan byte kaydetmesini teknik olarak önleme iddiası yoktur.

## Tasarım / varlık hakları

Kömür/near-black, sıcak açık yazı, deep green varsayılan CTA ve restrained warm accent. Tenant accent/foreground kontrastı server brand policy'den korunur. Responsive390/768/1280 ve eski ekranlar test kapsamındadır. Hak/yerel/sentetik etiketleri görünür; teknik veri kullanıcının ana eylemini işgal etmez. `studio-copy.ts` Türkçe copy boundary; tam İngilizce yerelleştirme henüz yoktur.

`public/spaces-examples/interior.svg` bu iş için özgün prosedürel çizimdir; gerçek ilan fotoğrafı veya oda rekonstrüksiyonu değildir. Üç örnek MP4 yalnız bu SVG'den actual local FFmpeg pipeline ile `npm run demo:ux` tarafından üretilir. Üçüncü taraf fotoğraf/müzik/voice/provider çağrısı yoktur. Mevcut repo lisansına tabidir; ilanın satılık mobilyası/manzarası gibi sunulmaz.

## İnceleme, CI ve geri dönüş

Foundation acceptance adı/app15368 ve Protect main25460908 değiştirilmez. Stacked PR base feature branch'idir; main ruleset'in bu feature branch'i de koruduğu iddia edilmez. V3'ü PR2 branch'ine merge ederek PR2 diff'ini büyütmeyin. PR2 gerçek approval/check sonrası main'e ordinary merge olursa V3'ü main'e retarget edin; gerekirse main'i V3'e **normal merge commit** ile alın, checks+independent approval yenilensin. Rebase/force/squash/bypass yok.

Main hiç değiştirilmediğinden mevcut rollback reviewable feature branch'te düzeltme/revert'tir. Yeni migration eski database'e uygulanmadan önce offline copy alın. DB+private objects+local signing key birlikte yeni boş dizine restore edilir. V2 kodunu V3'e upgrade olmuş DB üzerinde çalıştırmak media collection semantiğini kaybettirebilir; V2 dönüşünde pre-V3 yedeği ve eşleşen kod kullanın. Bu işte gerçek hosted schema/deployment/ödemeye dokunulmadı.

Kesin test/PR/CI/head ve sınırlamalar owner teslimi `SPACES_UX_FIRST_V3_REPORT.md` içindedir; bekleyen run veya skipped test PASS değildir.
