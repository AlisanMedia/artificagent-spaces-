"use client";

import Link from "next/link";
import { Activity, ArrowRight, ArrowUpRight, Building2, Check, Image as ImageIcon, ShieldCheck } from "lucide-react";
import { MODE_DEFINITIONS } from "@/domain/modes";
import { useWorkspace } from "@/components/workspace-provider";
import { DemoNotice, ModeIcon, SectionHeading, StudioLink, TextLink } from "@/components/ui";
import { PropertyCard } from "@/components/property-card";

export function Dashboard() {
  const { properties, plans } = useWorkspace();
  const stats = [
    { label: "Örnek mülk", value: String(properties.length).padStart(2, "0"), icon: Building2, detail: "Portföyünüzde" },
    { label: "Görsel arşivi", value: String(properties.reduce((sum, property) => sum + property.media.length, 0)).padStart(2, "0"), icon: ImageIcon, detail: "Sentetik kaynak" },
    { label: "Yerel taslak", value: String(plans.length).padStart(2, "0"), icon: Activity, detail: "Bu oturumda" },
    { label: "İncelemeye hazır", value: String(properties.filter((property) => property.status === "review-ready").length).padStart(2, "0"), icon: ShieldCheck, detail: "Örnek çalışma" },
  ];
  return <>
    <div className="page-topline"><span className="eyebrow">MEKÂNLARIN POTANSİYELİNİ KEŞFEDİN</span><DemoNotice compact /></div>
    <section className="dashboard-intro" aria-labelledby="dashboard-heading">
      <div><h1 id="dashboard-heading">Her mekânın<br />bir hikâyesi var<span className="title-dot">.</span></h1><p>Mülklerinizi yeni bir bakışla anlatın.<br className="desktop-break" /> Bir çalışma alanı, dört farklı deneyim.</p></div>
      <div className="intro-actions"><span className="intro-edition">SİZİN PORTFÖYÜNÜZ. YENİ BİR PERSPEKTİF.</span><StudioLink /><p>Bir örnek seçin. Hikâyeyi siz yönetin.</p></div>
    </section>
    <section className="stats-grid" aria-label="Örnek portföy özeti">
      {stats.map(({ label, value, icon: Icon, detail }) => <div className="stat-card" key={label}>
        <div className="stat-top"><span>{label}</span><Icon size={18} strokeWidth={1.45} aria-hidden="true" /></div><div className="stat-value">{value}<span>{detail}</span></div>
      </div>)}
    </section>
    <section className="content-section">
      <SectionHeading title="Portföyünüz" eyebrow="SEÇİLMİŞ MEKÂNLAR" action={<TextLink href="/properties">Tüm mülkler</TextLink>} />
      <div className="property-grid">{properties.slice(0, 3).map((property) => <PropertyCard key={property.id} property={property} />)}</div>
    </section>
    <section className="content-section">
      <SectionHeading title="Nasıl bir hikâye anlatacaksınız?" eyebrow="YARATICI STÜDYO" action={<span className="subtle-count">4 FARKLI MOD</span>} />
      <div className="mode-grid">
        {MODE_DEFINITIONS.map((mode) => <Link key={mode.id} href={"/studio?mode=" + mode.id} className="mode-card">
          <div className="mode-card-top"><ModeIcon mode={mode.id} size={25} /><span>{mode.number}</span></div>
          <h3>{mode.name}</h3><p>{mode.detail}</p><div className="mode-card-bottom"><span>{mode.output}</span><ArrowUpRight size={19} aria-hidden="true" /></div>
        </Link>)}
      </div>
    </section>
    <div className="dashboard-bottom">
      <section className="activity-panel">
        <SectionHeading title="Çalışma alanınızdan" action={<TextLink href="/activity">Çalışmalar</TextLink>} />
        <div className="activity-line"><span className="activity-icon"><Check size={17} aria-hidden="true" /></span><div><strong>Örnek portföy hazır</strong><p>Sentetik görseller ve kaynak planları inceleyebilirsiniz.</p></div><span className="activity-tag">HAZIR</span></div>
        <div className="activity-line"><span className="activity-icon"><ShieldCheck size={17} aria-hidden="true" /></span><div><strong>İnceleme adımı sizin kontrolünüzde</strong><p>Her plan, açık bir kaynak ve inceleme akışıyla ilerler.</p></div><Link className="icon-button" href="/reviews" aria-label="İnceleme akışını aç"><ArrowRight size={17} aria-hidden="true" /></Link></div>
        <div className="activity-line"><span className="activity-icon"><Activity size={17} aria-hidden="true" /></span><div><strong>{plans.length > 0 ? plans.length + " yerel taslak hazırlandı" : "İlk hikâyeniz için hazırsınız"}</strong><p>{plans.length > 0 ? "Taslaklar yalnız bu sekmenin belleğinde tutuluyor." : "Bir mülk ve mod seçerek başlayın."}</p></div><Link className="icon-button" href="/studio" aria-label="Stüdyoyu aç"><ArrowRight size={17} aria-hidden="true" /></Link></div>
      </section>
      <aside className="editorial-note"><span className="eyebrow">KÜÇÜK BİR NOT</span><h2>İyi bir hikâye,<br />sağlam bir<br />kaynakla başlar.</h2><p>Görselleri ve planları birlikte değerlendirin. Mekânı anlatırken gerçeğe bağlı kalın.</p><TextLink href="/library">Kaynakları inceleyin</TextLink><div className="note-grid" aria-hidden="true" /></aside>
    </div>
  </>;
}
