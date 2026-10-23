# V5 izole statik ürün önizlemesi

V5.1 owner talimatı yalnız sentetik Vercel **Preview** yayınına izin verir. Production, gerçek kullanıcı backend'i, ücretli upgrade/inference ve Gold Revenue OS kapsam dışıdır. Doğru hesap/ekip/plan-kota/erişim doğrulanmadan `artificagent-spaces-preview` oluşturulmaz. Git bağlantısı eklenmez; böylece main push'u üretime çıkmaz. Varsayılan CLI scope'una güvenilmez; gerçek target/team/project bilgisi zorunludur.

## Çalışan yerel paket

```bash
npm ci --ignore-scripts
npm run golden:verify
npm run preview:build
npm run preview:serve
# başka terminalde:
npm run preview:test
```

Derleme `.spaces-local/preview-v5/build-*/.vercel/output` üretir. `latest-build.txt` son paketi gösterir; local test URL loopback3100'dür, owner'a live URL diye sunulmaz. Statik Build Output API v3; ayrı esbuild browser entry, source/build SHA ve manifest. Next API/auth/PGlite/server kodu dependency graph'ta yasaktır. Yalnız önceden gözden geçirilmiş Golden ve V3 public fixture adları, hash'ler ve türler kopyalanır; symlink/unknown file reddedilir. Runtime/private backups/env/node source map kopyalanmaz. Sıfır functions/cron/storage/SDK secret.

Oluştur → local dosya preview veya hazır örnekler → tarz/oran → **Örnek sonucu göster** → gerçek MP4 oynat/örneği indir. Projelerim ve Sonuçlar gerçekten gezinilir. Dosya MIME/header ipucu ve boyut sınırları var; bu sadece browser preview'dur, server ingestion kabulü değildir. Dosya bytes/isimler network veya kalıcı storage'a gönderilmez. Hazır örnek videonun ziyaretçinin dosyasından üretildiği söylenmez. Gerçek üretim, ödeme, paylaşım ve müşteri signup kapalıdır.

Golden Property plan/ölçü/oda görüntüleri ve ayrı Premium/Beta gerçek GLB/Three.js free-walk içerir. Aynı mevcut SceneViewer/collision/daypart/quality araçları kullanılır; video veya panorama 3D diye sunulmaz. Sesli rehber ve canlı ElevenLabs yoktur. Browser'ın Blob decoder'ı full OS media sandbox/AV diye pazarlanmaz; untrusted dosyalar server'a ulaşmaz.

CSP script self (eval/inline script yok), connect self yalnız statik model/asset, form-action/frame/object none; kamera/mikrofon/konum/payment kapalı; noindex/no-referrer/nosniff. `/api/*`, `/spaces/manage`, `/tour/*`, `.env`, `.git`, `.spaces-local` paket dışında ve404; local POST405. Vercel'deki gerçek HTTP kodları ancak deployment sonrası ölçülür. Public synthetic örnek indirmesi, private tenant download/reviewer kapısını değiştirmez.

## Gerçek yayın ve erişim kapısı

Vercel'in doğru ekip erişimi doğrulanır, var olan non-billable allowance/plan uygunluğu kontrol edilir. Gold Revenue OS hiçbir durumda hedef olamaz. Sahiplik belirsizse owner yalnız doğru ekip adını/onayını verir; şifre/token chat'ten istenmez. Vercel resmi giriş https://vercel.com/login ; OAuth bağlantısında yalnız doğru ArtificAgent ekibine proje/deployment erişimi verilmelidir. 403 team-scope hatası hesap/team authorization engelidir; app permission'ı full_access yapmak OAuth scope'u düzeltmez.

Yalnız izole output ile **Preview** oluşturulur; `--prod`, production promotion/domain/DNS veya Git auto-deploy yapılmaz. Vercel deployment protection varsa owner'ın Vercel login'iyle kullanılabilir hâli korunur, ücretli özellik eklenmez. Gerçek READY, environment, URL HTTPS/HTTP, exact kaynak/build hash, root/spaces ve forbidden paths, browser navigation/playback, desktop/mobile screenshot kontrolü yapılır. Korumalı URL login istiyorsa PROTECTED_OWNER_LOGIN ve doğrulanamayan testler açıkça raporlanır; bypass secret üretilmez/yayınlanmaz.

Yerel `SPACES_PREVIEW_URL=https://<gerçek-preview>.vercel.app npm run preview:test` aynı synthetic kontrolleri canlı URL'ye yönlendirir; yalnız doğrulanmış URL verilir, burada URL tahmin edilmez. Auth yoksa korunmuş sayfayı PASS saymayın.

Rollback: kaynak feature branch'inde normal düzeltme/revert, eski main/PR'lar değişmez. Bu görevde yeni V5 PR veya merge yok. Oluşturulmuş bir preview varsa yalnız yeni test projesinin ileriki preview sürümüyle geri dönülür; production/başka proje/branch silinmez. Gold Revenue OS ve canlı voice agent'a dokunulmaz.
