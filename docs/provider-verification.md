# Sağlayıcı doğrulaması — 22 Ekim 2026

Bu belge **resmî doküman HTTP GET** incelemesidir; hesapta model erişimi, haklar veya canlı kalite testi değildir. İstek, credential issuance, agent/workspace mutation, inference ve harcama yapılmadı. Tam URL/HTTP sonuç/hash dizini `provider-evidence.json` içindedir. HTTP 200 tek başına model/schema doğrulaması sayılmadı.

| Aday | Doğrulanan gerçek | Fiyat / limit | Açık kalan ve uygulama durumu |
|---|---|---|---|
| GPT-6 Astra | OpenAI models sayfasında `gpt-6-astra` | Standard text: input $10 / output $50, 1M token başına; cache/batch ayrı | Hesap/region/concurrency/retention/terms ve kör kalite benchmark UNKNOWN. Disabled. |
| GPT-6 Sol challenger | Güncel resmî katalog `gpt-6.1-sol` gösteriyor; eski `gpt-6-sol` yerine otomatik substitution yapılmaz | Standard text: input $2 / output $10, 1M token başına | Owner model politikası ve erişim doğrulaması gerekir. Disabled. |
| Claude Opus 5.5 | Anthropic model kataloğunda `claude-opus-5-5` | Base input $4 / output $20 / MTok; cache ve diğer hız/sunum yolları ayrı | Erişim, uzun context, effort, region, rate limit ve sözleşme account-specific; canlı benchmark yok. Disabled. |
| Kling O3 | Resmî developer SPA HTTP 200; okunabilir içerikte exact O3 API model ID/schema kanıtlanmadı | UNKNOWN | İç request portu/testi var, vendor wire schema NOT_VERIFIED. Payload veya yetenek uydurulmadı. Disabled. |
| Seedance 2.5 | BytePlus ModelArk genel video API sayfası okunabildi; exact 2.5 ID/erişim kanıtlanmadı | UNKNOWN | İç request portu/testi var; exact version/region/terms/pricing doğrulanmadan gönderim yok. Disabled. |
| Veo 3.1 | Google video dokümanı preview ID’lerini listeliyor ve **22 Ekim 2026 shutdown** uyarıyor | Bu preview rota için kullanılabilir fiyat/kapasite varsayılmadı | `veo-3.1-*-preview` yeni işlere bağlanmaz. Google’ın belirttiği `gemini-omni-1.1-flash` veya Enterprise GA yolu yalnız yeniden değerlendirme adayı; sessiz fallback yok. |
| Marble | World Labs World API `marble-1.1`, `marble-1.1-plus`; POST `/marble/v1/worlds:generate`, operations polling; GLB mesh veya PLY splat export dokümanı | $1 / 1250 kredi; minimum $5; 1500 kredi ($1.20) **world-generation bileşeni**, pano/variable/export diğer maliyetler ayrıca. Default yaklaşık 3 generation-start/dk ve 60/saat; concurrency garantisi değil | Request/export schema yerel contract testli. Benchmark/training/export/delivery hakları, region, retention ve gerçek kalite incelenmedi. **Auto-refill kapalı olsa da overage oluşabilir**; prepaid bakiye hard cap değildir. Disabled. |
| Atlas | İncelenen World API dokümanı genel Atlas API/rights kanıtı sağlamadı | UNKNOWN | R&D-only; adapter endpoint/model ID uydurulmadı. |
| ElevenLabs | OpenAPI ve React/auth/dynamic variables/client/server tools/post-call/RAG markdown dokümanları okundu. Pin `@elevenlabs/react@1.19.1`. Private WebSocket signed URL, WebRTC conversation token ayrımı doğrulandı | Gerçek agent-minute fiyatı, hesap concurrency/region/retention UNKNOWN. Genel TTS dakika reklamı agent fiyatı olarak kullanılmadı | SDK/request builder/HMAC/dedup local contract testli; gerçek credential endpoint **403 BLOCKED_EXTERNAL_APPROVAL**; canlı session/agent creation NOT_EXECUTED. |

