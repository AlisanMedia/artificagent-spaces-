"use client";

import Link from "next/link";
import { ArrowRight, Check, FileText } from "lucide-react";
import { getMode } from "@/domain/modes";
import { useWorkspace } from "@/components/workspace-provider";
import { DemoNotice, EmptyState, ModeIcon, SectionHeading, StudioLink } from "@/components/ui";

export function ActivityView() {
  const { plans, properties } = useWorkspace();
  return <>
    <div className="page-topline"><span className="eyebrow">TASLAKTAN İNCELEMEYE</span><DemoNotice compact /></div>
    <div className="page-heading"><div><h1>Çalışmalarınız.</h1><p>Bu oturumda hazırladığınız yerel planlar bir arada.</p></div><StudioLink /></div>
    {plans.length === 0 ? <EmptyState title="İlk hikâye sizi bekliyor." description="Stüdyoda bir mülk ve anlatım modu seçin. Hazırladığınız yerel plan burada görünecek." action={<StudioLink>İlk taslağı hazırla</StudioLink>} /> : <div className="plan-list">{plans.map((plan) => <article className="plan-list-card" key={plan.id}>
      <div className="plan-list-title"><span className="plan-mode-icon"><ModeIcon mode={plan.mode} size={24} /></span><div><h2>{properties.find((property) => property.id === plan.propertyId)?.name}</h2><p>{getMode(plan.mode).name} · {plan.kind === "scene-plan" ? "Sahne planı" : "Storyboard"}</p></div><span className="status-label"><span />İncelemeye hazır</span></div>
      <ol className="plan-progress">{plan.checks.map((check) => <li key={check}><Check size={15} aria-hidden="true" />{check}</li>)}</ol>
      <div className="plan-list-footer"><span><FileText size={15} aria-hidden="true" />Yerel plan · Gerçek üretim yok</span><Link href="/reviews" className="text-link">İncelemeye git<ArrowRight size={16} aria-hidden="true" /></Link></div>
    </article>)}</div>}
    <section className="content-section"><SectionHeading title="Her hikâyenin bir kontrol noktası var." eyebrow="ÖNİZLEME AKIŞI" /><div className="process-grid">{[
      ["01", "Kaynakları seçin", "Mülkün sentetik görsellerini ve varsa örnek planını birlikte değerlendirin."],
      ["02", "Anlatımı tasarlayın", "Dört moddan biriyle ayarları belirleyin; deterministik yerel planı görün."],
      ["03", "İnsan gözüyle inceleyin", "Kaynak, tutarlılık ve açıklama kontrollerini tamamlayın."],
    ].map(([number, title, description]) => <div key={number} className="process-card"><span>{number}</span><h3>{title}</h3><p>{description}</p></div>)}</div></section>
    <p className="field-description bottom-notice">Bu sekme yenilendiğinde taslaklar sıfırlanır. Gerçek kuyruk, arka plan işi veya üretim servisi çalışmaz.</p>
  </>;
}
