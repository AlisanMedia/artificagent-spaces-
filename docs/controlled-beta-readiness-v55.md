# Kontrollü beta — ayrı A / B / C kapıları

29 Ekim2026, uygulama planı; yayın veya müşteri yetkisi değildir. Güncel harici bütçe USD0. Bir secret/env tek başına inference açamaz; kod kilidi ve `maxCostMicroUsd:0` korunur. fal.ai Kling4/Seedance2.5US,WorldLabsMarble1.1Plus ve isteğe bağlıPedra stratejisi değişmez. Mevcut canlı ElevenLabs website agent'ı kapsam dışıdır.

## A — müşteri gösterimi (yerel)

- [x] Kamuya uygun sentetik kaynak registry'si, gerçekMP4/mesh/panorama gösterimi; ayrı ürün anlamları.
- [x] Dört adımlı yerel müşteri stüdyosu, kaydedilmiş özel kaynaklar, gerçek localjob/MP4 ve bağımsız release kapısı.
- [x] Bozuk/eksik/eşleşmeyen medyada kapalı durum; kaynak/provenance açıklamaları.
- [ ] Beş gerçek bağımsız emlakçıyla yardımsız görevler ve yanlış anlama değerlendirmesi.
- [ ] Fiziksel iPhone/Safari ve manuel ekran okuyucu testleri.

Test geçmesi insan kabulü değildir. Sentetik GLB ölçüleri gerçek konut ölçüsü, kaynak-görsel kurgu fotogerçekçiAI turu değildir.

## B — korumalı Preview (BLOCKED / bu talimatta deployment YOK)

Yalnız doğrulanmış ArtificAgent Spaces takımı ve dedicated preview proje gelecekteki hedeftir. Eski Gold kapsamındaki V5.3 adresi V5.5 yayını olarak sunulamaz. Mevcut billing verification kapısı çözülmeden başka takım/provider ile dolaşılamaz. Ayrı owner izni, ödeme yöntemi/ücret/borç/plan/overage ve trial sonrası durumun güvenli teyidi, gerçekUSDtavanı, kaynak SHA+statik buildSHA ve publicsafe allowlist gerekir. Sadece statik örnek;functions/auth/DB/API/tenantverisi/auto-main-production/DNS yok. Deployment koruması,READY/Preview,target,HTTPS,media/mobile/private-route kanıtı yeni run'da doğrulanır. Bugün yeni build yalnız loopback'te test edilir; arka plan yayını yoktur.

## C — yalnız davetli beta (BLOCKED_EXTERNAL_APPROVAL)

| Açılmamış kapı | Gerekli doğrulama / minimum karar |
|---|---|
| Bağımsız GitHub review | PR2–4 gerçek inceleme, Foundation acceptance, main ruleset25460908 ve normal merge; PR5/bypass yok |
| Hosted auth/session | Yetkili hesap/proje, gerçek auth, session rotation/revoke/role ve saldırı testleri |
| Hosted tenant DB / private storage | PostgreSQLforcedRLS/tenantFK/cache/storage negatifleri; region,backup/restore,retention;productionmigration ayrıca |
| Secure worker/queue | Container/OS isolation,AV,decoderCPU/RAM/disk/egress,lease/fencing/retry/cancel/backpressure ve restore/load |
| Provider transport | Account/model/schema/rights ve exact sentetik test; queue/callback/signature/replay/ambiguous acceptance ve private artifact ingestion |
| OEM/reseller/hak | Seçilen modeller için agency/end-user/white-label zinciri, attribution, trainingoptout, input/output rights yazılı hukuki kabul |
| Privacy | DPA/KVKK/GDPR,retention/deletion/residency, gerçekkaynak/media/lead transfer izni; legal reviewcertificationdeğil |
| Budget | Model/test/total hard cap, atomic authorized reserves, retry/overage controls; credential varlığı izin değil |
| Secrets | Serversecretmanager,keyrotation,webhooksignaturekey,tenantseparation; chateveGit'e değer konmaz |
| QA ve teslim | Gerçek providerbyte/codec/aspect/fidelity kontrolü; kaynak+herklipreview, farklıyetkilireviewer,release/revoke/expiry |
| Operations | Rate/abuse,redactedlogs,incidentplaybook,support/review kapasitesi,SLA'dan önce ölçüm, rollback/restoration |
| Ticari kalite / ekonomi | Gerçek hakları açık sağlayıcı testi ve insan kabulü; kabul edilençıktı maliyeti,retry/rejectionpaydası,labor/storage/bandwidth/payment varsayımları |

Canlı fiyat, accepted-output maliyeti ve kâr UNKNOWN/NULL kalır. Yeni paid benchmark, Vercel release, müşteri pilotu veya ödeme açma bu checklist ile yetkilendirilmez.

## Geri dönüş

ParentV5.4 branch/SHA değişmez. V5.5 yalnız yeni feature commit'leri ve ayrı worktree'dedir; önceki kaynağı ayrı bir worktree'de incelemek güvenlidir. İncelemeden sonra gerekirse yeni revert commit + gerçek bağımsız review/check gerekir; force/reset/rebase/squash/branchsilme yok. Private runtime'da yazma varsa önce app/scheduler durur,0700/0600 yeni backup alınır; userdosyası/ownerreport üzerine yazılmaz. Bu değişiklikte migration veya externalresource yoktur.
