# ArtificAgent Spaces — V2.0 çalışma yetkisi

Owner'ın **2026-10-22 AUTONOMOUS END-TO-END BUILD AUTHORIZATION V2.0** talimatı Phase 1B'yi kapatır; Phase 2–12 için yerel/sentetik geliştirmeyi sürekli yetkilendirir. Eski “Phase 1 only / her fazda onay” metinleri tarihsel kayıttır. Bu dosya yalnız `AlisanMedia/artificagent-spaces-` projesine uygulanır.

- Yerel uygulama, PostgreSQL/RLS migration kodu, private storage, FFmpeg/Blender, browser 3D, voice simülasyonu, analytics, white-label ve adversarial testleri uygulayıp bağımsız işlere devam et. Faz sınırında rutin onay isteme.
- `AUTONOMOUS_BUILD_STATUS.md` dosyasına base/head, milestone, gerçek komut/sonuç, PR/check, engel, next-command ve maliyeti kaydet. Nihai tek Türkçe teslim `SPACES_AUTONOMOUS_BUILD_REPORT.md`.
- **Harici bütçe USD 0.** Ücretli API/inference, GPU/cloud, satın alma/abonelik, gerçek ödeme, üretim deploy/DNS, gerçek müşteri verisinin üçüncü tarafa aktarılması ve credential/account gerektiren işlemler ayrı owner kararına tabidir. Ücretsiz deneme sınırsız kullanım izni değildir.
- Mevcut canlı **ArtificAgent | Voice Experience** ElevenLabs agent'ına dokunma: oluşturma/klonlama/değiştirme/rename/deploy yok. Yeni Spaces template ve kapalı provider adapter yalnız kod/fixture olarak hazırlanabilir. SDK ve doküman okumak canlı çağrı yetkisi değildir.
- Harici engeli `BLOCKED_EXTERNAL_APPROVAL` olarak kapsam, gerekçe, USD üst sınırı, privacy/terms ve minimum owner işlemiyle toplu bildir; bağımsız güvenli geliştirmeyi sürdür.
- Gerçek tenant izolasyonu server oturumu + güncel membership + RLS + composite tenant FK ile doğrulanır. İstemci tenant/property seçimi yetki değildir. Private asset/publication/voice grant'leri ayrı scope ve revocation kontrolleri gerektirir.
- Kaynak/çıktı gerçeği: E0 concept / E1 visual / E2 verified; JSON video değildir, panorama free-walk 3D değildir, parametric sentetik mesh gerçek daire rekonstrüksiyonu değildir. Çalışmayan integration'ı PASS/implemented diye gösterme.
- Strict TypeScript, modüler domain/port/server/UI sınırları ve exact pinned dependencies/lockfile korunur. Lint, types, unit/integration/RLS, browser/axe, security/audit/license, gerçek media/geometri doğrulaması gerekir.
- Yalnız feature branch ve korumalı PR. Main'e doğrudan push, force-push, rebase/squash/history rewrite, remote branch silme veya bypass yok. Ruleset **25460908**: Active main, boş bypass, PR + 1 bağımsız approval, stale dismissal, conversation resolution, strict up-to-date, merge only, deletion/force-push yasağı korunur.
- Required context **Foundation acceptance**, GitHub Actions integration **15368** sabit tutulur. PR + workflow_dispatch korunarak main push doğrulaması eklenebilir. Bağımsız review/check sağlanırsa ordinary merge commit önceden yetkilidir; aksi durumda PR'ı bekletip güvenli bağımsız işi sürdür.
- Kullanıcı dosyaları ve untracked raporları koru; değişiklik öncesi durum/hash ve gerektiğinde yedek al. Secret, raw transcript, özel adres/medya veya debug trace public Git/CI artifactine giremez.
- Phase 1B kabulü sonraki üretim harcaması/deployment/yasal onay yerine geçmez. Gerçek dış aksiyonlar dışında geliştirme için yeni faz onayı gerekmez.
