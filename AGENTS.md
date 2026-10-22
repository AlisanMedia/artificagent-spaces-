# ArtificAgent Spaces — yerel çalışma kuralları

Aktif yetki yalnız Phase 1 foundation kapsamıdır. Ayrı yazılı owner onayı olmadan Phase 2 veya başka faz başlatma.

- Yalnız yerel sentetik fixture ve deterministik fake adapter kullan.
- Gerçek auth, DB/migration, cloud/storage/queue/GPU, AI API, müşteri medyası, deploy/DNS ve ödeme bağlama.
- Remote repo, PR veya başka dış kaynak oluşturmak için ayrıca owner kapsamı gerekir.
- Domain’i React/Next ve adapter implementasyonlarından bağımsız tut.
- Strict TypeScript ve tam pinned sürümleri/lockfile’ı koru.
- Yerel ayar veya branch değişikliği yaparken kullanıcının dosyalarını silme.
- Anlamlı doğrulama: lint, typecheck, test coverage, security guard, build, browser/axe ve dependency audit.
- Her faz sonunda kanıt, sınırlamalar, risk, rollback ve owner kabulü içeren TEK Türkçe rapor teslim et; sonra dur.
