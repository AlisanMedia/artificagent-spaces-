# V5.4 yerel, sentetik kabul kanıtı

27 Ekim 2026. `after/` altındaki 13 stüdyo/mod ekranı ayrı capture komutuyla, iki review-held sonuç ekranı gerçek Chromium E2E ile üretildi. Yedi genişlikte yatay taşma yok; 390×844'te dosya seçici kullanılabilir. Dosyalar, özgün sentetik fixture/poster ve yerel MP4 dışında müşteri medyası içermez. Önceki ekran görüntüleri ve owner raporları değiştirilmedi.

Capture checkout HEAD'i `8fc1770aaad7f5bb9716d8e40247ad60b7fe5aeb`, `sourceDirty=true` idi: bunlar o eski sürümün ekranları **değildir**; aynı worktree'deki henüz commit edilmemiş V5.4 build'inin ekranlarıdır. Son kaynak bu kanıtları ekleyen feature commit'indedir. Metadata capture aracının checkout'unu kaydeder; ayrı server attestation/deployment kanıtı değildir. Eski sürümün before-ready ekranları ayrı owner tesliminde korunur.

`local-media-measurements.json`: gerçek ffprobe/tam-decode doğrulamalı 10/30/45/60sn nominal MP4, ayrı klip/source hash'leri ve yerel wall-time. Son kare/container süresi nominalden yaklaşık bir24fps kare kısadır ve ayrı kaydedilir. 640×360 veya360×640; 1080p/AI sağlayıcı çıktısı, fotogerçekçilik, ticari kabul veya kâr kanıtı değildir. Klip kaynağı farklı hash olsa bile farklı fiziksel açı doğrulanmış sayılmaz. QA fixture'ı müşteri release'i değildir.

Gerçek yerel komutlar: `npm run check`, `npm run test:governance`, `npm run security:audit`, `npm run sbom`, `npm run golden:verify`, `npm run lab:fixtures`, `npm run lab:video`, `npm run economics`, `npm run test:e2e`, `npm run preview:build`, `npm run preview:test`. Son geçerli sonuç: 251unit/integration,15governance,56app-browser,22static-preview; skip/fail/flaky0. İlk başarısız denemeler PASS sayılmaz; neden/düzeltme geçmişi owner raporundadır. Core coverage yalnız yapılandırılmış domain/application/fake modüllerini ölçer.

Test kimliğiyle ayrı inceleme gerçek bağımsız insan kabulü değildir. GitHub bağımsız reviewer/PR2–4 ve Foundation acceptance15368 koşulları korunur. Gerçek sağlayıcı/ElevenLabs/ödeme/hosted DB veya yeni Vercel deployment yok; harici bütçe0USD. Geçerli yeni-head hosted CI kanıtı ayrıca owner raporunda bulunur; eski run yeni sonuç gibi kullanılmaz.
