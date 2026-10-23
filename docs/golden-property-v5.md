# Golden Property V5 — kaynak, geometri ve inceleme

23 Ekim 2026. Gerçek ev veya müşteri verisi içermez. Kaynak CAD, mesh/render ve model değerlendirmesinden **önce** proje için yazılmış sentetik ground truth'tur; bağımsız insan ölçümü veya LLM çıkarımı değildir. Kaynak `fixtures/golden-v5/source.json`, SHA256 `ff04bf1b34623655d6c7161c616ee63abb632fe4db90279b50d67ce0a9364731`. Değişen kaynak sessiz kabul edilmez.

## Ölçülü kapsam

| Alan | Boyut | Tasarım alanı |
|---|---|---|
| Giriş | 3 × 2 m | 6 m² |
| Koridor | 1.6 × 8 m | 12.8 m² |
| Salon | 5.4 × 4.2 m | 22.68 m² |
| Mutfak | 3.4 × 3.8 m | 12.92 m² |
| Yatak odası | 4 × 6 m | 24 m² |

Toplam 78.4 m² oda iç tasarım toplamıdır; gerçek konut brüt/net alanı değildir. Yükseklik 2.8 m, göz seviyesi 1.65 m; açık tavan kesiti. Dört iç kapı koridora bağlanır, üç dış duvar penceresi vardır. Balkon, dış manzara, tesisat, gerçek güneş kalibrasyonu, mobilya/obje etkileşimi, mülkiyet ve fiyat yoktur. Pencere görmek modellenmiş çevreyi doğrulamaz.

Ölçü tanımı: oda dikdörtgenleri ve plan sınırları duvar eksenleridir; mesh duvar kalınlığı0.12m bu sınırların iki yanına taşar. 78.4m² toplamı duvar izlerini düşmeyen CAD dikdörtgen toplamıdır, bitmiş yüzeyler arası kullanılabilir net alan değildir. Gerçek ilan metrekare beyanına çevrilmez.

CAD'deki `x,z` yatay, `y` düşeydir; Blender `(x,-z,y)`, GLB Y-up dönüşümü kullanılır. Ayrı pencere sözleşmesi mevcut SceneManifest'i gevşetmez. Navigation yalnız SceneManifest'in E2 sentetik odaları/kapıları üzerinden çalışır. Kapı öncesi/sonrası dik yaklaşma noktaları ve kapıda yarım kalmış rotanın güvenli içeri yönlendirmesi vardır; duvar/yarıçap eşiği azaltılmadı. GLB yüklenmeden viewer ready vermez.

Yavaş renderer'da eski 0.05sn/frame hareket kesmesi rota hızını FPS'e bağlıyordu. `navigation-route.ts` geçen süreyi en fazla0.5sn alır, toplam en fazla0.7m'yi ≤0.07m segmentlerle **aynı** canMove kontrolünden geçirir; köşe/waypoint aşımı yoktur. Duran tab geri geldiğinde sınırsız sıçrama yoktur. 10/60FPS eşdeğerliği, stall sınırı, mid-door route ve duvar ret testleri vardır. İlk masaüstü preview koşularındaki timeout'lar PASS sayılmadı. Statik demo ayrıca açıkça hafif görüntü kalitesiyle başlar; mevcut yerel platformun varsayılan kalite seçimi değiştirilmez. SwiftShader FPS'si iPhone/Safari veya üretim GPU performansı değildir.

## Gerçek işlem hattı

```bash
npm run golden:build
npm run golden:verify
```

Allowlisted `scripts/golden-property.py`: Blender factory startup, autoexec kapalı, CPU Cycles 16 sample/seed51, iki thread, 640×360, AgX, denoising kapalı. Denoiser bu OS Blender build'inde desteklenmediğinden ilk render başarısız oldu; açıkça kapatılarak yeniden üretildi, fotogerçekçilik iddiası yapılmadı. CPU175 sn/address-space4GiB/wall200sn, tek dosya16MB/toplam24MB native sınırları vardır. Bu toplam OS/container sandbox değildir. Girdi Python/.blend veya uzak texture kabul edilmez. Renkler/roughness ve tek area light kaynakta/kodda sabittir; sanatsal aydınlatma fiziksel güneş değildir.

Beş sabit oda kamerası source position/target/FOV65/aspect16:9 içerir. Blender raycast üç aynı-oda pencere açıklığına kadar engel olmadığını kaydeder; TypeScript FOV ve oda bağı ayrıca kontrol edilir. Temsilî native projection matrix testi 65.00000390297737° ölçtü (65° hedef, 0.0001° tolerans). Bu görsel tanıma veya kör insan puanı değildir.

Ham Blender render hash'i ayrı, public PNG metadata'dan temizlenmiş hash'i ayrı kaydolur. İlk fixture testi EXIF'i yakaladı; test kaldırılmadı, Sharp ile metadata çıkarıldı ve yeniden üretildi. PNG'den normalize JPEG'in hash'i, room/asset eşlemesi ve sıralı video shot provenance'ı ayrıdır.

Gerçek local JobService/outbox/private storage/FFmpeg ile üç tarz × iki oran = altı 4 sn MP4; 640×360 veya 360×640. ffprobe ve tam decode yapılır. Bunlar source-motion kurgudur; AI yürüyüşü değildir. İşler **awaiting-review** durumunda kalır; farklı insan release gate'i otomatik geçilmez. Owner'ın izin verdiği public dosyalar yalnız sentetik fixture örnekleridir, tenant publication/download grant değildir.

`public/golden-v5/evidence.json`: kaynak/generator/render/media hash'leri, actual dimensions/duration/codec, kaynak oda/normalize hash, shot provenance ve gözlenen yerel wall time. Zaman tek yerel koşu gözlemidir, SLA/p95/production compute faturası değildir. Blender/codec sürümü değişirse piksel/byte eşitliği evrensel garanti değildir; commitlenmiş immutable dosyalar verify ile hashlenir.

## Olumsuz test ve insan kapısı

Oda boyutu/fact alanı drift, uydurma kapı/pencere, yanlış org/property/revision, balkon/manzara/etkileşim iddiaları, yanlış kamera/evidence, duvardan ve pencereden geçiş, olmayan oda rotası reddedilir. Gerçek GLB tüm beş floor bbox, kapı/pencere boşluğu, duvar doluluğu ve self-contained buffer ile test edilir. Her render ve altı MP4 gerçekten hash/probe/decode edilir.

`artifacts/golden-v5/blind-scorecards.json`: iki reviewer ve dokuz 0–5 boyut NULL. Koordinatör eşlemesi ayrı `coordinator-map.json`; reviewer sheet model/mode/dosya adını içermez. Koordinatör map'i değerlendiren kişiye verilmez; repo içeriğini bilen kişi kör reviewer sayılmamalıdır. Gelecekte gerçek provider klipleri için ayrı kör dosya adları/paylaşımı gerekir; bugün model inference yoktur.

Kritik uydurma mimari, ortalama puandan önce ret verir. İki farklı gerçek reviewer, creator'dan bağımsızlık, bütün skorların varlığı ve geçerli 0–5 sınırı gerekir. Önerilen en az3/her ölçüt ve ortalama4 eşiği hazırlık politikasıdır; ticari sonuç değil. Framework sonucu dahi normal server authorization/release gate yerine geçmez. Gerçek insan kabulü0, accepted output cost/margin UNKNOWN/NULL.
