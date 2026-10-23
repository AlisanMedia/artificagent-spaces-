# V4 birim ekonomi, operasyon ve paket hipotezleri

**Bugün kârlılık kanıtlanmadı.** Yerel komutların dış servis harcaması0USD; gerçek işlemci/elektrik/işçilik/şirket gideri sıfır denmez. Bağımsız insan tarafından kabul edilmiş gerçek provider çıktısı0, dolayısıyla gözlenen accepted-output maliyeti NULL'dır. Hesaplama executable'dır:

```bash
npm run lab:video
npm run economics
npm run benchmark:plan
```

Kaynaklar: `src/domain/unit-economics.ts`, `scripts/unit-economics.ts`, versioned `config/unit-economics-v4.json`; JSON ve48satır sensitivity CSV `.spaces-local/unit-economics-v4/`. Public-safe incelenen kopya `artifacts/unit-economics-v4/`. Veri gerçek render süre/byte ölçümlerinden gelir;30/60sn için ölçülmemiş uzunlukta linear extrapolation açıkça etiketlenir. GPU/CPU billing, wall time ile aynı şey değildir.

## Girdiler ve formüller

Integer micro-USD;1USD=1,000,000micro-USD. Per-output/input video saniyesi, render wall proxy, byte/retention/download, attempt/rejection, gerçek human review/final approval dakikaları, provider/compute/storage/egress, destek/abuse, payment fee/tax ve proposed price ayrı girdidir. Vendor/region/FX/tax bilinmiyorsa NULL kalır. Yayınlanmış Runway fiyatı config'te production route seçilmiş demek değildir.

```text
beklenen attempt / accepted = 1 / (1 - rejection_rate)
iki attempt içinde başarı olasılığı = 1 - rejection_rate²
attempt_cost = output/input usage + compute + storage/egress + attempt_review
accepted_cost = attempt_cost / (1-r) + final_approval + support + abuse + fees/tax
gross_margin = (proposed_net_price - accepted_cost) / proposed_net_price
review_capacity = productive_minutes / (attempt_review_minutes/(1-r) + final_approval_minutes)
break_even_exports/customer = ceil(onboarding_cost / positive_contribution_per_export)
agency_monthly_contribution = accepted_exports * per_export_contribution - allocated_fixed_cost
```

Bu beklenti bağımsız ve aynı rejection olasılığı varsayar; gerçek retry correlation bilinmiyor. İki attempt sınırı başarısız müşteriyi otomatik sonsuz retry'a sokmaz. Başarısız batch maliyetleri accepted denominator'a dahildir. Hiç accepted yoksa oranNULL, sıfır maliyetli başarı değildir. Currency costs yukarı yuvarlanır. Eksik gider varsa gross margin/toplam costNULL; bilinen alt sınır ayrıca gösterilir.60%hedef margin için kalan maksimum provider spend hesaplanır;60% gerçekte sağlandı denmez.

## Varsayımlar, gözlem değil

İllüstratif local-only senaryo: worker$0.15/saat, storage$0.023/GiB-ay, egress$0.10/GiB; human$20 veya$40/saat,3 veya8dk attempt +1dk son onay; support$0.50/accepted,abuse$0.25; fee%2.9+$0.30; tax0 **vergi hariç senaryo**, ülkeye dair beyan değil. Bunların hiçbiri vendor teklifi veya gerçek işçilik ölçümü değildir. USD/TRY NULL. Aylık9600productive reviewer dakikası/10accepted agency export/20USD allocated overhead/10USD onboarding varsayımdır.

48senaryo:30/60sn × red0/20/40% × review3/8dk × human20/40USD × providerUNKNOWN veya **local-only provider0**. Local-only margin gerçek generative tour margin'i değildir. Review süresi/artış/red oranı düşük proposed price'ı zarara çevirebilir. Support/abuse, vergi, payout/FX ve native codec/engine lisans giderleri gerçek pilotta yeniden ölçülmelidir.

Partner modelinde299USD/ay ve10accepted output yalnız hipotez; komisyon oranı NULL, gerçek accepted costUNKNOWN olduğundan aylık partner katkısıNULL. `partnerContribution` bilinmeyen komisyonu sessizce0yapmaz. Canlı reseller sözleşmesi veya invoice/billing yoktur.

## Paket ve review operasyonu

| Paket hipotezi | Gösterim fiyatı (canlı teklif değil) | Gerçek yetenek / açılmamış bölüm |
|---|---:|---|
| Başlangıç video |19USD/export| Çalışan640p/360p source-motion demo; bu fiyatla ticari AI tur satışı yok |
| Öncelikli/kaliteli video |39USD/export| Kalite/kapasite/provider ve yüksek çözünürlük kanıtı bekler; etkin değil |
| Premium3D+rehber |199USD/property| Yerel sentetik free-walk ve scoped guide simülasyonu; gerçek property reconstruction/live voice maliyetiUNKNOWN |
| White-label partner |299USD/ay| Yerel tema/aggregate boundary çalışır; sözleşme/commission/domain/gerçek dağıtım/billing kapalı |

Risk-tiered queue **tasarımı**, kodda auto-release açmaz: düşük risk (aynı kaynak/sessiz edit) standart inceleme; orta (yeni kurgu/branding) ek readability/continuity; yüksek (generative footage, measured-claim, vendor/rights uyuşmazlığı) mimari+rights uzmanı/retake. Her release farklı yetkili reviewer ister; critical fidelity defect red.24/48saat gibi hedefler ancak ölçülmüş staffing/arrival rate/p95 ile owner tarafından SLA olur; bugün SLA verilmez.

Solo emlakçının kısa videolarında minimum review/fee/support overhead baskındır. Agency batch/white-label yeniden kullanılabilir şablonla verim sağlayabilir, fakat child raw lead/medya erişimi ve bağımsız review kaldırılmaz. Kapasite kuyruğunun darboğazı yalnız render saniyesi değildir. Gerçek human-minute verisi alınmadan satış hacmi garantisi yoktur.

## Ticari açılış kararı

Gerçek provider output kalitesi ve kabul oranı; rights/tenant/auth/storage/worker sandbox/AV/encryption/retention; vendor DPA/training/region/rights; gerçek cost-per-accepted30/60sn; support/review staffing/restore; lisans/notice/tax/payment ve staging/pentest/device testleri tamamlanmadan ücretli müşteri/gerçek mülk/pilot yok. Sentetik demo ücretli pilot sayılmaz. V4 sonucu **NO — commercial AI tour quality/profitability NOT_VERIFIED**. İlk owner-gated mikro-benchmark `provider-readiness-v4.md` içindedir.