Kaynaklar: [OpenAI models](https://platform.openai.com/docs/models), [OpenAI pricing](https://platform.openai.com/docs/pricing), [Anthropic models](https://platform.claude.com/docs/en/about-claude/models/overview), [Anthropic pricing](https://platform.claude.com/docs/en/about-claude/pricing), [Google video](https://ai.google.dev/gemini-api/docs/video), [World API](https://docs.worldlabs.ai/api), [World pricing](https://docs.worldlabs.ai/api/pricing), [World limits](https://docs.worldlabs.ai/api/rate-limits), [ElevenLabs OpenAPI](https://api.elevenlabs.io/openapi.json).

## ElevenLabs sözleşme ayrıntısı

Güncel endpoint **GET `/v1/convai/conversation/get-signed-url`**; underscore `/get_signed_url` OpenAPI’de deprecated. Header `xi-api-key` yalnız server secret manager’dan gelmelidir. Gerçek key veya agent ID yoktur; var olan ArtificAgent website agent’ı resource olarak kullanılmaz. `agent_syntheticfixture` yalnız unit-test sentinel’idir.

React SDK `ConversationProvider`, `useConversationControls`, `useConversationStatus`, private WebSocket `signedUrl`/`connectionType:'websocket'` ve `dynamicVariables` türleri ile derlenir. SDK bileşeni hiçbir canlı route’a mount edilmez; örnek/demo kimliği canlı bağlantı gibi gösterilmez. Dış bağlantı CSP’de de kapalıdır. US/EU-residency/IN-residency/global SDK location seçenekleri belgelenmiştir; bu hesabın bölge hakkı veya DPA onayı sayılmaz.

Property profile her mülk/manifest sürümüne ayrıdır; tek ortak template kullanılabilir. Dynamic variables sadece kişiselleştirmedir, authorization değildir. Secret `secret__` değişkenleri istemci/normal prompt’a taşınmamalıdır. Server facts scope’u publication + visitor + session’dan çözülür. Client tools yalnız doğrulanmış oda/POI/daypart/reset komutlarıdır.

Post-call webhook HMAC/timestamp + issued session map + dedup + minimum structured fields ile testlidir. Raw transcript/audio veya subjektif booking/revenue iddiası tutulmaz. Gerçek webhook endpoint’i/workspace ayarı açılmadı. Gerçek ücretli kullanım ancak fatura/usage uzlaştırmasıyla ölçülür; provider billable minutes şu anda NULL/UNKNOWN’dır.

## Değerlendirme matrisi ve deney protokolü

| Görev | Adaylar | Kör değerlendirme ölçütü | Bugünkü sonuç |
|---|---|---|---|
| Evidence/scene planning | Astra / Opus 5.5 / Sol challenger | ID doğruluğu, unknown refusal, E0/E1/E2, cross-tenant sızıntı=0 | Yerel validator/security testleri var; modeller arası benchmark NOT_EXECUTED |
| Automation | Opus / Astra + fixed local templates | Gerçek build exit/mesh scale/door adjacency; arbitrary code çalışmaması | Blender fixture build/geometri doğrulanır; LLM/Unreal quality UNKNOWN |
| POV | Kling O3 / Seedance 2.5 / yeniden doğrulanmış Google adayı | first-person eye-level, başka yürüyen insan olmaması, rota/fidelity/temporal defect | Yerel shot planner + image-motion MP4; photoreal inference NOT_EXECUTED |
| Cinematic / Hybrid | Seedance / Kling / Google adayı | kurgu/continuity, mimari sapma, kaynak/oda/ışık eşleşmesi | Gerçek FFmpeg baseline; vendor kalite/accepted-output maliyeti UNKNOWN |
| 3D | Parametric Blender / Marble / Atlas R&D | metrik hata/kapı/collision/unknown boundaries/free walk | Sentetik Blender/Three testli; gerçek daire rekonstrüksiyonu ve dış sağlayıcılar NOT_VERIFIED |
| Voice | Deterministic local / ElevenLabs | A→B facts leak=0, unknown measurement refusal, tool authorization, consent, measured latency | Yerel simulation/negatif testler var; live mouth-to-ear UNKNOWN |

Harici benchmark öncesi: hakları açık en az 12 sentetik/izinli sahne, 4 mod, iki oran, eksik/çelişkili plan senaryoları; aynı input hash/model revision/region/settings ve sabit spend rezervi. İki bağımsız değerlendirici, provider kimliği körlenmiş A/B sırası; kapı/pencere/manzara/oda icadı kritik red, ölçü uydurma red. Dosya codec/duration/geometry otomatik QA + timestamp bazlı insan inceleme. Kabul edilen çıktı başına inference + retry + GPU/CPU + storage + voice toplam maliyeti; kabul=0 ise cost/output NULL. Ekonomik kazanan kör benchmark olmadan ilan edilmez. World Labs benchmark/yayın hakkı owner/legal gate’tir. Şu an deney bütçesi 0 USD’dir.
