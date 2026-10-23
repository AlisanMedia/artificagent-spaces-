# V4 bağımsız inceleme devri

Bu task'ta **hiçbir PR merge edilmeyecek**. V4, `b1eb3acc7dbe8084d9d48cd00ddfe64dc9b9b510` üzerine, `build/v4-output-readiness` → `build/ux-first-v3` stacked PR'dır. Main ve PR2/PR3 branch'leri değiştirilmez. Main ruleset25460908'in feature base'e de uygulandığı iddia edilmez. Son exact HEAD/PR/CI/review kanıtı tek owner raporu/checkpoint/PR body'sinde yer alır; eski başarılı koşu güncel approval değildir.

## İnceleme önceliği

1. `media-capabilities`, `mp4-preflight`, API/storage/properties/video-ingestion: tek limit kaynağı, client hints'in authorization olmaması; HEIC/MOV/HEVC/HDR/4K reddi ve taslak/rol/revizyon/grant koruması.
2. `media`, `captions`, `video-quality`: Pango markup escape, gerçek safe bitmap, kaynak boyunca motion; argv/time/allocation/thread/file boyutu; tam decode, bağımsız source hash/ID, negative gates. `prlimit` toplam OS sandbox değildir; lab adayları kullanıcıdan çağrılamaz.
3. `video-generation`, `provider-readiness`, local fake ve Runway-disabled: scope/version/evidence, UNKNOWN price/spend0, unknown-submission hold, idempotency/cancel/fencing, injected byte verifier; gerçek vendor transport/secret/egress yok. Harness durable production ledger diye sunulmaz.
4. `studio-funnel`, UI/preflight: opt-in memory-only512event, PII/filename/property payload yok, org switch/opt-out/reset; başlık/frame içeriklerinin ticari sonuç diye sayılmaması. Mevcut QA/3D/voice/analytics/partner/white-label/RLS survival.
5. `unit-economics`, configs/scripts/evidence: NULL maliyet/human acceptance, gözlem-varsayım ayrımı, retries/review denominator, hipotez paket/komisyon/60% hedef; yanlış kâr veya native1080 iddiası yok.

## Review için çalıştırma

```bash
npm ci --ignore-scripts
npm run lint
npm run typecheck
npm run test:coverage
npm run test:governance
npm run security:check
npm run security:audit
npm run sbom
npm run lab:fixtures
npm run lab:video
npm run economics
npm run benchmark:plan
npm run build
SPACES_LOCAL_DATA_DIR=/tmp/spaces-v4-review CI=1 npm run test:e2e
npm run security:secrets
node --use-env-proxy scripts/verify-repository.mjs
```

Loopback sentetik demo; gerçek müşteri medyası/credential kullanmayın. Bağımsız reviewer tam MP4'leri kaynaklarıyla izler; `review-scorecard.json` NULL alanları doldurur. Assistant frame-only notları insan/GitHub approval değildir. 720p/15sn ve1080p/30sn failures/NOT_IMPLEMENTED, test skip/PASS sayılamaz. Bunlar UI/API'ye açılmamıştır. Hosted artifact yalnız schema-allowlisted aggregate JSON'dur, raw trace/media/key yoktur.

V4 owner talimatı gerçek onay bulunsa bile bu task'ta merge'i yasaklar. Daha sonraki yazılı görevde parent'lar gerçekten korunarak main'e merge edildiyse history rewrite olmadan retarget + gerekirse ordinary main merge commit + fresh CI/independent review gerekir. PR'ları birbirinin feature branch'ine merge ederek üst PR diff'ini büyütmeyin. Source HEAD/required context ve gerçek kurallar her seferinde yeniden okunur; force/rebase/squash/bypass/direct-main/branch-delete yok.

Rollback: V4 unmerged ise main/PR2/PR3 zaten baseline'dadır. Düzeltme/revert yeni commit/PR ile; migration eklenmedi, eski SQL edit/drop yok. Yerel DB/objects/signing material için önce süreçleri düzenli durdur, orijinali koruyarak offline yeni private dizine backup/restore; key Git'e girmez. Eski kod/yükseltilmiş DB karışımıyla restore denemeyin; eşleşen snapshot kullanın. Owner raporları ve eski screenshots hash'leri korunur.
