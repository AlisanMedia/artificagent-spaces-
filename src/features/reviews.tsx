"use client";

import Image from "next/image";
import { useState } from "react";
import { Check, CheckCheck, ShieldCheck } from "lucide-react";
import { useWorkspace } from "@/components/workspace-provider";
import { Button, DemoNotice } from "@/components/ui";
import { getMode } from "@/domain/modes";

const REVIEW_CHECKS = [
  "Görseller ve plan aynı sentetik mülke ait.",
  "Mevcut olmayan bir oda veya özellik iddia edilmiyor.",
  "Yerel önizleme ve sentetik kaynak açıklaması görünür.",
] as const;

function ReviewFlow() {
  const { plans, properties } = useWorkspace();
  const latestPlan = plans[0];
  const property = properties.find((item) => item.id === latestPlan?.propertyId) ?? properties[0]!;
  const [checks, setChecks] = useState<readonly string[]>([]);
  const [approved, setApproved] = useState(false);
  return <>
    <div className="page-topline"><span className="eyebrow">GÜVEN, SON KAREDE BAŞLAR</span><DemoNotice compact /></div>
    <div className="page-heading"><div><h1>Son bakış sizde.</h1><p>Güzel bir anlatım, kaynağına sadık kaldığında değerli.</p></div><span className="count-badge">{latestPlan ? "YEREL TASLAK" : "HAZIR İNCELEME ÖRNEĞİ"}</span></div>
    <div className="review-layout">
      <section className="review-canvas" aria-labelledby="review-property-title"><div className="review-canvas-heading"><div><p className="eyebrow">{property.reference}</p><h2 id="review-property-title">{property.name}</h2></div><span>{latestPlan ? getMode(latestPlan.mode).name : "Cinematic örneği"}</span></div>
        <div className="review-comparison"><figure><Image src={property.cover} alt="Kaynak: sentetik mülk illüstrasyonu" width={1200} height={760} unoptimized /><figcaption>Kaynak görsel<span>SENTETİK</span></figcaption></figure><figure><Image src={property.cover} alt="Gerçek çıktı olmayan, aynı sentetik görselle sunulan yer tutucu" width={1200} height={760} unoptimized /><figcaption>Plan yer tutucusu<span>ÜRETİM YOK</span></figcaption></figure></div>
        <div className="review-caption"><ShieldCheck size={18} aria-hidden="true" /><p>Karşılaştırmada aynı sentetik görsel gösterilir. Bu ekran model kalitesini, gerçek geometriyi veya yayın güvenliğini doğrulamaz.</p></div>
      </section>
      <aside className="review-checklist"><p className="eyebrow">İNSAN İNCELEMESİ</p><h2>Kaynağa sadık mı?</h2><p className="muted">Yerel inceleme akışını tamamlamak için üç kontrolü de işaretleyin.</p><fieldset><legend className="sr-only">İnceleme kontrol listesi</legend>{REVIEW_CHECKS.map((label) => <label key={label} className="checkbox-field"><input type="checkbox" checked={checks.includes(label)} onChange={(event) => { setApproved(false); setChecks(event.target.checked ? [...checks, label] : checks.filter((check) => check !== label)); }} /><span>{label}</span></label>)}</fieldset>
        <Button disabled={checks.length !== REVIEW_CHECKS.length || approved} onClick={() => setApproved(true)}><Check size={17} aria-hidden="true" />{approved ? "Yerel inceleme tamamlandı" : "Yerel incelemeyi tamamla"}</Button>
        {approved ? <p className="review-approved" role="status"><CheckCheck size={19} aria-hidden="true" />Örnek inceleme onaylandı. Yayın, paylaşım veya kalıcı kayıt oluşturulmadı.</p> : <p className="field-description">Onay yalnız bu ekranın belleğinde tutulur. Gerçek yayın yetkisi vermez.</p>}
      </aside>
    </div>
  </>;
}

export function Reviews() {
  const { organization, plans } = useWorkspace();
  return <ReviewFlow key={organization.id + (plans[0]?.id ?? "fixture")} />;
}
